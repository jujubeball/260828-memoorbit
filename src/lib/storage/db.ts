import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Memo, SyncQueueEntry } from "@/types/memo";

const DATABASE_NAME = "MemoOrbitDB";
const DATABASE_VERSION = 2;
const MEMO_STORE_NAME = "memos";
export const LEGACY_MEMO_STORAGE_KEY = "memoorbit-memos";
export const FALLBACK_MEMO_STORAGE_KEY = "memoorbit-pending-local-snapshot";

interface MemoOrbitDatabase extends DBSchema {
  settings: { key: string; value: boolean };
  syncQueue: {
    key: string;
    value: SyncQueueEntry;
  };
  memos: {
    key: string;
    value: Memo;
  };
}

let databasePromise: Promise<IDBPDatabase<MemoOrbitDatabase>> | null = null;

export const openMemoDatabase = (): Promise<IDBPDatabase<MemoOrbitDatabase>> => {
  databasePromise ??= openDB<MemoOrbitDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(MEMO_STORE_NAME)) {
        database.createObjectStore(MEMO_STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("syncQueue")) {
        database.createObjectStore("syncQueue", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("settings")) database.createObjectStore("settings");
    },
  }).catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
};

export const isMemo = (value: unknown): value is Memo => {
  if (!value || typeof value !== "object") return false;
  const memo = value as Partial<Memo>;
  return typeof memo.id === "string"
    && typeof memo.title === "string"
    && typeof memo.content === "string"
    && typeof memo.createdAt === "string"
    && typeof memo.updatedAt === "string"
    && typeof memo.isPinned === "boolean"
    && Array.isArray(memo.tags)
    && memo.tags.every((tag) => typeof tag === "string");
};

const readLegacyMemos = (): Memo[] => {
  const stored = window.localStorage.getItem(LEGACY_MEMO_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isMemo) : [];
  } catch {
    return [];
  }
};

// 💡 [IndexedDB 최초 이사]
// 앱 시작 시 새 창고가 비어 있을 때만 LocalStorage 메모를 한 트랜잭션으로 옮기며, 이사가 끝난 뒤 예전 데이터를 지웁니다.
export const initAndMigrateStorage = async (): Promise<Memo[]> => {
  const database = await openMemoDatabase();
  const storedMemos = await database.getAll(MEMO_STORE_NAME);
  if (storedMemos.length > 0) return storedMemos;
  const legacyMemos = readLegacyMemos();
  if (legacyMemos.length === 0) return [];
  const transaction = database.transaction(MEMO_STORE_NAME, "readwrite");
  await Promise.all([
    ...legacyMemos.map((memo) => transaction.store.put(memo)),
    transaction.done,
  ]);
  window.localStorage.removeItem(LEGACY_MEMO_STORAGE_KEY);
  return legacyMemos;
};

export const getAllMemos = async (): Promise<Memo[]> => {
  const database = await openMemoDatabase();
  return database.getAll(MEMO_STORE_NAME);
};

export const saveMemo = async (memo: Memo): Promise<void> => {
  const database = await openMemoDatabase();
  const transaction = database.transaction([MEMO_STORE_NAME, "syncQueue", "settings"], "readwrite");
  const pending = preparePendingMemo(memo);
  await transaction.objectStore(MEMO_STORE_NAME).put(pending);
  await transaction.objectStore("syncQueue").put(createQueueEntry(pending));
  await transaction.objectStore("settings").put(true, "initialized");
  await transaction.done;
};

export const deleteMemo = async (id: string): Promise<void> => {
  const database = await openMemoDatabase();
  const transaction = database.transaction([MEMO_STORE_NAME, "syncQueue", "settings"], "readwrite");
  await transaction.objectStore(MEMO_STORE_NAME).delete(id);
  await transaction.objectStore("syncQueue").put({
    id, revision: crypto.randomUUID(), operation: "delete", attempts: 0,
    nextAttemptAt: 0, queuedAt: Date.now(),
  });
  await transaction.objectStore("settings").put(true, "initialized");
  await transaction.done;
};

// 💡 [메모 목록 원자적 교체]
// 화면의 최신 배열을 한 트랜잭션 안에서 저장하고 사라진 ID를 삭제해, 도중에 실패해도 반쪽짜리 목록이 남지 않게 합니다.
export const replaceAllMemos = async (memos: Memo[]): Promise<void> => {
  const database = await openMemoDatabase();
  const transaction = database.transaction([MEMO_STORE_NAME, "syncQueue", "settings"], "readwrite");
  const store = transaction.objectStore(MEMO_STORE_NAME);
  const queue = transaction.objectStore("syncQueue");
  const storedMemos = await store.getAll();
  const storedById = new Map(storedMemos.map((memo) => [memo.id, memo]));
  const currentIds = new Set(memos.map((memo) => memo.id));
  // 화면의 상태 배지만 바뀐 경우는 다시 전송하지 않습니다. 실제 내용 변경과 전송 대기는 함께 저장합니다.
  for (const memo of memos) {
    const stored = storedById.get(memo.id);
    if (stored?.syncRevision && memoContentKey(stored) === memoContentKey(memo)) continue;
    const pending = preparePendingMemo(memo);
    await store.put(pending);
    await queue.put(createQueueEntry(pending));
  }
  for (const memo of storedMemos) {
    if (currentIds.has(memo.id)) continue;
    await store.delete(memo.id);
    await queue.put({
      id: memo.id, revision: crypto.randomUUID(), operation: "delete", attempts: 0,
      nextAttemptAt: 0, queuedAt: Date.now(),
    });
  }
  await transaction.objectStore("settings").put(true, "initialized");
  await transaction.done;
};

// 상태 배지와 전송 식별자를 제외한 실제 내용을 비교해 오래된 응답이 새 편집 내용을 바꾸지 못하게 합니다.
export const memoContentKey = (memo: Memo): string => JSON.stringify({
  id: memo.id, title: memo.title, content: memo.content, richContent: memo.richContent,
  userId: memo.userId, createdAt: memo.createdAt, updatedAt: memo.updatedAt,
  isPinned: memo.isPinned, tags: memo.tags, imageUrl: memo.imageUrl,
  images: memo.images, links: memo.links,
});

const preparePendingMemo = (memo: Memo): Memo => ({
  ...memo, syncStatus: "pending", syncRevision: crypto.randomUUID(),
});

const createQueueEntry = (memo: Memo): SyncQueueEntry => ({
  id: memo.id, revision: memo.syncRevision!, operation: "upsert", memo,
  attempts: 0, nextAttemptAt: 0, queuedAt: Date.now(),
});
