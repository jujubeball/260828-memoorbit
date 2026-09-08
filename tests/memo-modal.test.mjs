import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import ts from "typescript";
import { JSDOM } from "jsdom";
import React, { act } from "react";

const require = createRequire(import.meta.url);
function loadModal() {
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
      if (name.endsWith("geminiClient")) return { requestRecommendedTags: async () => ["인사", "기록"] };
      if (!name.startsWith("@/")) return require(name);
      const source = name.slice(2);
      return load(existsSync(`${source}.ts`) ? `${source}.ts` : `${source}.tsx`);
    }, compiled, compiled.exports);
    return compiled.exports;
  }
  return load("src/components/MemoModal.tsx").MemoModal;
}

test("태그 통합·부분 서식·키보드 갱신 동안 편집 DOM과 선택이 유지된다", async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: "http://localhost" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.scrollTo = () => {};
  Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
  const viewport = Object.assign(new dom.window.EventTarget(), { height: 700, offsetTop: 0 });
  Object.defineProperty(dom.window, "visualViewport", { value: viewport });
  const { createRoot } = await import("react-dom/client");
  const MemoModal = loadModal();
  const root = createRoot(document.getElementById("root"));
  const initial = { id: "test", title: "안녕 테스트", content: "본문", tags: [], isPinned: false, syncStatus: "pending", createdAt: "2026-09-08T00:00:00Z", updatedAt: "2026-09-08T00:00:00Z" };
  try {
    await act(async () => { root.render(React.createElement(MemoModal, { isOpen: true, editingMemo: initial, onClose() {}, onSubmit() {} })); });
    const editor = document.querySelector('[aria-label="메모 내용"]');
    const node = editor.firstChild.firstChild;
    const button = (label) => [...document.querySelectorAll("button")].find((item) => item.getAttribute("aria-label") === label || item.textContent.trim() === label);
    const click = async (target) => {
      assert(target);
      await act(async () => {
        target.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
        target.click();
      });
    };
    editor.focus();
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 2);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(range);
    document.dispatchEvent(new dom.window.Event("selectionchange"));
    await click(button("텍스트 서식"));
    assert.equal(editor.firstChild.firstChild, node);
    await click(button("굵게"));
    assert.equal(editor.querySelector("strong").textContent, "안녕");
    assert.equal(editor.firstChild.textContent, "안녕 테스트");
    const formatted = editor.innerHTML;
    await click(button("태그 관리"));
    const panel = document.getElementById("memo-tag-panel");
    assert(panel.querySelector("input"));
    assert(panel.querySelector('[aria-label="AI 추천 태그"]'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 340)); });
    await click([...panel.querySelectorAll("button")].find((item) => item.textContent.includes("인사")));
    assert.equal(panel.querySelector("input").value, "인사");
    assert.equal(editor.innerHTML, formatted);
    viewport.height = 350;
    await act(async () => {
      viewport.dispatchEvent(new dom.window.Event("resize"));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.equal(editor.innerHTML, formatted);
    const shell = document.querySelector('[role="dialog"]');
    assert(shell.classList.contains("touch-none"));
    assert(shell.querySelector("header").classList.contains("shrink-0"));
    assert(!shell.querySelector("header").classList.contains("sticky"));
    assert(editor.parentElement.classList.contains("overflow-y-auto"));
    assert(editor.parentElement.classList.contains("touch-pan-y"));
    assert.equal(shell.style.getPropertyValue("--viewport-height"), "350px");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
