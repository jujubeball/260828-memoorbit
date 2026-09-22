import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

const require = createRequire(import.meta.url);
// 실제 TypeScript 모듈을 실행하며 브라우저 저장소만 테스트용 IndexedDB로 대체합니다.
function loader() {
  const cache = new Map();
  function load(file) {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path).exports;
    const compiled = { exports: {} };
    cache.set(path, compiled);
    const code = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function("require", "module", "exports", code)(
      (name) => name.startsWith("@/") ? load(`${name.slice(2)}.ts`) : require(name), compiled, compiled.exports,
    );
    return compiled.exports;
  }
  return load;
}

function setup() {
  globalThis.indexedDB = new IDBFactory();
  const values = new Map();
  globalThis.window = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout, setInterval, clearInterval,
    location: { origin: "http://localhost" },
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
  const load = loader();
  return { db: load("src/lib/storage/db.ts"), queue: load("src/lib/syncQueue.ts"), storage: load("src/lib/memoStorage.ts") };
}

const memo = (id, extra = {}) => ({
  id, title: `메모 ${id}`, content: "오프라인 기록", tags: [], isPinned: false,
  createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z", syncStatus: "pending", ...extra,
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

test("오프라인 저장은 메모와 큐를 함께 기록하고 동일 내용의 배지 갱신은 다시 큐에 넣지 않는다", async () => {
  const { db, queue } = setup();
  await db.replaceAllMemos([memo("a")]);
  const database = await db.openMemoDatabase();
  const saved = (await db.getAllMemos())[0];
  const entry = await database.get("syncQueue", "a");
  assert.equal(saved.syncStatus, "pending");
  assert.equal(saved.syncRevision, entry.revision);
  let called = false;
  await queue.drainSyncQueue({ send: async () => { called = true; } }, new AbortController().signal, async () => {});
  assert.equal(called, false);
  await queue.settleSyncEntry(entry, true);
  await db.replaceAllMemos([memo("a")]);
  assert.equal((await db.getAllMemos())[0].syncStatus, "synced");
  assert.equal(await database.count("syncQueue"), 0);
  database.close();
});

test("이전 수정본의 늦은 성공 응답은 새로운 pending 수정본을 지우지 않는다", async () => {
  const { db, queue } = setup();
  await db.saveMemo(memo("a"));
  const database = await db.openMemoDatabase();
  const old = await database.get("syncQueue", "a");
  await db.saveMemo(memo("a", { content: "더 최신 수정" }));
  await queue.settleSyncEntry(old, true);
  const saved = (await db.getAllMemos())[0];
  assert.equal(saved.content, "더 최신 수정");
  assert.equal(saved.syncStatus, "pending");
  assert.notEqual(saved.syncRevision, old.revision);
  assert.equal(await database.count("syncQueue"), 1);
  database.close();
});

test("온라인 큐는 순차 전송하고 서버가 확인한 수정본만 synced로 만든다", async () => {
  const { db, queue } = setup();
  await db.replaceAllMemos([memo("a"), memo("b"), memo("c")]);
  navigator.onLine = true;
  let active = 0, maximum = 0;
  const sent = [];
  await queue.drainSyncQueue({ send: async (entry) => {
    active += 1; maximum = Math.max(maximum, active);
    await flush(); sent.push(entry.id); active -= 1;
    return { revision: entry.revision };
  } }, new AbortController().signal, async () => {});
  assert.equal(maximum, 1);
  assert.deepEqual(sent, ["a", "b", "c"]);
  assert((await db.getAllMemos()).every((item) => item.syncStatus === "synced"));
  (await db.openMemoDatabase()).close();
});

test("잘못된 확인 응답은 failed와 재시도 시각을 보존하고 재시도 성공 후 정리한다", async () => {
  const { db, queue } = setup();
  await db.saveMemo(memo("a"));
  navigator.onLine = true;
  await queue.drainSyncQueue({ send: async () => ({ revision: "wrong" }) }, new AbortController().signal, async () => {});
  const database = await db.openMemoDatabase();
  const entry = await database.get("syncQueue", "a");
  assert.equal((await db.getAllMemos())[0].syncStatus, "failed");
  assert.equal(entry.attempts, 1);
  assert(entry.nextAttemptAt > Date.now());
  await database.put("syncQueue", { ...entry, nextAttemptAt: 0 });
  await queue.drainSyncQueue({ send: async (item) => ({ revision: item.revision }) }, new AbortController().signal, async () => {});
  assert.equal(await database.count("syncQueue"), 0);
  database.close();
});

test("전송 중 삭제는 메모를 부활시키지 않고 삭제 큐를 보존한다", async () => {
  const { db, queue } = setup();
  await db.saveMemo(memo("a"));
  const database = await db.openMemoDatabase();
  const old = await database.get("syncQueue", "a");
  await db.deleteMemo("a");
  await queue.settleSyncEntry(old, true);
  assert.equal((await db.getAllMemos()).length, 0);
  assert.equal((await database.get("syncQueue", "a")).operation, "delete");
  database.close();
});

test("서버 미설정은 pending 유지, online 이벤트는 설정된 큐를 자동으로 재개한다", async () => {
  const { db, queue } = setup();
  await db.saveMemo(memo("a"));
  navigator.onLine = true;
  let stop = queue.startSyncQueue({ onChange() {}, onError: assert.fail });
  await flush(); stop();
  assert.equal((await db.getAllMemos())[0].syncStatus, "pending");
  navigator.onLine = false;
  stop = queue.startSyncQueue({ transport: { send: async (entry) => ({ revision: entry.revision }) }, onChange() {}, onError: assert.fail });
  await flush(); navigator.onLine = true; window.dispatchEvent(new Event("online"));
  await flush(); stop();
  assert.equal((await db.getAllMemos())[0].syncStatus, "synced");
  (await db.openMemoDatabase()).close();
});

test("모든 메모 삭제 후 재시작해도 기본 데이터가 부활하지 않는다", async () => {
  const { db, storage } = setup();
  await storage.hydrateMemoStorage([memo("default")]);
  await db.replaceAllMemos([]);
  assert.deepEqual(await storage.hydrateMemoStorage([memo("default")]), []);
  (await db.openMemoDatabase()).close();
});

test("버전 1 메모를 버전 2 영속 큐로 마이그레이션하고 다시 열어도 유지한다", async () => {
  const { db, storage } = setup();
  const { openDB } = require("idb");
  const legacy = await openDB("MemoOrbitDB", 1, { upgrade(database) { database.createObjectStore("memos", { keyPath: "id" }); } });
  const old = memo("legacy");
  delete old.syncStatus;
  await legacy.put("memos", old);
  legacy.close();
  const restored = await storage.hydrateMemoStorage([]);
  assert.equal(restored[0].syncStatus, "pending");
  const database = await db.openMemoDatabase();
  assert.equal(database.version, 2);
  const revision = (await database.get("syncQueue", "legacy")).revision;
  database.close();
  const reopened = await loader()("src/lib/storage/db.ts").openMemoDatabase();
  assert.equal((await reopened.get("syncQueue", "legacy")).revision, revision);
  reopened.close();
});

test("장애 백업이 남아 있으면 예전 DB를 전송하지 않고 최신 백업을 먼저 복구한다", async () => {
  const { db, storage, queue } = setup();
  await db.saveMemo(memo("a", { content: "예전 내용" }));
  window.localStorage.setItem(db.FALLBACK_MEMO_STORAGE_KEY, JSON.stringify([memo("a", { content: "최신 백업" })]));
  navigator.onLine = true;
  let sent = false;
  await queue.drainSyncQueue({ send: async () => { sent = true; } }, new AbortController().signal, async () => {});
  assert.equal(sent, false);
  const restored = await storage.hydrateMemoStorage([]);
  assert.equal(restored[0].content, "최신 백업");
  assert.equal(window.localStorage.getItem(db.FALLBACK_MEMO_STORAGE_KEY), null);
  (await db.openMemoDatabase()).close();
});

test("로컬 저장 실패 이후에도 다음 쓰기가 실행되고 대기 Promise가 영구 실패하지 않는다", async () => {
  const { db, storage } = setup();
  const originalReplace = db.replaceAllMemos;
  const originalSet = window.localStorage.setItem;
  const originalError = console.error;
  console.error = () => {};
  try {
    db.replaceAllMemos = async () => { throw new Error("저장 공간 없음"); };
    window.localStorage.setItem = () => { throw new Error("백업 공간 없음"); };
    await assert.rejects(storage.persistMemos([memo("a")]));
    db.replaceAllMemos = originalReplace;
    window.localStorage.setItem = originalSet;
    await storage.persistMemos([memo("b")]);
    assert.equal((await db.getAllMemos())[0].id, "b");
  } finally {
    console.error = originalError;
    db.replaceAllMemos = originalReplace;
    window.localStorage.setItem = originalSet;
    (await db.openMemoDatabase()).close();
  }
});

test("전송 도중 오프라인으로 전환되면 성공 배지를 만들지 않고 대기 기록을 남긴다", async () => {
  const { db, queue } = setup();
  await db.saveMemo(memo("a"));
  navigator.onLine = true;
  await queue.drainSyncQueue({ send: async (entry) => {
    navigator.onLine = false;
    return { revision: entry.revision };
  } }, new AbortController().signal, async () => {});
  assert.equal((await db.getAllMemos())[0].syncStatus, "pending");
  const database = await db.openMemoDatabase();
  assert.equal(await database.count("syncQueue"), 1);
  database.close();
});

test("240개 노드는 입력을 변경하지 않고 유한 좌표·6개 의미 클러스터로 배치된다", () => {
  const { createOrbitLayout, stepOrbitLayout } = loader()("src/lib/orbitClustering.ts");
  const memos = Array.from({ length: 240 }, (_, i) => memo(String(i), {
    links: [{ targetId: String(Math.floor(i / 40) * 40 + (i + 1) % 40), weight: 0.95 }],
  }));
  const original = JSON.stringify(memos);
  let layout = createOrbitLayout(memos);
  assert.equal(new Set(layout.nodes.map((node) => node.cluster)).size, 6);
  const started = performance.now();
  for (let i = 0; i < 180; i += 1) layout = stepOrbitLayout(layout);
  assert.equal(layout.nodes.length, 240);
  assert(layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assert.equal(JSON.stringify(memos), original);
  let within = 0, between = 0, withinCount = 0, betweenCount = 0;
  layout.nodes.forEach((a, i) => layout.nodes.slice(i + 1).forEach((b) => {
    const length = Math.hypot(a.x - b.x, a.y - b.y);
    if (a.cluster === b.cluster) { within += length; withinCount += 1; }
    else { between += length; betweenCount += 1; }
  }));
  assert(within / withinCount < between / betweenCount);
  console.log(`240 nodes / 180 steps: ${Math.round(performance.now() - started)}ms`);
});

test("AI 연결이 없으면 공통 태그 수에 따라 로컬 간선의 힘이 강해진다", () => {
  const { createOrbitLayout } = loader()("src/lib/orbitClustering.ts");
  const memos = [
    memo("a", { tags: ["개발", "기록"] }),
    memo("b", { tags: ["개발"] }),
    memo("c", { tags: ["개발", "기록"] }),
  ];
  const original = JSON.stringify(memos);
  const layout = createOrbitLayout(memos);
  const oneTagEdge = layout.edges.find((edge) => edge.source === 0 && edge.target === 1);
  const twoTagEdge = layout.edges.find((edge) => edge.source === 0 && edge.target === 2);

  assert.equal(oneTagEdge.isFallback, true);
  assert.equal(oneTagEdge.sharedTagCount, 1);
  assert.equal(twoTagEdge.sharedTagCount, 2);
  assert(twoTagEdge.weight > oneTagEdge.weight);
  assert.equal(JSON.stringify(memos), original);
});

test("태그 없는 메모는 작성일이 가장 가까운 메모와 미세 간선으로 연결된다", () => {
  const { createOrbitLayout } = loader()("src/lib/orbitClustering.ts");
  const layout = createOrbitLayout([
    memo("a", { createdAt: "2026-09-01T00:00:00Z" }),
    memo("b", { createdAt: "2026-09-09T00:00:00Z" }),
    memo("c", { createdAt: "2026-09-10T00:00:00Z" }),
  ]);
  const nearbyEdge = layout.edges.find((edge) => edge.source === 1 && edge.target === 2);

  assert.equal(nearbyEdge.isFallback, true);
  assert.equal(nearbyEdge.weight, 0.58);
  assert.equal(nearbyEdge.sharedTagCount, 0);
});

test("고정 여부와 본문 길이와 태그 수가 성운 노드 크기에 반영된다", () => {
  const { createOrbitLayout } = loader()("src/lib/orbitClustering.ts");
  const layout = createOrbitLayout([
    memo("normal"),
    memo("tagged", { content: "긴 본문 ".repeat(30), tags: ["개발", "기록"] }),
    memo("pinned", { isPinned: true }),
  ]);
  const radiusById = new Map(layout.nodes.map((node) => [node.id, node.radius]));

  assert(radiusById.get("tagged") > radiusById.get("normal"));
  assert(radiusById.get("pinned") > radiusById.get("normal"));
});

test("LOD 클러스터 레이블은 가장 많이 등장한 태그와 메모 수를 제공한다", () => {
  const { createOrbitLayout, getOrbitClusterSummaries } = loader()("src/lib/orbitClustering.ts");
  const layout = createOrbitLayout([
    memo("a", { tags: ["개발", "기록"] }),
    memo("b", { tags: ["개발"] }),
    memo("c", { tags: ["개발", "여행"] }),
  ]);
  const clusters = getOrbitClusterSummaries(layout);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].label, "개발");
  assert.equal(clusters[0].memberIds.length, 3);
  assert(Number.isFinite(clusters[0].x));
  assert(Number.isFinite(clusters[0].y));
  assert(clusters[0].radius > 0);
});

test("높은 유사도는 가까운 거리, 낮은 유사도는 먼 거리로 안정화된다", () => {
  const { stepOrbitLayout } = loader()("src/lib/orbitClustering.ts");
  const separation = (weight) => {
    let layout = { nodes: [
      { id: "a", cluster: "a", x: -80, y: 0, vx: 0, vy: 0 },
      { id: "b", cluster: "b", x: 80, y: 0, vx: 0, vy: 0 },
    ], edges: [{ source: 0, target: 1, weight }], iteration: 0 };
    for (let i = 0; i < 180; i += 1) layout = stepOrbitLayout(layout);
    return Math.abs(layout.nodes[1].x - layout.nodes[0].x);
  };
  assert(separation(0.95) < separation(0.6));
  assert(separation(0.6) < separation(0.1));
});

test("핀치 확대와 두 손가락 이동은 중점 아래 좌표를 보존하며 확대 한계를 지킨다", () => {
  const { zoomOrbitAt } = loader()("src/lib/orbitClustering.ts");
  const initial = { x: 10, y: 20, scale: 1 };
  const previous = { x: 50, y: 70 }, next = { x: 80, y: 90 };
  const zoomed = zoomOrbitAt(initial, previous, next, 2);
  assert.equal((previous.x - initial.x) / initial.scale, (next.x - zoomed.x) / zoomed.scale);
  assert.equal((previous.y - initial.y) / initial.scale, (next.y - zoomed.y) / zoomed.scale);
  assert.equal(zoomOrbitAt(initial, previous, next, 100).scale, 4);
  assert.equal(zoomOrbitAt(initial, previous, next, 0.001).scale, 0.12);
});
