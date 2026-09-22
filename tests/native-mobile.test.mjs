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

function setup() {
  const dom = new JSDOM('<input id="search"><div id="root"></div><canvas id="outside"></canvas>', {
    pretendToBeVisual: true, url: "http://localhost",
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  for (const name of ["HTMLElement", "Element", "SVGElement", "HTMLInputElement", "Node"]) globalThis[name] = dom.window[name];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  return dom;
}

const memo = {
  id: "a", title: "모바일 메모", content: "첫 번째 문장\n두 번째 문장도 요약에 포함합니다.",
  tags: ["기록", "생각"], isPinned: false, syncStatus: "pending",
  createdAt: "2026-01-02T00:00:00Z", updatedAt: "2026-09-15T00:00:00Z",
};

test("하단 세 탭은 현재 화면을 표시하고 입력·편집 중 숨겨졌다가 복원된다", async () => {
  const dom = setup();
  const { createRoot } = await import("react-dom/client");
  const { BottomNavigation } = loader()("src/components/layout/BottomNavigation.tsx");
  const root = createRoot(document.getElementById("root"));
  let current = "memos";
  const render = (hidden = false) => root.render(React.createElement(BottomNavigation, {
    activeSection: current, hidden, onSelect(section) { current = section; render(); },
  }));
  try {
    await act(async () => render());
    assert.equal(document.querySelectorAll("nav button").length, 3);
    await act(async () => document.querySelectorAll("nav button")[1].click());
    assert.equal(current, "orbit");
    assert(document.querySelector('[aria-current="page"]').textContent.includes("태그 궤도"));
    await act(async () => document.getElementById("search").focus());
    assert.equal(document.querySelector("nav"), null);
    await act(async () => document.getElementById("search").blur());
    assert(document.querySelector("nav"));
    await act(async () => render(true));
    assert.equal(document.querySelector("nav"), null);
    await act(async () => render(false));
    assert(document.querySelector("nav"));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("텍스트 목록은 제목과 날짜·본문 두 행을 표시하고 태그는 PC 갤러리에 남긴다", async () => {
  const dom = setup();
  const { createRoot } = await import("react-dom/client");
  const { MemoCard } = loader()("src/components/MemoCard.tsx");
  const root = createRoot(document.getElementById("root"));
  const props = { memo: { ...memo, imageUrl: "https://example.test/photo.jpg" }, onEdit() {}, onEditTags() {},
    onDelete() {}, onTogglePin() {}, isSwipeOpen: false, onSwipeOpenChange() {} };
  try {
    await act(async () => root.render(React.createElement(MemoCard, props)));
    assert.equal(document.querySelector("img"), null);
    const article = document.querySelector("article");
    assert(article.querySelector("p").textContent.includes("두 번째 문장"));
    assert(article.querySelector("p").classList.contains("truncate"));
    assert(article.querySelector("h3").classList.contains("truncate"));
    assert.equal(article.querySelector("time").parentElement, article.querySelector("p").parentElement);
    assert.equal(article.querySelector("time").dateTime, memo.createdAt);
    assert.equal(article.textContent.includes("#기록"), false);
    await act(async () => root.render(React.createElement(MemoCard, { ...props, memo, viewMode: "gallery" })));
    assert.equal(document.querySelector("img"), null);
    assert(document.querySelector("article").textContent.includes("#기록"));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("실제 Motion 포인터 제스처는 시트를 확장·축소·취소·닫기하고 캔버스 입력을 통과시킨다", async () => {
  const dom = setup();
  const { createRoot } = await import("react-dom/client");
  const { OrbitDetailSheet, resolveSheetSnap } = loader()("src/components/orbit/OrbitDetailSheet.tsx");
  const root = createRoot(document.getElementById("root"));
  document.getElementById("root").getBoundingClientRect = () => ({ height: 600 });
  const opened = [];
  let closes = 0;
  let canvasInputs = 0;
  const outside = document.getElementById("outside");
  outside.addEventListener("pointerdown", () => { canvasInputs += 1; });
  const waitFrame = () => new Promise((resolve) => setTimeout(resolve, 40));
  const pointer = async (target, type, y) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y, clientX: 100, button: 0 });
    Object.defineProperties(event, { pointerType: { value: "touch" }, isPrimary: { value: true }, pointerId: { value: 1 } });
    await act(async () => { target.dispatchEvent(event); await waitFrame(); });
    return event;
  };
  try {
    await act(async () => root.render(React.createElement(OrbitDetailSheet, {
      memos: [memo], selectedId: memo.id, viewportHeight: 800,
      onOpenMemo: (item) => opened.push(item.id), onClose: () => { closes += 1; },
    })));
    const sheet = document.querySelector('[aria-label="성운 메모 상세 시트"]');
    const handle = sheet.querySelector("button");
    assert.equal(sheet.dataset.snap, "40");
    assert.equal(sheet.style.height, "320px");
    assert.equal(sheet.getAttribute("aria-modal"), null);
    assert.equal(sheet.querySelector("img"), null);
    await pointer(handle, "pointerdown", 300);
    await pointer(window, "pointermove", 100);
    await pointer(window, "pointerup", 100);
    assert.equal(sheet.dataset.snap, "85");
    await pointer(handle, "pointerdown", 100);
    await pointer(window, "pointermove", 300);
    await pointer(window, "pointercancel", 300);
    assert.equal(sheet.dataset.snap, "85");
    assert.equal(closes, 0);
    await pointer(handle, "pointerdown", 100);
    await pointer(window, "pointermove", 300);
    await pointer(window, "pointerup", 300);
    assert.equal(sheet.dataset.snap, "40");
    await pointer(handle, "pointerdown", 100);
    await pointer(window, "pointermove", 300);
    await pointer(window, "pointerup", 300);
    assert.equal(closes, 1);
    await act(async () => document.querySelector("#orbit-sheet-memos button").click());
    assert.deepEqual(opened, [memo.id]);
    const event = await pointer(outside, "pointerdown", 30);
    assert.equal(event.defaultPrevented, false);
    assert.equal(canvasInputs, 1);
    assert.equal(closes, 2);
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" })));
    assert.equal(closes, 3);
    assert.equal(resolveSheetSnap(40, 0, -500), 85);
    assert.equal(resolveSheetSnap(85, 0, 500), 40);
    assert.equal(resolveSheetSnap(40, 5, 0), 40);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
