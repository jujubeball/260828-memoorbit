import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";

const compiled = { exports: {} };
new Function("exports", ts.transpileModule(readFileSync("src/lib/editorSelection.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(compiled.exports);
const { formatEditorRange, readEditorRange, readEditorFormat, restoreEditorRange, CARET_PLACEHOLDER } = compiled.exports;
const lists = { exports: {} };
new Function("require", "exports", ts.transpileModule(readFileSync("src/lib/editorLists.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(() => compiled.exports, lists.exports);
const { formatEditorList } = lists.exports;

function setup(html = "안녕 테스트") {
  const dom = new JSDOM('<div contenteditable="true" tabindex="0"></div><input>');
  const document = dom.window.document;
  const editor = document.querySelector("div");
  editor.innerHTML = html;
  const range = document.createRange();
  return { dom, document, editor, range };
}

test("읽기 상태의 본문에 포커스 없이 부분 서식을 적용한다", () => {
  const { editor, range, dom, document } = setup("<p>운동은 어렵다</p>");
  editor.setAttribute("contenteditable", "false");
  range.setStart(editor.firstChild.firstChild, 0);
  range.setEnd(editor.firstChild.firstChild, 2);
  const input = document.querySelector("input");
  input.focus();
  const selected = restoreEditorRange(editor, range, false);
  formatEditorRange(editor, selected, "bold");
  assert.equal(editor.querySelector("strong").textContent, "운동");
  assert.equal(document.activeElement, input);
  dom.window.close();
});

for (const [command, tag] of [["insertUnorderedList", "ul"], ["insertOrderedList", "ol"]]) {
  test(`키보드 없이 두 문단을 ${tag}로 묶고 다시 해제한다`, () => {
    const { editor, range, dom, document } = setup("<p>앞</p><p>운동</p><p>기록</p><p>뒤</p>");
    editor.setAttribute("contenteditable", "false");
    range.setStart(editor.children[1].firstChild, 0);
    range.setEnd(editor.children[2].firstChild, 2);
    const input = document.querySelector("input");
    input.focus();
    const selected = formatEditorList(editor, range, command);
    assert.equal(editor.querySelectorAll(tag).length, 1);
    assert.equal(editor.querySelectorAll(`${tag} > li`).length, 2);
    assert.equal(selected.toString(), "운동기록");
    const cleared = formatEditorList(editor, selected, command);
    assert.equal(editor.querySelectorAll("p").length, 4);
    assert.equal(editor.querySelector(tag), null);
    assert.equal(cleared.toString(), "운동기록");
    assert.equal(editor.textContent, "앞운동기록뒤");
    assert.equal(document.activeElement, input);
    dom.window.close();
  });
}

test("선택한 목록 항목만 해제하고 앞뒤 목록은 보존한다", () => {
  const { editor, range, dom } = setup("<ul><li>앞</li><li>운동</li><li>뒤</li></ul>");
  range.selectNodeContents(editor.querySelectorAll("li")[1]);
  formatEditorList(editor, range, "insertUnorderedList");
  assert.equal(editor.innerHTML, "<ul><li>앞</li></ul><p>운동</p><ul><li>뒤</li></ul>");
  dom.window.close();
});

test("목록의 들여쓰기와 내어쓰기는 커서 글자 인덱스를 유지한다", () => {
  const { editor, range, dom } = setup("<ul><li>앞</li><li>운동</li></ul>");
  range.setStart(editor.querySelectorAll("li")[1].firstChild, 1);
  range.collapse(true);
  const indented = formatEditorList(editor, range, "indent");
  assert.equal(editor.querySelector("li > ul > li").textContent, "운동");
  assert(indented.collapsed);
  assert.equal(indented.startOffset, 1);
  const restored = formatEditorList(editor, indented, "outdent");
  assert.equal(editor.querySelectorAll("ul > li").length, 2);
  assert.equal(editor.querySelector("li > ul"), null);
  assert(restored.collapsed);
  assert.equal(restored.startOffset, 1);
  dom.window.close();
});

test("문단 경계의 빈 커서는 해당 문단만 목록으로 바꾼다", () => {
  const { editor, range, dom } = setup("<p>앞</p><p><br></p><p>뒤</p>");
  range.setStart(editor, 1);
  range.collapse(true);
  const selected = formatEditorList(editor, range, "insertUnorderedList");
  assert.equal(editor.innerHTML, "<p>앞</p><ul><li><br></li></ul><p>뒤</p>");
  assert(selected.collapsed);
  assert.equal(selected.startContainer.tagName, "LI");
  dom.window.close();
});

test("문단 없는 본문과 다음 문단을 함께 선택해도 글자와 선택은 보존된다", () => {
  const { editor, range, dom } = setup("운동 <strong>기록</strong><p>다음</p><p>뒤</p>");
  range.setStart(editor.firstChild, 1);
  range.setEnd(editor.querySelector("p").firstChild, 1);
  const selected = formatEditorList(editor, range, "insertOrderedList");
  assert.equal(editor.querySelectorAll("ol > li").length, 2);
  assert.equal(editor.querySelector("strong").textContent, "기록");
  assert.equal(selected.toString(), "동 기록다");
  assert.equal(editor.lastChild.outerHTML, "<p>뒤</p>");
  dom.window.close();
});

for (const command of ["bold", "italic", "underline", "strikeThrough", "formatBlock"]) {
  test(`운동만 선택하고 포커스를 옮겨도 ${command} 적용·해제 범위가 유지된다`, () => {
    const { editor, range, dom, document } = setup("<p>운동은 하면 할 수록 어렵다</p>");
    range.setStart(editor.firstChild.firstChild, 0);
    range.setEnd(editor.firstChild.firstChild, 2);
    document.getSelection().addRange(range);
    const saved = readEditorRange(editor);
    document.querySelector("input").focus();
    const restored = restoreEditorRange(editor, saved);
    const value = command === "formatBlock" ? "h1" : undefined;
    const formatted = formatEditorRange(editor, restored, command, value);
    assert.equal(formatted.toString(), "운동");
    assert.equal(editor.querySelector("p").lastChild.textContent, "은 하면 할 수록 어렵다");
    const state = readEditorFormat(editor, formatted);
    assert.equal(command === "formatBlock" ? state.block : state[command], value ?? true);
    const cleared = formatEditorRange(editor, formatted, command, value);
    assert.equal(cleared.toString(), "운동");
    assert.equal(editor.textContent, "운동은 하면 할 수록 어렵다");
    const next = readEditorFormat(editor, cleared);
    assert.equal(command === "formatBlock" ? next.block : next[command], command === "formatBlock" ? null : false);
    dom.window.close();
  });
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

for (const command of ["bold", "italic", "underline", "strikeThrough"]) {
  test(`${command}를 다시 누르면 선택 부분만 해제하고 버튼 상태도 꺼진다`, () => {
    const { editor, range, dom } = setup();
    range.setStart(editor.firstChild, 0);
    range.setEnd(editor.firstChild, 2);
    const on = formatEditorRange(editor, range, command);
    assert.equal(readEditorFormat(editor, on)[command], true);
    const off = formatEditorRange(editor, on, command);
    assert.equal(readEditorFormat(editor, off)[command], false);
    assert.equal(editor.textContent, "안녕 테스트");
    assert.equal(off.toString(), "안녕");
    const again = formatEditorRange(editor, off, command);
    assert.equal(readEditorFormat(editor, again)[command], true);
    dom.window.close();
  });
}

test("전체 굵게 안의 일부만 해제해도 나머지 굵게와 중첩 기울임이 남는다", () => {
  const { editor, range, dom } = setup("<strong>앞 <em>안녕</em> 뒤</strong>");
  const text = editor.querySelector("em").firstChild;
  range.setStart(text, 0);
  range.setEnd(text, 2);
  const off = formatEditorRange(editor, range, "bold");
  assert.equal(readEditorFormat(editor, off).bold, false);
  assert.equal(readEditorFormat(editor, off).italic, true);
  assert.equal([...editor.querySelectorAll("strong")].map((node) => node.textContent).join(""), "앞  뒤");
  assert.equal(editor.textContent, "앞 안녕 뒤");
  dom.window.close();
});

test("선택 없는 커서에서도 굵게 켜기와 끄기를 반복할 수 있다", () => {
  const { editor, range, dom } = setup();
  range.setStart(editor.firstChild, 2);
  range.collapse(true);
  const on = formatEditorRange(editor, range, "bold");
  assert.equal(readEditorFormat(editor, on).bold, true);
  const off = formatEditorRange(editor, on, "bold");
  assert(off.collapsed);
  assert.equal(readEditorFormat(editor, off).bold, false);
  assert.equal(off.startContainer.parentElement.closest("strong"), null);
  dom.window.close();
});

test("제목과 색상도 다시 누르면 선택 범위의 활성 상태가 해제된다", () => {
  const { editor, range, dom } = setup();
  range.setStart(editor.firstChild, 0);
  range.setEnd(editor.firstChild, 2);
  let selected = formatEditorRange(editor, range, "formatBlock", "h1");
  assert.equal(readEditorFormat(editor, selected).block, "h1");
  selected = formatEditorRange(editor, selected, "formatBlock", "h1");
  assert.equal(readEditorFormat(editor, selected).block, null);
  selected = formatEditorRange(editor, selected, "foreColor", "#e5a93c");
  assert.equal(readEditorFormat(editor, selected).color, "#e5a93c");
  selected = formatEditorRange(editor, selected, "foreColor", "#e5a93c");
  assert.equal(readEditorFormat(editor, selected).color, null);
  assert.equal(editor.textContent, "안녕 테스트");
  dom.window.close();
});
