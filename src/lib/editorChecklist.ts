import { CARET_PLACEHOLDER, isEditorRange } from "@/src/lib/editorSelection";

const placeCaret = (editor: HTMLElement, target: HTMLElement): Range => {
  if (!target.hasChildNodes()) target.append(editor.ownerDocument.createElement("br"));
  editor.focus({ preventScroll: true });
  const range = editor.ownerDocument.createRange();
  range.selectNodeContents(target);
  range.collapse(true);
  const selection = editor.ownerDocument.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return range.cloneRange();
};

const makeChecklistItem = (document: Document): { item: HTMLDivElement; text: HTMLSpanElement } => {
  const item = document.createElement("div");
  item.className = "memo-check-item";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.setAttribute("contenteditable", "false");
  checkbox.setAttribute("aria-label", "체크리스트 완료");
  const text = document.createElement("span");
  text.className = "memo-check-text";
  item.append(checkbox, text);
  return { item, text };
};

// 💡 [커서 위치의 체크리스트 생성]
// 현재 문단을 커서 앞뒤로 나눠 체크 항목을 같은 본문 수준에 넣고 선택한 내용은 항목 안으로 옮깁니다.
export const insertEditorChecklist = (editor: HTMLElement, range: Range): Range | null => {
  if (!isEditorRange(editor, range)) return null;
  const { item, text } = makeChecklistItem(editor.ownerDocument);
  text.append(range.extractContents());
  const start = range.startContainer.nodeType === 1 ? range.startContainer as Element : range.startContainer.parentElement;
  const block = start?.closest("p, h1, h2, h3, pre, .memo-check-item");
  if (block && editor.contains(block)) {
    const tail = editor.ownerDocument.createRange();
    tail.selectNodeContents(block);
    tail.setStart(range.startContainer, range.startOffset);
    const suffix = tail.extractContents();
    block.after(item);
    if (suffix.textContent?.replaceAll(CARET_PLACEHOLDER, "").trim()) {
      const paragraph = editor.ownerDocument.createElement("p");
      paragraph.append(suffix);
      item.after(paragraph);
    }
    if (!block.textContent?.replaceAll(CARET_PLACEHOLDER, "").trim()) block.remove();
  } else range.insertNode(item);
  return placeCaret(editor, text);
};

// 💡 [체크리스트 Enter 분기]
// 글자가 있는 항목은 커서 뒤 내용을 새 미완료 항목으로 옮기고, 빈 항목은 일반 문단으로 바꿉니다.
export const enterEditorChecklist = (editor: HTMLElement, range: Range): Range | null => {
  if (!isEditorRange(editor, range)) return null;
  const start = range.startContainer.nodeType === 1 ? range.startContainer as Element : range.startContainer.parentElement;
  const text = start?.closest<HTMLElement>(".memo-check-text");
  const item = text?.closest<HTMLElement>(".memo-check-item");
  if (!text || !item || !text.contains(range.endContainer)) return null;
  range.deleteContents();
  if (!text.textContent?.replaceAll(CARET_PLACEHOLDER, "").trim()) {
    const paragraph = editor.ownerDocument.createElement("p");
    item.replaceWith(paragraph);
    return placeCaret(editor, paragraph);
  }
  const next = makeChecklistItem(editor.ownerDocument);
  const tail = editor.ownerDocument.createRange();
  tail.selectNodeContents(text);
  tail.setStart(range.startContainer, range.startOffset);
  next.text.append(tail.extractContents());
  item.after(next.item);
  return placeCaret(editor, next.text);
};
