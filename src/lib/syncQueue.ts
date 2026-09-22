import type { Memo, SyncQueueEntry } from "@/types/memo";
import { FALLBACK_MEMO_STORAGE_KEY, getAllMemos, openMemoDatabase } from "@/src/lib/storage/db";

// 이 파일은 이미 IndexedDB에 기록된 작업의 전송 담당입니다. 메모와 큐를 처음 저장하는 곳은 storage/db.ts입니다.
// React 훅이 아니므로 State·이펙트는 없으며, Home의 이펙트가 startSyncQueue를 시작하고 반환된 정리 함수를 호출합니다.

// 실제 HTTP 전송기와 테스트용 전송기가 같은 계약을 사용합니다. 성공 응답에는 보낸 수정본과 같은 revision이 있어야 합니다.
export interface SyncTransport {
  send: (entry: SyncQueueEntry, signal: AbortSignal) => Promise<{ revision: string }>;
}

// onChange는 DB를 다시 읽은 메모 배열을 Home에 전달합니다. Home은 내용이 같은 메모의 동기화 배지만 합칩니다.
// onError는 큐 자체의 접근·실행 오류 안내용이며, 개별 네트워크 실패는 실패 배지와 재시도 시각으로 처리합니다.
export interface SyncQueueOptions {
  transport?: SyncTransport;
  onChange: (memos: Memo[]) => void;
  onError: (error: unknown) => void;
}

// memoStorage.persistMemos가 로컬 저장을 마친 뒤 같은 창에 보내는 알림 이름입니다. 탭 전체에 방송되는 이벤트는 아닙니다.
export const SYNC_QUEUE_CHANGED = "memoorbit-sync-queue-changed";

// 서버 주소가 없는 개발 환경은 전송 대기로 남깁니다. 연결 시 같은 출처의 인증 쿠키만 사용합니다.
// 환경변수는 브라우저 번들에서 보이는 공개 설정이므로 비밀키를 넣지 않습니다. 현재 저장소에는 이 동기화 서버 구현이 없습니다.
export const createSyncTransport = (): SyncTransport | undefined => {
  const endpoint = process.env.NEXT_PUBLIC_MEMO_SYNC_ENDPOINT;
  if (!endpoint) return undefined;
  const url = new URL(endpoint, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error("동기화 API는 같은 출처여야 합니다.");
  return {
    // 💡 [수정본 확인을 포함한 전송]
    // 큐 항목을 JSON으로 보내고 HTTP 성공과 revision 일치를 모두 확인합니다. 취소 신호는 fetch까지 전달됩니다.
    // Idempotency-Key를 보내지만 중복 요청을 한 번만 처리하는 보장은 연결할 서버가 구현해야 합니다.
    async send(entry, signal) {
      const response = await fetch(url, {
        method: "POST", credentials: "same-origin", signal,
        headers: { "Content-Type": "application/json", "Idempotency-Key": entry.revision },
        body: JSON.stringify(entry),
      });
      if (!response.ok) throw new Error(`동기화 서버 응답 오류: ${response.status}`);
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("revision" in result)
        || result.revision !== entry.revision) throw new Error("동기화 수정본 확인에 실패했습니다.");
      return { revision: entry.revision };
    },
  };
};

// 💡 [전송 결과의 원자적 반영]
// 서버를 기다리는 사이 새 편집이 저장되면 이전 응답은 버립니다. 성공한 동일 수정본만 큐에서 지웁니다.
export const settleSyncEntry = async (entry: SyncQueueEntry, success: boolean): Promise<void> => {
  const db = await openMemoDatabase();
  const transaction = db.transaction(["memos", "syncQueue"], "readwrite");
  const queue = transaction.objectStore("syncQueue");
  const current = await queue.get(entry.id);
  // 같은 메모를 다시 편집하면 id는 같아도 revision이 바뀝니다. 이전 전송 결과로 최신 큐를 삭제하거나 실패 처리하지 않습니다.
  if (current?.revision === entry.revision) {
    if (success) await queue.delete(entry.id);
    // 실패 횟수를 늘리고 지수 지연으로 재시도를 늦춥니다. 현재 식은 1·2·4초 순으로 증가해 최대 256초가 됩니다.
    else await queue.put({
      ...current, attempts: current.attempts + 1,
      nextAttemptAt: Date.now() + Math.min(300_000, 1000 * 2 ** Math.min(current.attempts, 8)),
    });
    const memo = await transaction.objectStore("memos").get(entry.id);
    // 삭제 작업에는 메모 레코드가 없을 수 있습니다. 존재하고 수정본까지 같을 때만 synced 또는 failed 배지를 기록합니다.
    if (memo?.syncRevision === entry.revision) {
      await transaction.objectStore("memos").put({ ...memo, syncStatus: success ? "synced" : "failed" });
    }
  }
  // 큐 제거와 배지 갱신이 한 묶음으로 확정될 때까지 기다려 두 저장소가 서로 다른 결과를 갖지 않게 합니다.
  await transaction.done;
};

