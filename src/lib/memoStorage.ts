import type { Memo } from "@/types/memo";
import { SYNC_QUEUE_CHANGED } from "@/src/lib/syncQueue";
import {
  deleteMemo,
  getAllMemos,
  initAndMigrateStorage,
  LEGACY_MEMO_STORAGE_KEY,
  replaceAllMemos,
  saveMemo,
  openMemoDatabase,
  isMemo,
  FALLBACK_MEMO_STORAGE_KEY,
} from "@/src/lib/storage/db";

let writeQueue: Promise<void> = Promise.resolve();
export const STORAGE_FALLBACK_EVENT = "memoorbit-storage-fallback";

export {
  deleteMemo,
  getAllMemos,
  initAndMigrateStorage,
  replaceAllMemos,
  saveMemo,
};

// 💡 [앱 시작 데이터 준비]
// 새 IndexedDB와 예전 LocalStorage를 먼저 확인하고, 둘 다 비어 있을 때만 기본 메모를 새 창고에 채웁니다.
export const hydrateMemoStorage = async (
  defaultMemos: Memo[],
): Promise<Memo[]> => {
  try {
    // 장애 중 쓴 최신 백업이 있으면 기존 DB보다 먼저 복구해 예전 내용으로 되돌아가지 않게 합니다.
    const fallback = window.localStorage.getItem(FALLBACK_MEMO_STORAGE_KEY);
    if (fallback !== null) {
      const parsed: unknown = JSON.parse(fallback);
      if (!Array.isArray(parsed) || !parsed.every(isMemo)) throw new Error("로컬 백업 형식이 올바르지 않습니다.");
      await replaceAllMemos(parsed);
      window.localStorage.removeItem(FALLBACK_MEMO_STORAGE_KEY);
      return getAllMemos();
    }
    const migratedMemos = await initAndMigrateStorage();
    const storedMemos = migratedMemos.length > 0
      ? migratedMemos
      : await getAllMemos();
    const database = await openMemoDatabase();
    if (storedMemos.length === 0 && await database.get("settings", "initialized")) return [];
    if (storedMemos.length > 0) {
      await replaceAllMemos(storedMemos);
      return getAllMemos();
    }
    await replaceAllMemos(defaultMemos);
    return getAllMemos();
  } catch (error) {
    console.error("IndexedDB 메모 불러오기 실패, LocalStorage를 사용합니다.", error);
    const stored = window.localStorage.getItem(FALLBACK_MEMO_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_MEMO_STORAGE_KEY);
    if (!stored) return defaultMemos;
    try {
      const parsed: unknown = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter(isMemo).map((memo) => ({ ...memo, syncStatus: "pending" })) : defaultMemos;
    } catch {
      return defaultMemos;
    }
  }
};

// 💡 [비동기 전체 동기화]
// React State의 최신 목록과 DB 목록을 비교해 필요한 저장과 삭제를 순서대로 실행합니다.
export const persistMemos = (memos: Memo[]): Promise<void> => {
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    try {
      await replaceAllMemos(memos);
      window.localStorage.removeItem(FALLBACK_MEMO_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_MEMO_STORAGE_KEY);
      window.dispatchEvent(new Event(SYNC_QUEUE_CHANGED));
    } catch (error) {
      console.error("IndexedDB 메모 저장 실패, LocalStorage에 저장합니다.", error);
      window.localStorage.setItem(
        FALLBACK_MEMO_STORAGE_KEY,
        JSON.stringify(memos.map((memo) => ({ ...memo, syncStatus: "pending" }))),
      );
      window.dispatchEvent(new Event(STORAGE_FALLBACK_EVENT));
    }
  });
  return writeQueue;
};
