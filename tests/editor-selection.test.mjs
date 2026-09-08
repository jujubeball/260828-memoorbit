import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";

const compiled = { exports: {} };
new Function("exports", ts.transpileModule(readFileSync("src/lib/editorSelection.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(compiled.exports);
const { formatEditorRange, readEditorRange, restoreEditorRange, CARET_PLACEHOLDER } = compiled.exports;

function setup(html = "안녕 테스트") {
  const dom = new JSDOM('<div contenteditable="true" tabindex="0"></div><input>');
  const document = dom.window.document;
  const editor = document.querySelector("div");
  editor.innerHTML = html;
  const range = document.createRange();
  return { dom, document, editor, range };
}

for (const [command, tag] of [["bold", "strong"], ["italic", "em"], ["underline", "u"], ["strikeThrough", "s"]]) {
  test(`안녕만 선택해 ${command} 적용 시 테스트는 그대로 남는다`, () => {
    const { editor, range, dom } = setup();
    range.setStart(editor.firstChild, 0);
    range.setEnd(editor.firstChild, 2);
    const saved = formatEditorRange(editor, range, command);
    assert.equal(editor.innerHTML, `<${tag}>안녕</${tag}> 테스트`);
    assert.equal(saved.toString(), "안녕");
    dom.window.close();
  });
}

test("부분 제목 크기는 선택한 글자만 바꾸고 문단 구조를 유지한다", () => {
  const { editor, range, dom } = setup("<p>안녕 테스트</p>");
  range.setStart(editor.firstChild.firstChild, 0);
  range.setEnd(editor.firstChild.firstChild, 2);
  formatEditorRange(editor, range, "formatBlock", "h1");
  assert.equal(editor.querySelector("span").textContent, "안녕");
  assert(editor.querySelector("span").classList.contains("text-2xl"));
  assert.equal(editor.querySelector("h1"), null);
  assert.equal(editor.querySelector("p").lastChild.textContent, " 테스트");
  dom.window.close();
});

test("여러 문단·기존 인라인 태그에 걸친 선택은 선택한 텍스트만 감싼다", () => {
  const { editor, range, dom } = setup("<p>앞 안녕 <em>반가워</em></p><p>테스트 뒤</p>");
  const paragraphs = editor.querySelectorAll("p");
  range.setStart(paragraphs[0].firstChild, 2);
  range.setEnd(paragraphs[1].firstChild, 3);
  formatEditorRange(editor, range, "bold");
  assert.equal(editor.querySelectorAll("p").length, 2);
  assert.equal(editor.textContent, "앞 안녕 반가워테스트 뒤");
  assert.equal([...editor.querySelectorAll("strong")].map((node) => node.textContent).join(""), "안녕 반가워테스트");
  assert.equal(paragraphs[0].firstChild.textContent, "앞 ");
  assert.equal(paragraphs[1].lastChild.textContent, " 뒤");
  assert(editor.querySelector("em strong"));
  dom.window.close();
});

test("선택 없이 적용하면 커서 위치에 빈 서식을 만들고 새 입력을 그 안에 넣는다", () => {
  const { editor, range, dom, document } = setup();
  range.setStart(editor.firstChild, 2);
  range.collapse(true);
  const saved = formatEditorRange(editor, range, "bold");
  assert(saved.collapsed);
  assert.equal(saved.startContainer.parentElement.tagName, "STRONG");
  saved.insertNode(document.createTextNode("추가"));
  assert.equal(editor.querySelector("strong").textContent.replaceAll(CARET_PLACEHOLDER, ""), "추가");
  assert.equal(editor.textContent.replaceAll(CARET_PLACEHOLDER, ""), "안녕추가 테스트");
  dom.window.close();
});

test("태그 입력으로 포커스를 옮겨도 복사한 본문 Range가 정확히 복원된다", () => {
  const { editor, range, dom, document } = setup();
  editor.focus();
  range.setStart(editor.firstChild, 0);
  range.setEnd(editor.firstChild, 2);
  document.getSelection().removeAllRanges();
  document.getSelection().addRange(range);
  const saved = readEditorRange(editor);
  document.querySelector("input").focus();
  document.getSelection().removeAllRanges();
  const restored = restoreEditorRange(editor, saved);
  assert.equal(restored.toString(), "안녕");
  assert.equal(document.activeElement, editor);
  formatEditorRange(editor, restored, "underline");
  assert.equal(editor.innerHTML, "<u>안녕</u> 테스트");
  dom.window.close();
});

test("편집기 밖의 선택에는 서식을 적용하지 않으며 오래된 Range는 안전한 커서로 대체한다", () => {
  const { editor, range, dom, document } = setup();
  range.selectNode(document.querySelector("input"));
  assert.equal(formatEditorRange(editor, range, "bold"), null);
  const restored = restoreEditorRange(editor, range);
  assert(restored.collapsed);
  assert.equal(restored.startContainer, editor);
  assert.equal(editor.textContent, "안녕 테스트");
  dom.window.close();
});
