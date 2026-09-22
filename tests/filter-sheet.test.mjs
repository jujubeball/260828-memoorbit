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

test("500개 태그 검색·선택 요약·날짜 역전 교정·전체 초기화", async () => {
  const dom = setup();
  const { createRoot } = await import("react-dom/client");
  const { SearchFilterBar } = loader()("src/components/SearchFilterBar.tsx");
  const root = createRoot(document.getElementById("root"));
  const availableTags = Array.from({ length: 500 }, (_, index) => `태그${String(index).padStart(3, "0")}`);
  let options = { keyword: "검색 유지", tags: availableTags.slice(0, 17), hasImage: true, timePreset: "custom", customDateRange: { start: "2026-09-01", end: "2026-09-17" } };
  const render = () => root.render(React.createElement(SearchFilterBar, {
    options, availableTags, onOptionsChange(next) { options = next; render(); }, onCreateMemo() {},
  }));
  const click = async (button) => act(async () => button.click());
  const change = async (input, value) => act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  try {
    await act(async () => render());
    await click(document.querySelector('[aria-controls="advanced-search-filters"]'));
    const summary = document.querySelector('[aria-label="선택한 필터"]');
    const startBox = document.getElementById("search-filter-start-date").parentElement;
    const endBox = document.getElementById("search-filter-end-date").parentElement;
    assert.match(startBox.textContent, /2026\.09\.01/);
    assert.match(endBox.textContent, /2026\.09\.17/);
    assert.equal(document.getElementById("search-filter-end-date").value, "2026-09-17");
    assert.match(summary.textContent, /선택된 필터 \(19개\)/);
    assert.match(summary.textContent, /태그 17개, 사진 포함, 기간 지정/);
    assert.equal(summary.querySelectorAll("button").length, 1);
    const results = document.getElementById("filter-tag-results");
    assert.equal(results.querySelectorAll("button").length, 6);
    await change(document.querySelector('[placeholder="태그 검색"]'), "태그499");
    assert.match(results.textContent, /태그499/);
    assert.equal(results.querySelectorAll("button").length, 2);
    await click([...results.querySelectorAll("button")].find((button) => button.textContent.includes("태그499")));
    assert(options.tags.includes("태그499"));
    await click([...results.querySelectorAll("button")].find((button) => button.textContent.includes("태그499")));
    assert(!options.tags.includes("태그499"));
    await change(document.querySelector('[placeholder="태그 검색"]'), "없는 태그");
    assert.match(document.querySelector('[aria-controls="filter-tag-results"]').parentElement.nextElementSibling.textContent, /검색 결과 0개/);
    await change(document.getElementById("search-filter-start-date"), "2026-09-22");
    assert.equal(options.customDateRange.end, "2026-09-22");
    assert.match(document.querySelector('[role="status"]').textContent, /종료일/);
    await change(document.getElementById("search-filter-end-date"), "2026-09-10");
    assert.equal(options.customDateRange.end, "2026-09-22");
    await click([...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "전체 초기화"));
    assert.deepEqual(options.tags, []);
    assert.equal(options.keyword, "검색 유지");
    assert.equal(options.timePreset, "all");
    assert.equal(options.hasImage, undefined);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("목록 도킹 검색은 입력·음성 결과를 반영하고 편집기 진입 시 숨긴다", async () => {
  const dom = setup();
  const { createRoot } = await import("react-dom/client");
  const { SearchFilterBar } = loader()("src/components/SearchFilterBar.tsx");
  const root = createRoot(document.getElementById("root"));
  let options = {};
  let creates = 0;
  let hidden = false;
  const render = () => root.render(React.createElement(SearchFilterBar, { options, availableTags: [], hideMobileDock: hidden,
    onOptionsChange(next) { options = next; render(); }, onCreateMemo() { creates += 1; } }));
  try {
    await act(async () => render());
    const dock = document.querySelector('[aria-label="목록 검색 및 작성"]');
    assert(dock);
    assert.equal(dock.style.getPropertyValue("--list-dock-bottom"), "var(--mobile-nav-height)");
    await act(async () => dock.querySelector("input").focus());
    assert.match(dock.style.getPropertyValue("--list-dock-bottom"), /^\d+px$/);
    await act(async () => dock.querySelector("input").blur());
    assert.equal(dock.style.getPropertyValue("--list-dock-bottom"), "var(--mobile-nav-height)");
    assert.equal(dock.querySelectorAll("button").length, 2);
    assert.equal(document.querySelectorAll('[aria-label="새 메모 작성"]').length, 1);
    await act(async () => dock.querySelector('[aria-label="음성 검색"]').click());
    assert.match(dock.textContent, /지원하지 않습니다/);
    const sessions = [];
    let aborted = false;
    window.SpeechRecognition = class {
      constructor() { sessions.push(this); }
      start() {}
      stop() { this.onend?.(); }
      abort() { aborted = true; }
    };
    await act(async () => dock.querySelector('[aria-label="음성 검색"]').click());
    const recognition = sessions[0];
    assert.equal(recognition.lang, "ko-KR");
    await act(async () => recognition.onresult({ results: [[{ transcript: "아이디어" }]] }));
    assert.equal(dock.querySelector("input").value, "아이디어");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 340)));
    assert.equal(options.keyword, "아이디어");
    await act(async () => dock.querySelector('[aria-label="새 메모 작성"]').click());
    assert.equal(creates, 1);
    hidden = true;
    await act(async () => render());
    assert.equal(document.querySelector('[aria-label="목록 검색 및 작성"]'), null);
    assert(aborted);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
