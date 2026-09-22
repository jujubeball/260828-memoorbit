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

test("아이콘 헤더·퀵 서식·실행취소·링크·포맷·마크업·완료가 같은 본문을 사용한다", async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: "http://localhost" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  for (const name of ["HTMLElement", "Element", "HTMLInputElement", "HTMLTableCellElement"]) globalThis[name] = dom.window[name];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  let shared = null;
  let copied = null;
  navigator.share = async (value) => { shared = value; };
  Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value) => { copied = value; } } });
  dom.window.scrollTo = () => {};
  Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
  const strokes = [];
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({ beginPath() {}, moveTo() {}, lineTo(x, y) { strokes.push([x, y]); }, stroke() {}, clearRect() {} });
  dom.window.HTMLCanvasElement.prototype.setPointerCapture = () => {};
  dom.window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,drawn";
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
    assert.deepEqual([...header.querySelectorAll("button")].map((item) => item.getAttribute("aria-label")), ["목록으로 돌아가기", "실행취소", "공유", "더보기", "편집 완료"]);
    assert.equal(button("새 메모"), undefined);
    assert.equal(button("새 메모 작성"), undefined);
    const defaultToolbar = document.querySelector('[role="toolbar"]');
    assert.deepEqual([...defaultToolbar.querySelectorAll("button")].map((item) => item.getAttribute("aria-label")), ["텍스트 서식", "체크리스트", "표 삽입", "사진 또는 파일 첨부", "마크업"]);
    assert(defaultToolbar.classList.contains("overflow-x-auto"));
    assert(defaultToolbar.classList.contains("gap-6"));
    assert([...defaultToolbar.querySelectorAll("button")].every((item) => item.classList.contains("shrink-0")));
    assert(button("실행취소").disabled);
    await select();
    const toolbar = document.querySelector('[role="toolbar"]');
    assert.match(toolbar.textContent, /BIUS/);
    assert.equal(toolbar.querySelector('[aria-label="표 삽입"]'), null);
    await click("굵게");
    assert.equal(editor.querySelector("strong").textContent, "안녕");
    assert.equal(document.activeElement, editor);
    await click("실행취소");
    assert.equal(editor.innerHTML, memo.richContent);
    await click("더보기");
    await click("다시 실행");
    assert.equal(editor.querySelector("strong").textContent, "안녕");
    // 모바일 편집 메뉴의 실행취소도 브라우저 이력과 섞이지 않고 같은 서식 이력을 사용합니다.
    await act(async () => editor.dispatchEvent(new dom.window.InputEvent("beforeinput", { inputType: "historyUndo", bubbles: true, cancelable: true })));
    assert.equal(editor.innerHTML, memo.richContent);
    await act(async () => editor.dispatchEvent(new dom.window.InputEvent("beforeinput", { inputType: "historyRedo", bubbles: true, cancelable: true })));
    assert.equal(document.getSelection().toString(), "안녕");
    await click("형광펜");
    assert.equal(editor.querySelector("mark").textContent, "안녕");
    await click("형광펜");
    assert.equal(button("형광펜").getAttribute("aria-pressed"), "false");
    await click("링크");
    const input = document.querySelector('input[type="url"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input, "https://example.com/note");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    await click("적용");
    assert.equal(editor.querySelector("a").getAttribute("href"), "https://example.com/note");
    assert.equal(document.activeElement, editor);
    assert.equal(document.getSelection().toString(), "안녕");
    await click("텍스트 서식");
    assert.match(document.getElementById("memo-format-sheet").textContent, /포맷/);
    await click("제목");
    assert.equal(button("제목").getAttribute("aria-pressed"), "true");
    await click("색상 선택");
    await click("빨간색 글자");
    assert.equal(button("빨간색 글자").getAttribute("aria-pressed"), "true");
    await click("인셋 컨테이너");
    assert(editor.querySelector(".editor-inset"));
    await click("인셋 컨테이너");
    assert.equal(editor.querySelector(".editor-inset"), null);
    await click("포맷 닫기");
    assert.equal(document.getElementById("memo-format-sheet"), null);
    assert.equal(document.getSelection().toString(), "안녕");
    await click("공유");
    assert.equal(shared.text, "안녕 테스트");
    await click("더보기");
    await click("본문 복사");
    assert.equal(copied, "안녕 테스트");
    await select(true);
    await click("마크업");
    const canvas = document.querySelector("canvas");
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });
    await act(async () => canvas.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 20 })));
    assert(strokes.length > 0);
    await click("그림 첨부");
    assert.equal(document.querySelector("canvas"), null);
    await click("편집 완료");
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].images[0].name, "마크업 그림");
    assert.equal(submissions[0].richContent, editor.innerHTML);
    assert.notEqual(document.activeElement, editor);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
  }
});
