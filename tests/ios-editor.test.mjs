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

test("연속 가로 툴바·네 기본 도구·링크·포맷 시트의 세 닫기 경로가 선택 상태를 유지한다", async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: "http://localhost" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  for (const name of ["HTMLElement", "Element", "HTMLInputElement", "HTMLTableCellElement"]) globalThis[name] = dom.window[name];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => {} } });
  dom.window.scrollTo = () => {};
  Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
  dom.window.HTMLElement.prototype.setPointerCapture = () => {};
  const { createRoot } = await import("react-dom/client");
  const MemoModal = loadModal();
  const root = createRoot(document.getElementById("root"));
  const submissions = [];
  const memo = { id: "a", title: "안녕 테스트", content: "", richContent: "<p>안녕 테스트</p>", tags: [], images: [] };
  const button = (label) => [...document.querySelectorAll("button")].find((item) => item.getAttribute("aria-label") === label || item.textContent.trim() === label);
  const click = async (label) => act(async () => {
    const target = typeof label === "string" ? button(label) : label;
    assert(target, String(label));
    target.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    target.click();
  });
  const select = async (collapsed = false) => act(async () => {
    editor.focus();
    const walker = document.createTreeWalker(editor, 4);
    const text = walker.nextNode();
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, collapsed ? 0 : Math.min(2, text.length));
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(range);
    document.dispatchEvent(new dom.window.Event("selectionchange"));
  });
  let editor;
  try {
    await act(async () => root.render(React.createElement(MemoModal, { isOpen: true, editingMemo: memo, onClose() {}, onSubmit(draft) { submissions.push(draft); } })));
    editor = document.querySelector('[aria-label="메모 내용"]');
    const header = document.querySelector("header");
    assert.equal(header.textContent.trim(), "");
    assert.deepEqual([...header.querySelectorAll("button")].map((item) => item.getAttribute("aria-label")), ["목록으로 돌아가기", "편집 완료"]);
    assert.equal(button("새 메모"), undefined);
    assert.equal(button("새 메모 작성"), undefined);
    const defaultToolbar = document.querySelector('[role="toolbar"]');
    assert.deepEqual([...defaultToolbar.querySelectorAll("button")].map((item) => item.getAttribute("aria-label")), ["텍스트 서식", "체크리스트", "표 삽입", "사진 또는 파일 첨부", "굵게", "기울임", "밑줄", "취소선", "형광펜", "색상 선택", "링크"]);
    assert(defaultToolbar.classList.contains("overflow-x-auto"));
    for (const className of ["whitespace-nowrap", "scrollbar-none", "flex", "touch-pan-x", "gap-6", "px-4", "py-2.5"]) {
      assert(defaultToolbar.classList.contains(className));
    }
    assert.equal(defaultToolbar.querySelectorAll('[data-toolbar-page]').length, 0);
    assert(!defaultToolbar.className.includes("snap-"));
    assert.equal(defaultToolbar.querySelectorAll('[data-toolbar-group="main"] button').length, 4);
    assert.equal(button("마크업"), undefined);
    assert(defaultToolbar.parentElement.classList.contains("pb-[env(safe-area-inset-bottom)]"));
    assert(!defaultToolbar.classList.contains("pb-[env(safe-area-inset-bottom)]"));
    assert(defaultToolbar.parentElement.classList.contains("bottom-0"));
    assert(!document.querySelector(".pb-60"));
    for (const label of ["굵게", "색상 선택"]) {
      assert.equal(button(label).getAttribute("aria-pressed"), "false");
      assert(!button(label).classList.contains("bg-amber-500"));
    }
    assert(!document.body.textContent.includes("https:// 또는 http://로 시작하는"));
    assert([...defaultToolbar.querySelectorAll("button")].every((item) => item.classList.contains("shrink-0")));
    await select();
    // 손가락 이벤트를 취소하지 않으며 브라우저가 정한 임의 스크롤 위치를 페이지 경계로 바꾸지 않습니다.
    const pointer = async (target, type, x, y = 10) => act(async () => {
      const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
      Object.defineProperty(event, "pointerType", { value: "touch" });
      target.dispatchEvent(event);
      return event;
    });
    const beforeScroll = editor.innerHTML;
    const down = new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
    Object.defineProperty(down, "pointerType", { value: "touch" });
    await act(async () => defaultToolbar.dispatchEvent(down));
    assert.equal(down.defaultPrevented, false);
    await act(async () => {
      defaultToolbar.scrollLeft = 137;
      defaultToolbar.dispatchEvent(new dom.window.Event("scroll"));
    });
    await pointer(defaultToolbar, "pointerup", 137);
    assert.equal(defaultToolbar.scrollLeft, 137);
    await act(async () => button("굵게").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 })));
    assert.equal(editor.innerHTML, beforeScroll);
    assert.equal(document.getSelection().toString(), "안녕");
    await pointer(defaultToolbar, "pointerdown", 100);
    await pointer(defaultToolbar, "pointercancel", 100);
    assert.equal(defaultToolbar.scrollLeft, 137);
    assert.equal(document.activeElement, editor);
    const toolbar = document.querySelector('[role="toolbar"]');
    assert.match(toolbar.textContent, /BIUS/);
    assert(toolbar.querySelector('[aria-label="표 삽입"]'));
    await click("굵게");
    assert.equal(editor.querySelector("strong").textContent, "안녕");
    assert.equal(document.activeElement, editor);
    // 헤더를 단순화해도 모바일 키보드의 실행취소 입력은 브라우저 이력과 섞이지 않고 같은 서식 이력을 사용합니다.
    await act(async () => editor.dispatchEvent(new dom.window.InputEvent("beforeinput", { inputType: "historyUndo", bubbles: true, cancelable: true })));
    assert.equal(editor.innerHTML, memo.richContent);
    await act(async () => editor.dispatchEvent(new dom.window.InputEvent("beforeinput", { inputType: "historyRedo", bubbles: true, cancelable: true })));
    assert.equal(document.getSelection().toString(), "안녕");
    await click("형광펜");
    assert.equal(editor.querySelector("mark").textContent, "안녕");
    await click("형광펜");
    assert.equal(button("형광펜").getAttribute("aria-pressed"), "false");
    await click("링크");
    let input = document.querySelector('input[type="url"]');
    const linkDialog = input.closest('[aria-label="링크 주소 입력"]');
    assert(linkDialog.textContent.includes("https:// 또는 http://로 시작하는"));
    assert(linkDialog.closest('[data-layer-anchor="true"]'));
    assert(!defaultToolbar.parentElement.textContent.includes("https:// 또는 http://로 시작하는"));
    await click("적용");
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert(linkDialog.querySelector('[role="alert"]'));
    const linkBackdrop = input.closest('[role="presentation"]');
    const outsidePress = new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
    await act(async () => linkBackdrop.dispatchEvent(outsidePress));
    assert(outsidePress.defaultPrevented);
    assert(!document.body.textContent.includes("https:// 또는 http://로 시작하는"));
    assert(!document.body.textContent.includes("올바른 웹 주소를 입력해 주세요."));
    assert.equal(document.querySelector('input[type="url"]'), null);
    assert.equal(document.getSelection().toString(), "안녕");
    await click("링크");
    const linkHandle = button("링크 입력 내리기");
    await pointer(linkHandle, "pointerdown", 100, 10);
    await pointer(linkHandle, "pointerup", 100, 100);
    assert.equal(document.querySelector('input[type="url"]'), null);
    assert.equal(document.getSelection().toString(), "안녕");
    assert.equal(document.activeElement, editor);
    await click("링크");
    input = document.querySelector('input[type="url"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input, "https://example.com/note");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    await click("적용");
    assert.equal(editor.querySelector("a").getAttribute("href"), "https://example.com/note");
    assert.equal(editor.querySelector("a").getAttribute("target"), "_blank");
    assert(editor.querySelector("a").classList.contains("text-amber-400"));
    assert.equal(document.activeElement, editor);
    assert.equal(document.getSelection().toString(), "안녕");
    await click("텍스트 서식");
    const formatSheet = document.getElementById("memo-format-sheet");
    assert.match(formatSheet.textContent, /포맷/);
    assert(formatSheet.querySelector('[aria-label="포맷 닫기"]'));
    await click("포맷 닫기");
    assert.equal(document.activeElement, editor);
    assert.equal(document.getSelection().toString(), "안녕");
    assert(formatSheet.className.includes("format-sheet-out"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 180)); });
    assert.equal(document.getElementById("memo-format-sheet"), null);
    assert.equal(document.activeElement, editor);
    assert.equal(document.getSelection().toString(), "안녕");
    await click("텍스트 서식");
    const syncedBoldButtons = [...document.querySelectorAll('[aria-label="굵게"]')];
    assert.equal(syncedBoldButtons.length, 2);
    assert(syncedBoldButtons.every((item) => item.getAttribute("aria-pressed") === "true"));
    const formatRows = [...document.getElementById("memo-format-sheet").querySelectorAll('[role="group"]')];
    assert.equal(formatRows.length, 4);
    for (const row of [formatRows[0], formatRows[1], formatRows[2].parentElement]) {
      for (const className of ["flex", "items-center", "gap-x-4", "overflow-x-auto", "whitespace-nowrap", "flex-nowrap", "scrollbar-hide", "px-2", "py-1"]) {
        assert(row.classList.contains(className), `${className} 누락`);
      }
      assert(!row.classList.contains("flex-wrap"));
    }
    await click("제목");
    assert.equal(button("제목").getAttribute("aria-pressed"), "true");
    assert([...document.querySelectorAll('[aria-label="색상 선택"]')].every((item) => item.getAttribute("aria-pressed") === "false" && !item.classList.contains("bg-amber-500")));
    await click("색상 선택");
    assert(document.querySelector('[aria-label="글자색 선택"]'));
    await act(async () => window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    assert.equal(document.querySelector('[aria-label="글자색 선택"]'), null);
    assert.equal(document.getSelection().toString(), "안녕");
    await click("색상 선택");
    const colorDialog = document.querySelector('[aria-label="글자색 선택"]');
    assert.equal(colorDialog.parentElement.parentElement, document.body);
    const colorHandle = button("색상 선택 내리기");
    await pointer(colorHandle, "pointerdown", 100, 10);
    await pointer(colorHandle, "pointercancel", 100, 100);
    await pointer(colorHandle, "pointerup", 100, 100);
    assert(document.querySelector('[aria-label="글자색 선택"]'));
    await pointer(colorHandle, "pointerdown", 100, 10);
    await pointer(colorHandle, "pointerup", 100, 100);
    assert.equal(document.querySelector('[aria-label="글자색 선택"]'), null);
    assert(document.getElementById("memo-format-sheet"));
    assert.equal(document.getSelection().toString(), "안녕");
    await click("색상 선택");
    await click("빨간색 글자");
    assert.equal(button("색상 선택").getAttribute("aria-pressed"), "true");
    assert([...document.querySelectorAll('[aria-label="색상 선택"]')].every((item) => item.classList.contains("bg-amber-500")));
    // 색상 없는 나머지 글자로 커서를 옮기면 두 도구의 활성 표시가 함께 꺼지고 돌아오면 다시 켜집니다.
    const coloredRange = document.getSelection().getRangeAt(0).cloneRange();
    await act(async () => {
      const walker = document.createTreeWalker(editor, 4);
      let lastText;
      while (walker.nextNode()) lastText = walker.currentNode;
      const plainRange = document.createRange();
      plainRange.setStart(lastText, lastText.length);
      plainRange.collapse(true);
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(plainRange);
      document.dispatchEvent(new dom.window.Event("selectionchange"));
    });
    assert([...document.querySelectorAll('[aria-label="색상 선택"]')].every((item) => !item.classList.contains("bg-amber-500")));
    await act(async () => {
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(coloredRange);
      document.dispatchEvent(new dom.window.Event("selectionchange"));
    });
    assert([...document.querySelectorAll('[aria-label="색상 선택"]')].every((item) => item.classList.contains("bg-amber-500")));
    await click("인셋 컨테이너");
    assert(editor.querySelector(".editor-inset"));
    await click("인셋 컨테이너");
    assert.equal(editor.querySelector(".editor-inset"), null);
    const handle = document.querySelector('[aria-label="포맷 시트 내리기"]');
    await act(async () => handle.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientY: 10 })));
    await act(async () => handle.dispatchEvent(new dom.window.MouseEvent("pointermove", { bubbles: true, cancelable: true, clientY: 100 })));
    await act(async () => handle.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, cancelable: true, clientY: 100 })));
    assert(document.getElementById("memo-format-sheet").className.includes("format-sheet-out"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 180)); });
    assert.equal(document.getElementById("memo-format-sheet"), null);
    assert.equal(document.getSelection().toString(), "안녕");
    await click("텍스트 서식");
    const reopenedSheet = document.getElementById("memo-format-sheet");
    const reopenedHandle = button("포맷 시트 내리기");
    await act(async () => window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    assert(document.getElementById("memo-format-sheet"));
    await act(async () => reopenedHandle.click());
    assert(document.getElementById("memo-format-sheet"));
    await pointer(reopenedHandle, "pointerdown", 100, 10);
    await pointer(reopenedHandle, "pointermove", 100, 50);
    assert.equal(reopenedSheet.style.transform, "translateY(40px)");
    await pointer(reopenedHandle, "pointercancel", 100, 50);
    assert.equal(reopenedSheet.style.transform, "translateY(0px)");
    assert(document.getElementById("memo-format-sheet"));
    await act(async () => reopenedSheet.closest('[role="presentation"]').dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true })));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 180)); });
    assert.equal(document.getElementById("memo-format-sheet"), null);
    assert.equal(document.getSelection().toString(), "안녕");
    assert.equal(document.activeElement, editor);
    assert.equal(document.querySelector("canvas"), null);
    await click("편집 완료");
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].images.length, 0);
    assert.equal(submissions[0].richContent, editor.innerHTML);
    assert.notEqual(document.activeElement, editor);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
  }
});
