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
  const initial = { id: "test", title: "안녕 테스트", richContent: "<p>안녕 테스트</p>", content: "본문", tags: [], isPinned: false, syncStatus: "pending", createdAt: "2026-09-08T00:00:00Z", updatedAt: "2026-09-08T00:00:00Z", images: [{ url: "data:image/png;base64,AA==", name: "사진" }] };
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
    const sheet = document.getElementById("memo-format-sheet");
    assert.equal(document.querySelectorAll('[aria-label="서식 도구"]').length, 1);
    assert.equal(sheet.querySelectorAll('[role="group"]').length, 3);
    assert.equal(sheet.querySelectorAll('button').length, 13);
    assert.equal(sheet.querySelector('[aria-label="문단 스타일"]').textContent.includes("모노스페이스"), true);
    assert.equal(sheet.closest("form").id, "memo-form");
    await click(button("굵게"));
    assert.equal(button("굵게").getAttribute("aria-pressed"), "true");
    assert.equal(editor.querySelector("strong").textContent, "안녕");
    assert.equal(editor.firstChild.textContent, "안녕 테스트");
    await click(button("굵게"));
    assert.equal(button("굵게").getAttribute("aria-pressed"), "false");
    assert.equal(editor.textContent, "안녕 테스트");
    await click(button("굵게"));
    assert.equal(button("굵게").getAttribute("aria-pressed"), "true");
    const formatted = editor.innerHTML;
    await click(button("태그 관리"));
    assert.equal(document.getElementById("memo-format-sheet"), null);
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
    // 스와이프가 보내는 가시 영역 이동은 모달 위치·높이를 다시 계산하지 않아야 합니다.
    viewport.offsetTop = 16;
    viewport.height = 349;
    await act(async () => {
      for (let index = 0; index < 10; index += 1) viewport.dispatchEvent(new dom.window.Event("scroll"));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.equal(shell.style.getPropertyValue("--viewport-top"), "0px");
    assert.equal(shell.style.getPropertyValue("--viewport-height"), "350px");
    assert(shell.classList.contains("overscroll-none"));
    await click(button("텍스트 서식"));
    assert.equal(document.getElementById("memo-tag-panel"), null);
    await click(button("텍스트 서식"));
    assert.equal(document.getElementById("memo-format-sheet"), null);
    const image = document.querySelector("figure img");
    assert(image.classList.contains("w-full"));
    assert(image.classList.contains("h-auto"));
    assert(image.classList.contains("max-h-[300px]"));
    // 실제 React 키 이벤트와 모바일 beforeinput 경로도 같은 체크리스트 분기를 사용합니다.
    await click(button("체크리스트"));
    let checklistText = editor.querySelector(".memo-check-text");
    checklistText.textContent = "할 일";
    let caret = document.createRange();
    caret.selectNodeContents(checklistText);
    caret.collapse(false);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(caret);
    await act(async () => {
      const enter = new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      editor.dispatchEvent(enter);
      assert(enter.defaultPrevented);
    });
    assert.equal(editor.querySelectorAll(".memo-check-item").length, 2);
    await act(async () => {
      const enter = new dom.window.InputEvent("beforeinput", { inputType: "insertParagraph", bubbles: true, cancelable: true });
      editor.dispatchEvent(enter);
      assert(enter.defaultPrevented);
    });
    assert.equal(editor.querySelectorAll(".memo-check-item").length, 1);
    checklistText = editor.querySelector(".memo-check-text");
    caret = document.createRange();
    caret.selectNodeContents(checklistText);
    caret.collapse(false);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(caret);
    await act(async () => {
      const imeEnter = new dom.window.KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true });
      editor.dispatchEvent(imeEnter);
      assert.equal(imeEnter.defaultPrevented, false);
    });
    assert.equal(editor.querySelectorAll(".memo-check-item").length, 1);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
