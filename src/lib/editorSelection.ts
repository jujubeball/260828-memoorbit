// 빈 서식 영역 안에도 커서를 둘 수 있게 하는 임시 문자이며 저장할 때는 제거합니다.
export const CARET_PLACEHOLDER = String.fromCharCode(8203);

interface InlineFormat {
  tag: "strong" | "em" | "u" | "s" | "span";
  className?: string;
}

const BLOCK_STYLES: Record<string, string> = {
  h1: "text-2xl font-bold", h2: "text-xl font-bold", h3: "text-lg font-semibold",
  p: "text-base font-normal", pre: "font-mono text-base font-normal",
};
const COLOR_STYLES: Record<string, string> = {
  "#ffffff": "text-white", "#e5a93c": "text-[#e5a93c]", "#ff453a": "text-[#ff453a]",
  "#0a84ff": "text-[#0a84ff]", "#30d158": "text-[#30d158]",
};

export const isEditorRange = (editor: HTMLElement, range: Range): boolean =>
  editor.contains(range.startContainer) && editor.contains(range.endContainer);

export const readEditorRange = (editor: HTMLElement): Range | null => {
  const selection = editor.ownerDocument.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return isEditorRange(editor, range) ? range.cloneRange() : null;
};

// 💡 [포커스 변경 전에 Range 복사]
// focus가 브라우저의 현재 선택을 바꿀 수 있으므로 복사본을 만든 뒤 편집기에 다시 올립니다.
export const restoreEditorRange = (editor: HTMLElement, saved: Range | null): Range => {
  const range = saved && isEditorRange(editor, saved) ? saved.cloneRange() : editor.ownerDocument.createRange();
  if (!saved || !isEditorRange(editor, saved)) {
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  editor.focus({ preventScroll: true });
  const selection = editor.ownerDocument.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return range;
};

// 💡 [선택한 글자에만 서식 적용]
// 문단과 기존 태그 경계를 그대로 두고 선택에 걸친 텍스트 노드의 해당 부분만 감쌉니다.
// 선택이 접혀 있으면 빈 서식 안에 임시 커서를 만들고 이후 입력할 글자부터 서식을 적용합니다.
export const formatEditorRange = (editor: HTMLElement, range: Range, command: string, value?: string): Range | null => {
  if (!isEditorRange(editor, range)) return null;
  const simple: Record<string, InlineFormat> = {
    bold: { tag: "strong" }, italic: { tag: "em" }, underline: { tag: "u" }, strikeThrough: { tag: "s" },
  };
  const format = command === "formatBlock" && value && BLOCK_STYLES[value]
    ? { tag: "span" as const, className: BLOCK_STYLES[value] }
    : command === "foreColor" && value && COLOR_STYLES[value]
      ? { tag: "span" as const, className: COLOR_STYLES[value] }
      : simple[command];
  if (!format) return null;
  const document = editor.ownerDocument;
  const makeWrapper = (): HTMLElement => {
    const wrapper = document.createElement(format.tag);
    if (format.className) wrapper.className = format.className;
    return wrapper;
  };
  const result = document.createRange();
  if (range.collapsed) {
    const wrapper = makeWrapper();
    const placeholder = document.createTextNode(CARET_PLACEHOLDER);
    wrapper.append(placeholder);
    range.insertNode(wrapper);
    result.setStart(placeholder, 0);
    result.collapse(true);
  } else {
    const walker = document.createTreeWalker(editor, 4);
    const parts: Array<{ node: Text; start: number; end: number }> = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!range.intersectsNode(node) || node.parentElement?.closest('[contenteditable="false"]')) continue;
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.length;
      if (end > start) parts.push({ node, start, end });
    }
    const wrappers: HTMLElement[] = [];
    parts.forEach(({ node, start, end }) => {
      const fragmentRange = document.createRange();
      fragmentRange.setStart(node, start);
      fragmentRange.setEnd(node, end);
      const wrapper = makeWrapper();
      fragmentRange.surroundContents(wrapper);
      wrappers.push(wrapper);
    });
    if (!wrappers.length) return null;
    result.setStart(wrappers[0], 0);
    const last = wrappers[wrappers.length - 1];
    result.setEnd(last, last.childNodes.length);
  }
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(result);
  return result.cloneRange();
};
