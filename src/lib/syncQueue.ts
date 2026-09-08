import type { Memo, SyncQueueEntry } from "@/types/memo";
import { FALLBACK_MEMO_STORAGE_KEY, getAllMemos, openMemoDatabase } from "@/src/lib/storage/db";

export interface SyncTransport {
  send: (entry: SyncQueueEntry, signal: AbortSignal) => Promise<{ revision: string }>;
}

export interface SyncQueueOptions {
  transport?: SyncTransport;
  onChange: (memos: Memo[]) => void;
  onError: (error: unknown) => void;
}

export const SYNC_QUEUE_CHANGED = "memoorbit-sync-queue-changed";

// 서버 주소가 없는 개발 환경은 전송 대기로 남깁니다. 연결 시 같은 출처의 인증 쿠키만 사용합니다.
export const createSyncTransport = (): SyncTransport | undefined => {
  const endpoint = process.env.NEXT_PUBLIC_MEMO_SYNC_ENDPOINT;
  if (!endpoint) return undefined;
  const url = new URL(endpoint, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error("동기화 API는 같은 출처여야 합니다.");
  return {
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
  if (current?.revision === entry.revision) {
    if (success) await queue.delete(entry.id);
    else await queue.put({
      ...current, attempts: current.attempts + 1,
      nextAttemptAt: Date.now() + Math.min(300_000, 1000 * 2 ** Math.min(current.attempts, 8)),
    });
    const memo = await transaction.objectStore("memos").get(entry.id);
    if (memo?.syncRevision === entry.revision) {
      await transaction.objectStore("memos").put({ ...memo, syncStatus: success ? "synced" : "failed" });
    }
  }
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
    if (window.localStorage.getItem(FALLBACK_MEMO_STORAGE_KEY) !== null) return;
    const entries = await db.getAll("syncQueue");
    const entry = entries.filter((item) => item.nextAttemptAt <= Date.now())
      .sort((a, b) => a.queuedAt - b.queuedAt || a.id.localeCompare(b.id))[0];
    if (!entry) return;
    const timeout = new AbortController();
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
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
    if (signal.aborted || !navigator.onLine) return;
    await settleSyncEntry(entry, success);
    await onChange();
  }
};

// 💡 [앱 수명과 백그라운드 큐 연결]
// 새 저장·재연결·주기 재시도를 하나의 실행으로 합치며 지원 브라우저에서는 탭 사이에도 전송을 직렬화합니다.
export const startSyncQueue = (options: SyncQueueOptions): (() => void) => {
  let running = false;
  let rerun = false;
  let stopped = false;
  let controller = new AbortController();
  const publish = async (): Promise<void> => {
    const memos = await getAllMemos();
    if (!stopped) options.onChange(memos);
  };
  const run = async (): Promise<void> => {
    if (stopped) return;
    if (running) { rerun = true; return; }
    running = true;
    controller = new AbortController();
    try {
      await publish();
      if (options.transport && navigator.onLine) {
        const drain = (): Promise<void> => drainSyncQueue(options.transport!, controller.signal, publish);
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
  const wake = (): void => { void run(); };
  const offline = (): void => controller.abort();
  window.addEventListener("online", wake);
  window.addEventListener("offline", offline);
  window.addEventListener(SYNC_QUEUE_CHANGED, wake);
  const timer = window.setInterval(wake, 5000);
  wake();
  return () => {
    stopped = true;
    controller.abort();
    window.clearInterval(timer);
    window.removeEventListener("online", wake);
    window.removeEventListener("offline", offline);
    window.removeEventListener(SYNC_QUEUE_CHANGED, wake);
  };
};
