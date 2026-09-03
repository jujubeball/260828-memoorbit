import type { Memo } from "@/types/memo";
import {
  deleteMemo,
  getAllMemos,
  initAndMigrateStorage,
  LEGACY_MEMO_STORAGE_KEY,
  replaceAllMemos,
  saveMemo,
} from "@/src/lib/storage/db";

let writeQueue: Promise<void> = Promise.resolve();

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
    const migratedMemos = await initAndMigrateStorage();
    const storedMemos = migratedMemos.length > 0
      ? migratedMemos
      : await getAllMemos();
    if (storedMemos.length > 0) return storedMemos;
    await Promise.all(defaultMemos.map(saveMemo));
    return defaultMemos;
  } catch (error) {
    console.error("IndexedDB 메모 불러오기 실패, LocalStorage를 사용합니다.", error);
    const stored = window.localStorage.getItem(LEGACY_MEMO_STORAGE_KEY);
    if (!stored) return defaultMemos;
    try {
      return JSON.parse(stored) as Memo[];
    } catch {
      return defaultMemos;
    }
  }
};

// 💡 [비동기 전체 동기화]
// React State의 최신 목록과 DB 목록을 비교해 필요한 저장과 삭제를 순서대로 실행합니다.
export const persistMemos = (memos: Memo[]): Promise<void> => {
  writeQueue = writeQueue.then(async () => {
    try {
      await replaceAllMemos(memos);
      window.localStorage.removeItem(LEGACY_MEMO_STORAGE_KEY);
    } catch (error) {
      console.error("IndexedDB 메모 저장 실패, LocalStorage에 저장합니다.", error);
      window.localStorage.setItem(
        LEGACY_MEMO_STORAGE_KEY,
        JSON.stringify(memos),
      );
    }
  });
  return writeQueue;
};
