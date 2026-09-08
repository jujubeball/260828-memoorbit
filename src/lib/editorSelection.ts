// 빈 서식 영역 안에도 커서를 둘 수 있게 하는 임시 문자이며 저장할 때는 제거합니다.
export const CARET_PLACEHOLDER = String.fromCharCode(8203);

interface InlineFormat {
  tag: "strong" | "em" | "u" | "s" | "span";
  className?: string;
}

export interface EditorFormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  block: string | null;
  color: string | null;
}

export const EMPTY_EDITOR_FORMAT: EditorFormatState = {
  bold: false, italic: false, underline: false, strikeThrough: false, block: null, color: null,
};

const SIMPLE_TAGS: Record<string, string[]> = {
  bold: ["STRONG", "B"], italic: ["EM", "I"], underline: ["U"], strikeThrough: ["S", "STRIKE", "DEL"],
};

const BLOCK_STYLES: Record<string, string> = {
  h1: "text-2xl font-bold", h2: "text-xl font-bold", h3: "text-lg font-semibold",
  p: "text-base font-normal", pre: "font-mono text-base font-normal",
};
const COLOR_STYLES: Record<string, string> = {
  "#ffffff": "text-white", "#e5a93c": "text-[#e5a93c]", "#ff453a": "text-[#ff453a]",
  "#0a84ff": "text-[#0a84ff]", "#30d158": "text-[#30d158]",
};

const selectedTextParts = (editor: HTMLElement, range: Range): Array<{ node: Text; start: number; end: number }> => {
  const walker = editor.ownerDocument.createTreeWalker(editor, 4);
  const parts: Array<{ node: Text; start: number; end: number }> = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!range.intersectsNode(node) || node.parentElement?.closest('[contenteditable="false"]')) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end > start) parts.push({ node, start, end });
  }
  return parts;
};

// 커서부터 부모 방향으로 가까운 명시적 서식을 읽어 중첩 서식과 일반 글자 전환을 구분합니다.
const formatAtNode = (editor: HTMLElement, node: Node): EditorFormatState => {
  const result = { ...EMPTY_EDITOR_FORMAT };
  const found = new Set<string>();
  let element = node.nodeType === 1 ? node as HTMLElement : node.parentElement;
  while (element && element !== editor) {
    for (const command of ["bold", "italic", "underline", "strikeThrough"] as const) {
      if (found.has(command)) continue;
      const disabled = element.dataset[`off${command}`] === "true"
        || (command === "bold" && element.classList.contains("font-normal"));
      const enabled = SIMPLE_TAGS[command].includes(element.tagName)
        || (command === "bold" && (element.classList.contains("font-bold") || /^H[1-3]$/.test(element.tagName)));
      if (disabled || enabled) { result[command] = !disabled; found.add(command); }
    }
    if (!found.has("block")) {
      const legacyBlock = Object.entries(BLOCK_STYLES).find(([, classes]) => classes.split(" ").every((name) => element!.classList.contains(name)))?.[0];
      const block = element.dataset.formatBlock ?? legacyBlock ?? (/^(H[1-3]|PRE)$/.test(element.tagName) ? element.tagName.toLowerCase() : undefined);
      if (block !== undefined) { result.block = block === "none" ? null : block; found.add("block"); }
    }
    const color = element.dataset.formatColor ?? Object.entries(COLOR_STYLES).find(([, name]) => element!.classList.contains(name))?.[0];
    if (!found.has("color") && color !== undefined) {
      result.color = color || null;
      found.add("color");
    }
    element = element.parentElement;
  }
  return result;
};

// 💡 [선택 범위의 버튼 상태]
// 여러 글자가 섞인 선택은 모든 글자에 적용된 서식만 활성화하고 커서만 있으면 그 위치의 상태를 표시합니다.
export const readEditorFormat = (editor: HTMLElement, range: Range | null): EditorFormatState => {
  if (!range || !isEditorRange(editor, range)) return { ...EMPTY_EDITOR_FORMAT };
  let caretNode = range.startContainer;
  if (range.collapsed && caretNode.nodeType === 1) {
    caretNode = caretNode.childNodes.item(Math.max(0, range.startOffset - 1)) ?? caretNode;
  }
  const nodes = range.collapsed ? [caretNode] : selectedTextParts(editor, range).map((part) => part.node);
  if (!nodes.length) return { ...EMPTY_EDITOR_FORMAT };
  const states = nodes.map((node) => formatAtNode(editor, node));
  return {
    bold: states.every((state) => state.bold), italic: states.every((state) => state.italic),
    underline: states.every((state) => state.underline), strikeThrough: states.every((state) => state.strikeThrough),
    block: states.every((state) => state.block === states[0].block) ? states[0].block : null,
    color: states.every((state) => state.color === states[0].color) ? states[0].color : null,
  };
};

