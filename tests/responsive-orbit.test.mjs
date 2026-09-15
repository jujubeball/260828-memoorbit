import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import ts from "typescript";
import { JSDOM } from "jsdom";
import React, { act } from "react";

const require = createRequire(import.meta.url);
function loader() {
  const cache = new Map();
  function load(file) {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path).exports;
    const compiled = { exports: {} };
    cache.set(path, compiled);
    const code = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function("require", "module", "exports", code)((name) => {
      if (!name.startsWith("@/")) return require(name);
      const source = name.slice(2);
      return load(existsSync(`${source}.ts`) ? `${source}.ts` : `${source}.tsx`);
    }, compiled, compiled.exports);
    return compiled.exports;
  }
  return load;
}

const memo = (id) => ({ id, title: `메모 ${id}`, content: "본문", tags: ["공통"], isPinned: false,
  syncStatus: "pending", createdAt: "2026-09-15T00:00:00Z", updatedAt: "2026-09-15T00:00:00Z" });

test("확대만으로 제목이 나타나지 않고 선택·호버와 1단계 이웃만 밝게 표시된다", () => {
  const load = loader();
  const { drawOrbitCanvas } = load("src/lib/orbitCanvas.ts");
  globalThis.window = { devicePixelRatio: 1 };
  const texts = [];
  const circles = [];
  const context = new Proxy({
    globalAlpha: 1,
    fillText(text, x, y) { texts.push({ text, x, y, alpha: this.globalAlpha }); },
    arc(x, y, radius) { if (radius === 8) circles.push({ x, y, alpha: this.globalAlpha }); },
    measureText(text) { return { width: text.length * 5 }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
  }, { get(target, name) { return name in target ? target[name] : () => {}; } });
  const canvas = { width: 0, height: 0, getContext: () => context,
    getBoundingClientRect: () => ({ width: 800, height: 600 }) };
  const layout = {
    iteration: 180,
    nodes: ["a", "b", "c", "d"].map((id, index) => ({ ...memo(id), radius: 8,
      x: index * 150, y: index * 60, cluster: id, vx: 0, vy: 0 })),
    edges: [{ source: 0, target: 1, weight: 0.9, sharedTagCount: 1 },
      { source: 1, target: 2, weight: 0.9, sharedTagCount: 1 }],
  };
  const transform = { x: 0, y: 0, scale: 4 };
  drawOrbitCanvas(canvas, layout, transform);
  assert.equal(texts.length, 0);
  circles.length = 0;
  drawOrbitCanvas(canvas, layout, transform, 1, "a", null, null, 0.5);
  assert.deepEqual(texts.map((entry) => entry.text), ["메모 a", "메모 b"]);
  assert(texts.every((entry) => entry.alpha === 0.5));
  assert.equal(circles[2].alpha, 0.15);
  texts.length = 0;
  drawOrbitCanvas(canvas, layout, transform, 1, "a", null, "d", 1);
  assert.deepEqual(new Set(texts.map((entry) => entry.text)), new Set(["메모 a", "메모 b", "메모 d"]));
  texts.length = 0;
  // 연결된 두 제목의 화면 영역이 겹치면 우선 선택한 제목 하나만 남습니다.
  layout.nodes[1].x = layout.nodes[0].x;
  layout.nodes[1].y = layout.nodes[0].y;
  drawOrbitCanvas(canvas, layout, transform, 1, "a");
  assert.deepEqual(texts.map((entry) => entry.text), ["메모 a"]);
});

test("밀집 성운의 노드가 분산되고 호버 탐색은 확대·이동 좌표와 빈 영역을 구분한다", () => {
  const { createOrbitLayout, stepOrbitLayout, findOrbitNodeAtPoint } = loader()("src/lib/orbitClustering.ts");
  const source = Array.from({ length: 80 }, (_, index) => memo(String(index)));
  const original = JSON.stringify(source);
  let layout = createOrbitLayout(source);
  for (let index = 0; index < 180; index += 1) layout = stepOrbitLayout(layout);
  let minimumGap = Infinity;
  for (let i = 0; i < layout.nodes.length; i += 1) {
    for (let j = i + 1; j < layout.nodes.length; j += 1) {
      const a = layout.nodes[i];
      const b = layout.nodes[j];
      minimumGap = Math.min(minimumGap, Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius);
    }
  }
  assert(minimumGap >= 16, `최소 원 사이 여백: ${minimumGap}`);
  const node = layout.nodes[0];
  const transform = { x: 30, y: -20, scale: 3 };
  assert.equal(findOrbitNodeAtPoint(layout, transform, { x: node.x * 3 + 30, y: node.y * 3 - 20 }), node.id);
  assert.equal(findOrbitNodeAtPoint(layout, transform, { x: 100000, y: 100000 }), null);
  assert.equal(JSON.stringify(source), original);
});

test("목록 배지·우클릭 세 작업·터치 스와이프와 취소를 기존 콜백으로 전달한다", async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: "http://localhost" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const { MemoCard } = loader()("src/components/MemoCard.tsx");
  const root = createRoot(document.getElementById("root"));
  const calls = [];
  let status = "pending";
  let isSwipeOpen = false;
  const render = () => root.render(React.createElement(MemoCard, {
    memo: { ...memo("a"), syncStatus: status }, isSwipeOpen,
    onEdit: () => calls.push("편집"), onEditTags: () => calls.push("태그"),
    onDelete: () => calls.push("삭제"), onTogglePin: () => calls.push("고정"),
    onSwipeOpenChange: (value) => { isSwipeOpen = value; render(); },
  }));
  const dispatch = async (element, event) => act(async () => { element.dispatchEvent(event); });
  try {
    await act(async () => render());
    assert(!document.body.textContent.includes("전송 대기"));
    assert.equal(document.querySelector('[role="img"]'), null);
    status = "failed";
    await act(async () => render());
    assert(document.querySelector('[role="img"]').getAttribute("aria-label").includes("동기화 실패"));
    status = "synced";
    await act(async () => render());
    assert.equal(document.querySelector('[role="img"]'), null);
    const article = document.querySelector("article");
    for (const label of ["고정", "태그 변경", "삭제"]) {
      const event = new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 400, clientY: 500 });
      await dispatch(article, event);
      assert.equal(event.defaultPrevented, true);
      assert.equal(document.querySelector('[role="menu"]').parentElement, document.body);
      const action = [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent.includes(label));
      await act(async () => action.click());
      assert.equal(document.querySelector('[role="menu"]'), null);
    }
    assert.deepEqual(calls, ["고정", "태그", "삭제"]);
    calls.length = 0;
    let captured = false;
    article.setPointerCapture = () => { captured = true; };
    article.hasPointerCapture = () => captured;
    article.releasePointerCapture = () => { captured = false; };
    article.parentElement.getBoundingClientRect = () => ({ width: 300 });
    const pointer = (type, x, y = 0, pointerType = "touch") => {
      const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
      Object.defineProperties(event, { pointerType: { value: pointerType }, pointerId: { value: 1 }, isPrimary: { value: true } });
      return dispatch(article, event);
    };
    await pointer("pointerdown", 0);
    await pointer("pointermove", 90);
    await pointer("pointerup", 90);
    assert.equal(article.style.transform, "translateX(74px)");
    assert.deepEqual(calls, []);
    await pointer("pointerdown", 0);
    await pointer("pointermove", 250);
    await pointer("pointercancel", 250);
    assert.deepEqual(calls, []);
    assert.equal(article.style.transform, "translateX(0px)");
    await pointer("pointerdown", 200);
    await pointer("pointermove", 120);
    await pointer("pointerup", 120);
    assert.equal(article.style.transform, "translateX(-74px)");
    await act(async () => document.querySelector('button[aria-label="메모 a 삭제"]').click());
    assert.deepEqual(calls, ["삭제"]);
    calls.length = 0;
    await pointer("pointerdown", 0);
    await pointer("pointermove", 20, 100);
    await pointer("pointerup", 20, 100);
    assert.equal(article.style.transform, "translateX(0px)");
    await pointer("pointerdown", 0, 0, "mouse");
    assert.equal(captured, false);
    await pointer("pointerdown", 0);
    await pointer("pointermove", 250);
    await pointer("pointerup", 250);
    assert.deepEqual(calls, ["고정"]);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("캔버스 우클릭은 해당 노드의 작업을 실행하고 태그 편집 진입 시 입력 패널이 열린다", async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: "http://localhost" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  for (const name of ["HTMLElement", "Element", "HTMLInputElement", "HTMLTableCellElement"]) {
    globalThis[name] = dom.window[name];
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  window.matchMedia = () => ({ matches: true });
  window.scrollTo = () => {};
  // 실제 프레임 대신 초기 배치 좌표로 노드 적중과 메뉴 연결을 검증합니다.
  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  dom.window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  const load = loader();
  const { OrbitGraphView } = load("src/components/OrbitGraphView.tsx");
  const { MemoModal } = load("src/components/MemoModal.tsx");
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  const calls = [];
  const selected = memo("선택");
  try {
    await act(async () => root.render(React.createElement(OrbitGraphView, {
      memos: [selected], onOpenMemo() {}, onLinksAnalyzed() {},
      onTogglePin: (id) => calls.push(["고정", id]),
      onDelete: (item) => calls.push(["삭제", item.id]),
      onEditTags: (item) => calls.push(["태그", item.id]),
    })));
    const canvas = document.querySelector("canvas");
    for (const label of ["고정", "태그 변경", "삭제"]) {
      await act(async () => canvas.dispatchEvent(new dom.window.MouseEvent("contextmenu", {
        bubbles: true, cancelable: true, clientX: 400, clientY: 300,
      })));
      const button = [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent.includes(label));
      assert(button);
      await act(async () => button.click());
    }
    assert.deepEqual(calls, [["고정", "선택"], ["태그", "선택"], ["삭제", "선택"]]);
    await act(async () => canvas.dispatchEvent(new dom.window.MouseEvent("contextmenu", {
      bubbles: true, cancelable: true, clientX: 10, clientY: 10,
    })));
    assert.equal(document.querySelector('[role="menu"]'), null);
    await act(async () => root.render(React.createElement(MemoModal, {
      isOpen: true, editingMemo: selected, openTagsInitially: true, onClose() {}, onSubmit() {},
    })));
    const input = document.querySelector("#memo-tag-panel input");
    assert(input);
    assert.equal(input.value, "공통");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
