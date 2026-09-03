import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Memo } from "@/types/memo";

const DATABASE_NAME = "MemoOrbitDB";
const DATABASE_VERSION = 1;
const MEMO_STORE_NAME = "memos";
export const LEGACY_MEMO_STORAGE_KEY = "memoorbit-memos";

interface MemoOrbitDatabase extends DBSchema {
  memos: {
    key: string;
    value: Memo;
  };
}

let databasePromise: Promise<IDBPDatabase<MemoOrbitDatabase>> | null = null;

const openMemoDatabase = (): Promise<IDBPDatabase<MemoOrbitDatabase>> => {
  databasePromise ??= openDB<MemoOrbitDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(MEMO_STORE_NAME)) {
        database.createObjectStore(MEMO_STORE_NAME, { keyPath: "id" });
      }
    },
  });
  return databasePromise;
};

const isMemo = (value: unknown): value is Memo => {
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
  await database.put(MEMO_STORE_NAME, memo);
};

export const deleteMemo = async (id: string): Promise<void> => {
  const database = await openMemoDatabase();
  await database.delete(MEMO_STORE_NAME, id);
};
