import type { Memo } from "@/types/memo";

const DATABASE_NAME = "memoorbit";
const DATABASE_VERSION = 1;
const MEMO_STORE_NAME = "memos";
const META_STORE_NAME = "meta";
const INITIALIZED_KEY = "initialized";
export const LEGACY_MEMO_STORAGE_KEY = "memoorbit-memos";

interface StorageMeta {
  key: string;
  value: boolean;
}

interface MemoStorageSnapshot {
  initialized: boolean;
  memos: Memo[];
}

let writeQueue: Promise<void> = Promise.resolve();

const requestToPromise = <Result>(
  request: IDBRequest<Result>,
): Promise<Result> => new Promise((resolve, reject) => {
  request.addEventListener("success", () => resolve(request.result));
  request.addEventListener("error", () => reject(request.error));
});

const transactionToPromise = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error));
    transaction.addEventListener("error", () => reject(transaction.error));
  });

// 💡 [IndexedDB 연결]
// 브라우저 DB가 처음 만들어질 때 메모 레코드와 초기화 여부를 각각 보관할 저장 공간을 준비합니다.
const openMemoDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MEMO_STORE_NAME)) {
        database.createObjectStore(MEMO_STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(META_STORE_NAME)) {
        database.createObjectStore(META_STORE_NAME, { keyPath: "key" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
    request.addEventListener("blocked", () => {
      reject(new Error("IndexedDB 버전 변경이 다른 탭에 의해 차단되었습니다."));
    });
  });

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

const parseLegacyMemos = (): Memo[] | null => {
  const stored = window.localStorage.getItem(LEGACY_MEMO_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every(isMemo) ? parsed : null;
  } catch {
    return null;
  }
};

const readIndexedDbSnapshot = async (): Promise<MemoStorageSnapshot> => {
  const database = await openMemoDatabase();
  try {
    const transaction = database.transaction(
      [MEMO_STORE_NAME, META_STORE_NAME],
      "readonly",
    );
    const memosRequest = transaction.objectStore(MEMO_STORE_NAME).getAll();
    const metaRequest = transaction
      .objectStore(META_STORE_NAME)
      .get(INITIALIZED_KEY);
    const [memos, meta] = await Promise.all([
      requestToPromise(memosRequest),
      requestToPromise(metaRequest) as Promise<StorageMeta | undefined>,
      transactionToPromise(transaction),
    ]);
    return {
      initialized: meta?.value === true,
      memos: memos.filter(isMemo),
    };
  } finally {
    database.close();
  }
};

// 모든 put 요청이 성공해야 초기화 표식까지 함께 확정되므로 중간 상태가 다음 실행에 노출되지 않습니다.
const replaceIndexedDbMemos = async (memos: Memo[]): Promise<void> => {
  const database = await openMemoDatabase();
  try {
    const transaction = database.transaction(
      [MEMO_STORE_NAME, META_STORE_NAME],
      "readwrite",
    );
    const memoStore = transaction.objectStore(MEMO_STORE_NAME);
    memoStore.clear();
    memos.forEach((memo) => memoStore.put(memo));
    transaction.objectStore(META_STORE_NAME).put({
      key: INITIALIZED_KEY,
      value: true,
    } satisfies StorageMeta);
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
};

// 💡 [최초 데이터 마이그레이션]
// IndexedDB가 아직 초기화되지 않았을 때만 예전 LocalStorage를 옮기며, 성공 후에만 예전 키를 지웁니다.
export const hydrateMemoStorage = async (
  defaultMemos: Memo[],
): Promise<Memo[]> => {
  try {
    const snapshot = await readIndexedDbSnapshot();
    if (snapshot.initialized) return snapshot.memos;

    const legacyMemos = parseLegacyMemos();
    const initialData = legacyMemos ?? defaultMemos;
    await replaceIndexedDbMemos(initialData);
    window.localStorage.removeItem(LEGACY_MEMO_STORAGE_KEY);
    return initialData;
  } catch (error) {
    console.error("IndexedDB 메모 불러오기 실패, LocalStorage를 사용합니다.", error);
    const fallbackMemos = parseLegacyMemos() ?? defaultMemos;
    window.localStorage.setItem(
      LEGACY_MEMO_STORAGE_KEY,
      JSON.stringify(fallbackMemos),
    );
    return fallbackMemos;
  }
};

// 💡 [비동기 메모 저장]
// 빠른 연속 편집도 이전 저장보다 먼저 끝나지 않도록 작업을 줄 세우고, DB 장애 때만 LocalStorage에 대신 보관합니다.
export const persistMemos = (memos: Memo[]): Promise<void> => {
  writeQueue = writeQueue.then(async () => {
    try {
      await replaceIndexedDbMemos(memos);
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
