import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";

const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", code)((name) => load(`${name.slice(2)}.ts`), exports);
  modules.set(file, exports);
  return exports;
}
const { insertEditorChecklist, enterEditorChecklist } = load("src/lib/editorChecklist.ts");

function setup(html) {
  const dom = new JSDOM('<div contenteditable="true" tabindex="0"></div>');
  const editor = dom.window.document.querySelector("div");
  editor.innerHTML = html;
  const range = dom.window.document.createRange();
  return { dom, editor, range };
}

test("현재 문단 중간에 체크리스트를 넣어도 앞뒤 본문이 보존된다", () => {
  const { dom, editor, range } = setup("<p>앞뒤</p>");
  range.setStart(editor.firstChild.firstChild, 1);
  range.collapse(true);
  const next = insertEditorChecklist(editor, range);
  assert.equal(editor.children.length, 3);
  assert.equal(editor.firstChild.textContent, "앞");
  assert.equal(editor.lastChild.textContent, "뒤");
  assert(next.startContainer.classList.contains("memo-check-text"));
  assert.equal(editor.querySelector("input").checked, false);
  dom.window.close();
});

test("글자가 있는 체크리스트의 Enter는 다음 미완료 항목을 만들고 커서를 옮긴다", () => {
  const { dom, editor, range } = setup('<div class="memo-check-item"><input type="checkbox" checked><span class="memo-check-text">할 일</span></div>');
  const text = editor.querySelector("span");
  range.setStart(text.firstChild, 3);
  range.collapse(true);
  const next = enterEditorChecklist(editor, range);
  assert.equal(editor.querySelectorAll(".memo-check-item").length, 2);
  assert.equal(editor.querySelectorAll("input")[1].checked, false);
  assert.equal(next.startContainer, editor.querySelectorAll(".memo-check-text")[1]);
  const exited = enterEditorChecklist(editor, next);
  assert.equal(editor.querySelectorAll(".memo-check-item").length, 1);
  assert.equal(exited.startContainer.tagName, "P");
  assert.equal(editor.firstChild.textContent, "할 일");
  dom.window.close();
});

test("항목 중간의 Enter는 커서 뒤 내용을 다음 체크리스트로 이동한다", () => {
  const { dom, editor, range } = setup('<div class="memo-check-item"><input type="checkbox"><span class="memo-check-text">장보기 청소</span></div>');
  const text = editor.querySelector("span");
  range.setStart(text.firstChild, 4);
  range.collapse(true);
  enterEditorChecklist(editor, range);
  assert.deepEqual([...editor.querySelectorAll(".memo-check-text")].map((item) => item.textContent), ["장보기 ", "청소"]);
  dom.window.close();
});

test("일반 문단의 Enter는 가로채지 않는다", () => {
  const { dom, editor, range } = setup("<p>일반 본문</p>");
  range.selectNodeContents(editor.firstChild);
  range.collapse(false);
  assert.equal(enterEditorChecklist(editor, range), null);
  assert.equal(editor.innerHTML, "<p>일반 본문</p>");
  dom.window.close();
});