// 💡 [영속 큐 순차 전송]
// 큐를 매번 다시 읽어 수정·삭제의 최신 버전만 보내며, 오프라인이나 종료 신호가 오면 대기 상태를 보존합니다.
export const drainSyncQueue = async (
  transport: SyncTransport,
  signal: AbortSignal,
  onChange: () => Promise<void>,
): Promise<void> => {
  const db = await openMemoDatabase();
  while (!signal.aborted && navigator.onLine) {
    // 장애 백업이 남아 있으면 DB보다 백업이 최신일 수 있습니다. 복구되기 전 예전 DB 내용을 서버로 보내지 않습니다.
    if (window.localStorage.getItem(FALLBACK_MEMO_STORAGE_KEY) !== null) return;
    const entries = await db.getAll("syncQueue");
    // 재시도 시각이 된 항목만 고르고 대기 시작이 가장 오래된 한 건을 보냅니다. 한 건 처리 후 큐 전체를 다시 읽습니다.
    const entry = entries.filter((item) => item.nextAttemptAt <= Date.now())
      .sort((a, b) => a.queuedAt - b.queuedAt || a.id.localeCompare(b.id))[0];
    if (!entry) return;
    const timeout = new AbortController();
    // 앱 종료·오프라인 신호와 20초 제한을 이 요청의 취소 신호 하나로 연결합니다.
    const abort = (): void => timeout.abort();
    signal.addEventListener("abort", abort, { once: true });
    const timer = window.setTimeout(abort, 20_000);
    let success = false;
    try {
      const result = await transport.send(entry, timeout.signal);
      success = result.revision === entry.revision;
    } catch {
      // 네트워크 실패는 아래에서 재시도 시각과 실패 배지로 저장합니다.
    } finally {
      // 요청이 끝나면 타이머와 부모 취소 구독을 제거해 완료된 요청에 뒤늦은 취소가 쌓이지 않게 합니다.
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
    // 도중에 오프라인이 되거나 종료되면 성공처럼 보이는 응답도 확정하지 않고 큐를 남깁니다.
    // navigator.onLine은 연결 힌트일 뿐 서버 도달을 보장하지 않으므로 실제 성공 여부는 send 응답으로 판단합니다.
    if (signal.aborted || !navigator.onLine) return;
    await settleSyncEntry(entry, success);
    await onChange();
  }
};

// 💡 [앱 수명과 백그라운드 큐 연결]
// 새 저장·재연결·주기 재시도를 하나의 실행으로 합치며 지원 브라우저에서는 탭 사이에도 전송을 직렬화합니다.
export const startSyncQueue = (options: SyncQueueOptions): (() => void) => {
  // running은 동시 실행 차단, rerun은 실행 중 들어온 추가 요청 기억, stopped는 종료 뒤 작업 재개 차단용입니다.
  // 모두 반환된 정리 함수와 내부 함수가 공유하는 지역 변수이며 화면에 직접 표시하는 React State가 아닙니다.
  let running = false;
  let rerun = false;
  let stopped = false;
  let controller = new AbortController();
  // DB의 최신 배열을 읽어 호출자에게 알립니다. 읽는 동안 종료되면 onChange를 호출하지 않습니다.
  const publish = async (): Promise<void> => {
    const memos = await getAllMemos();
    if (!stopped) options.onChange(memos);
  };
  // 💡 [겹치는 재시도 합치기]
  // 이벤트가 동시에 들어오면 이미 실행 중인 작업에 rerun만 표시합니다. 끝난 뒤 한 번 더 읽어 새 저장을 놓치지 않습니다.
  const run = async (): Promise<void> => {
    if (stopped) return;
    if (running) { rerun = true; return; }
    running = true;
    controller = new AbortController();
    try {
      await publish();
      if (options.transport && navigator.onLine) {
        // 전송기가 있는 분기에서만 실행하므로 여기의 느낌표는 transport가 있음을 TypeScript에 알려 줍니다.
        const drain = (): Promise<void> => drainSyncQueue(options.transport!, controller.signal, publish);
        // Web Locks 지원 시 같은 출처의 여러 탭도 순서를 지킵니다. 미지원 브라우저는 현재 큐 실행 안에서만 직렬화됩니다.
        if (navigator.locks) await navigator.locks.request("memoorbit-sync", { signal: controller.signal }, drain);
        else await drain();
      }
    } catch (error) {
      if (!stopped && !controller.signal.aborted) options.onError(error);
    } finally {
      running = false;
      if (rerun && !stopped) { rerun = false; void run(); }
    }
  };
  // 재연결·새 저장·5초 주기 알림이 공유하는 입구입니다. 이벤트 콜백은 Promise를 반환할 필요가 없어 void로 시작합니다.
  const wake = (): void => { void run(); };
  // 연결이 끊기면 진행 중인 요청을 중단합니다. 영속 큐 자체는 삭제하지 않아 다음 온라인 알림 때 이어갑니다.
  const offline = (): void => controller.abort();
  window.addEventListener("online", wake);
  window.addEventListener("offline", offline);
  window.addEventListener(SYNC_QUEUE_CHANGED, wake);
  const timer = window.setInterval(wake, 5000);
  wake();
  // Home의 이펙트 정리 단계에서 호출됩니다. 중단 표시, 요청 취소, 타이머·이벤트 해제를 함께 수행합니다.
  return () => {
    stopped = true;
    controller.abort();
    window.clearInterval(timer);
    window.removeEventListener("online", wake);
    window.removeEventListener("offline", offline);
    window.removeEventListener(SYNC_QUEUE_CHANGED, wake);
  };
};