// 💡 [선택 부분의 서식만 해제]
// 서식 부모를 앞·선택·뒤로 나눠 선택 밖의 글자는 그대로 둡니다. 안쪽의 다른 서식도 유지합니다.
const stripFormat = (editor: HTMLElement, text: Text, command: string): void => {
  let element = text.parentElement?.parentElement ?? null;
  while (element && element !== editor) {
    const parent = element.parentElement;
    const matches = (SIMPLE_TAGS[command]?.includes(element.tagName) ?? false)
      || (command === "formatBlock" && (element.dataset.formatBlock !== undefined || Object.values(BLOCK_STYLES).some((classes) => classes.split(" ").every((name) => element!.classList.contains(name)))))
      || (command === "foreColor" && (element.dataset.formatColor !== undefined || Object.values(COLOR_STYLES).some((name) => element!.classList.contains(name))));
    if (matches) {
      const before = editor.ownerDocument.createRange();
      before.selectNodeContents(element);
      before.setEndBefore(text);
      const prefix = before.extractContents();
      const after = editor.ownerDocument.createRange();
      after.selectNodeContents(element);
      after.setStartAfter(text);
      const suffix = after.extractContents();
      if (prefix.hasChildNodes()) {
        const copy = element.cloneNode(false);
        copy.appendChild(prefix);
        element.before(copy);
      }
      if (suffix.hasChildNodes()) {
        const copy = element.cloneNode(false);
        copy.appendChild(suffix);
        element.after(copy);
      }
      const replacement = editor.ownerDocument.createElement("span");
      [...element.attributes].forEach((attribute) => replacement.setAttribute(attribute.name, attribute.value));
      if (command === "formatBlock") {
        delete replacement.dataset.formatBlock;
        replacement.classList.remove(...new Set(Object.values(BLOCK_STYLES).flatMap((classes) => classes.split(" "))));
      }
      if (command === "foreColor") {
        delete replacement.dataset.formatColor;
        replacement.classList.remove(...Object.values(COLOR_STYLES));
      }
      replacement.append(...element.childNodes);
      if (replacement.getAttribute("class") === "") replacement.removeAttribute("class");
      if (replacement.attributes.length) element.replaceWith(replacement);
      else element.replaceWith(...replacement.childNodes);
    }
    element = parent;
  }
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
  const state = readEditorFormat(editor, range);
  const active = command === "formatBlock" ? state.block === value
    : command === "foreColor" ? state.color === value
      : state[command as "bold" | "italic" | "underline" | "strikeThrough"];
  const document = editor.ownerDocument;
  const makeWrapper = (): HTMLElement => {
    const wrapper = document.createElement(active ? "span" : format.tag);
    if (active) {
      if (command === "formatBlock") { wrapper.dataset.formatBlock = "none"; wrapper.className = "text-base font-normal font-sans"; }
      else if (command === "foreColor") { wrapper.dataset.formatColor = ""; wrapper.className = "text-white"; }
      else { wrapper.dataset[`off${command}`] = "true"; if (command === "bold") wrapper.className = "font-normal"; }
      return wrapper;
    }
    if (format.className) wrapper.className = format.className;
    if (command === "formatBlock") wrapper.dataset.formatBlock = value;
    if (command === "foreColor") wrapper.dataset.formatColor = value;
    return wrapper;
  };
  const result = document.createRange();
  if (range.collapsed) {
    const wrapper = makeWrapper();
    const placeholder = document.createTextNode(CARET_PLACEHOLDER);
    wrapper.append(placeholder);
    range.insertNode(wrapper);
    if (active) stripFormat(editor, placeholder, command);
    result.setStart(placeholder, 0);
    result.collapse(true);
  } else {
    const parts = selectedTextParts(editor, range);
    const wrappers: HTMLElement[] = [];
    parts.forEach(({ node, start, end }) => {
      const fragmentRange = document.createRange();
      fragmentRange.setStart(node, start);
      fragmentRange.setEnd(node, end);
      const wrapper = makeWrapper();
      fragmentRange.surroundContents(wrapper);
      if (active) {
        // 새 중립 래퍼는 잠시 표시를 빼서 기존 서식 부모만 분리합니다.
        const block = wrapper.dataset.formatBlock;
        const color = wrapper.dataset.formatColor;
        delete wrapper.dataset.formatBlock;
        delete wrapper.dataset.formatColor;
        stripFormat(editor, wrapper.firstChild as Text, command);
        if (block !== undefined) wrapper.dataset.formatBlock = block;
        if (color !== undefined) wrapper.dataset.formatColor = color;
      }
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
