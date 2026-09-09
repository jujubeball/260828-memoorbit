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
  globalThis.Element = dom.window.Element;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLTableCellElement = dom.window.HTMLTableCellElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(dom.window, "scrollY", { value: 240, writable: true });
  dom.window.scrollTo = ({ top }) => { dom.window.scrollY = top; };
  Object.defineProperty(dom.window, "innerHeight", { value: 700, writable: true });
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
    viewport.height = 350;
    await click(button("텍스트 서식"));
    assert.equal(editor.firstChild.firstChild, node);
    assert.notEqual(document.activeElement, editor);
    assert.equal(editor.getAttribute("contenteditable"), "false");
    assert.equal(document.getElementById("memo-format-sheet"), null);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 380)); });
    assert.equal(document.getElementById("memo-format-sheet"), null);
    // 키보드가 내려오면서 높이가 복원된 뒤에도 안정화 시간을 기다려 시트를 엽니다.
    viewport.height = 700;
    await act(async () => {
      viewport.dispatchEvent(new dom.window.Event("resize"));
      await new Promise((resolve) => setTimeout(resolve, 190));
    });
    const sheet = document.getElementById("memo-format-sheet");
    assert.equal(document.querySelectorAll('[aria-label="서식 도구"]').length, 1);
    assert.equal(sheet.querySelectorAll('[role="group"]').length, 3);
    assert.equal(sheet.querySelectorAll('button').length, 13);
    assert.equal(sheet.querySelector('[aria-label="문단 스타일"]').textContent.includes("모노스페이스"), true);
    assert.equal(sheet.closest("form").id, "memo-form");
    await click(button("굵게"));
    assert.notEqual(document.activeElement, editor);
    assert.equal(editor.getAttribute("contenteditable"), "false");
    assert.equal(button("굵게").getAttribute("aria-pressed"), "true");
    assert.equal(editor.querySelector("strong").textContent, "안녕");
    assert.equal(editor.firstChild.textContent, "안녕 테스트");
    await click(button("굵게"));
    assert.equal(button("굵게").getAttribute("aria-pressed"), "false");
    assert.equal(editor.textContent, "안녕 테스트");
    await click(button("굵게"));
    assert.equal(button("굵게").getAttribute("aria-pressed"), "true");
    const formatted = editor.innerHTML;
    // 본문 터치는 읽기 상태를 즉시 해제하고 키보드 진입용 포커스를 되돌립니다.
    await click(editor);
    assert.equal(document.getElementById("memo-format-sheet"), null);
    assert.equal(editor.getAttribute("contenteditable"), "true");
    assert.equal(document.activeElement, editor);
    assert.equal(editor.innerHTML, formatted);
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
    const toolbar = shell.querySelector('[role="toolbar"]');
    assert(toolbar.classList.contains("overflow-x-auto"));
    assert(toolbar.classList.contains("touch-pan-x"));
    assert(toolbar.classList.contains("whitespace-nowrap"));
    assert.equal(toolbar.querySelectorAll("button").length, 5);
    assert.deepEqual([...toolbar.querySelectorAll("button")].map((item) => item.getAttribute("aria-label")), [
      "텍스트 서식", "체크리스트", "표 삽입", "사진 또는 파일 첨부", "태그 관리",
    ]);
    assert.deepEqual([...shell.querySelector("header").children].map((item) => item.tagName), ["BUTTON", "H2", "BUTTON"]);
    assert.equal(shell.querySelector("header").firstElementChild.textContent, "저장");
    assert.equal(shell.querySelector("header").lastElementChild.textContent, "닫기");
    assert([...toolbar.querySelectorAll("button")].every((item) => item.classList.contains("shrink-0")));
    editor.parentElement.scrollTop = 80;
    toolbar.scrollLeft = 90;
    const form = shell.querySelector("form");
    form.scrollTop = 42;
    await act(async () => {
      form.dispatchEvent(new dom.window.Event("scroll"));
      editor.parentElement.dispatchEvent(new dom.window.Event("scroll"));
      toolbar.dispatchEvent(new dom.window.Event("scroll"));
      document.documentElement.scrollTop = 30;
      dom.window.scrollY = 30;
      dom.window.dispatchEvent(new dom.window.Event("scroll"));
    });
    assert.equal(form.scrollTop, 0);
    assert.equal(document.documentElement.scrollTop, 0);
    assert.equal(dom.window.scrollY, 0);
    assert.equal(editor.parentElement.scrollTop, 80);
    assert.equal(toolbar.scrollLeft, 90);
    await click(button("텍스트 서식"));
    assert.equal(document.getElementById("memo-tag-panel"), null);
    await click(button("텍스트 서식"));
    assert.equal(document.getElementById("memo-format-sheet"), null);
    viewport.height = 700;
    await act(async () => {
      viewport.dispatchEvent(new dom.window.Event("resize"));
      await new Promise((resolve) => setTimeout(resolve, 380));
    });
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
    await click(button("표 삽입"));
    assert.equal(editor.querySelectorAll("table td").length, 4);
    assert.equal(editor.querySelector("p table, .memo-check-item table"), null);
    assert.equal(document.activeElement, editor);
    assert.equal(editor.querySelector("table").nextElementSibling.outerHTML, "<p><br></p>");
    // 첫 표 셀에서 다시 눌러도 독립 표 두 개와 각 표 뒤의 빈 문단이 생깁니다.
    await click(button("표 삽입"));
    assert.equal(editor.querySelectorAll("table").length, 2);
    assert.equal(editor.querySelector("table table"), null);
    for (const table of editor.querySelectorAll("table")) {
      assert.equal(table.parentElement, editor);
      assert.equal(table.nextElementSibling.outerHTML, "<p><br></p>");
    }
    const scroller = editor.parentElement;
    assert(scroller.classList.contains("pb-60"));
    // 여백의 단순 클릭만 끝 문단으로 이동하며, 드래그 시작은 선택과 스크롤을 유지합니다.
    const beforeTouch = document.getSelection().getRangeAt(0).cloneRange();
    await act(async () => scroller.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true })));
    assert.equal(document.getSelection().anchorNode, beforeTouch.startContainer);
    await click(scroller);
    assert.equal(document.activeElement, editor);
    assert.equal(document.getSelection().anchorNode, editor.lastElementChild);
    assert.equal(document.getSelection().anchorNode.closest("table"), null);
    const tail = editor.lastElementChild;
    scroller.getBoundingClientRect = () => ({ top: 100, bottom: 400 });
    tail.getBoundingClientRect = () => ({ top: 450, bottom: 478 });
    scroller.scrollTop = 0;
    await click(scroller);
    assert.equal(scroller.scrollTop, 106);
    assert.equal(form.scrollTop, 0);
    // 빈 본문 루트와 문장 중간에서도 빈 문단을 보장하고 뒤쪽 글자를 보존합니다.
    const selectCaret = (container, offset) => {
      const position = document.createRange();
      position.setStart(container, offset);
      position.collapse(true);
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(position);
    };
    editor.innerHTML = "";
    selectCaret(editor, 0);
    await click(button("표 삽입"));
    assert.equal(editor.children.length, 2);
    assert.equal(editor.lastElementChild.outerHTML, "<p><br></p>");
    await click(button("표 삽입"));
    assert.equal(editor.querySelectorAll("table").length, 2);
    assert.equal(editor.querySelector("table table"), null);
    await click(scroller);
    assert.equal(document.getSelection().anchorNode, editor.lastElementChild);
    await click(button("표 삽입"));
    assert.equal(editor.querySelectorAll("table").length, 3);
    for (const table of editor.querySelectorAll("table")) {
      assert.equal(table.nextElementSibling.outerHTML, "<p><br></p>");
    }
    await click(scroller);
    const nextLine = document.getSelection().getRangeAt(0);
    nextLine.insertNode(document.createTextNode("표 다음 줄"));
    await act(async () => editor.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true })));
    assert.equal(editor.lastElementChild.textContent, "표 다음 줄");
    assert.equal(editor.querySelectorAll("table")[1].textContent, "");
    editor.innerHTML = "<p>앞문장 뒷문장</p>";
    selectCaret(editor.firstChild.firstChild, 4);
    await click(button("표 삽입"));
    assert.equal(editor.firstElementChild.textContent, "앞문장 ");
    assert.equal(editor.querySelector("table").nextElementSibling.outerHTML, "<p><br></p>");
    assert.equal(editor.lastElementChild.textContent, "뒷문장");
  } finally {
    await act(async () => root.unmount());
    assert.equal(dom.window.scrollY, 240);
    dom.window.close();
  }
});
