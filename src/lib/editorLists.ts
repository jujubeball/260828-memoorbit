import { isEditorRange } from "@/src/lib/editorSelection";

// 💡 [키보드 없이 문단 명령 적용]
// 읽기 상태에서도 선택한 문단의 DOM을 직접 옮겨 목록과 들여쓰기를 적용합니다. 포커스가 필요한 브라우저 편집 명령은 사용하지 않습니다.
export function formatEditorList(editor: HTMLElement, range: Range, command: string): Range | null {
  if (!isEditorRange(editor, range)) return null;
  if (!["insertUnorderedList", "insertOrderedList", "indent", "outdent"].includes(command)) return null;
  const document = editor.ownerDocument;
  const collapsed = range.collapsed;
  const blocks = new Set<HTMLElement>();
  const walker = document.createTreeWalker(editor, 4);
  const selectedNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const readOnlyParent = node.parentElement?.closest('[contenteditable="false"]');
    if (!range.intersectsNode(node) || (readOnlyParent && readOnlyParent !== editor)) continue;
    selectedNodes.push(node);
  }
  // 문단을 옮기면 살아 있는 Range도 변하므로 양 끝의 글자 노드와 인덱스를 먼저 보관합니다.
  const first = selectedNodes[0];
  const last = selectedNodes.at(-1);
  const startOffset = range.startContainer === first ? range.startOffset : 0;
  const endOffset = range.endContainer === last ? range.endOffset : last?.length ?? 0;
  const collectBlock = (node: Node): void => {
    const element = node.nodeType === 1 ? node as HTMLElement : node.parentElement;
    const block = element?.closest<HTMLElement>("li, p, h1, h2, h3, pre, div");
    if (block && block !== editor && editor.contains(block)) {
      blocks.add(block);
      return;
    }
    if (node === editor || !editor.contains(node)) return;
    // 문단 태그 없이 바로 입력된 글자는 같은 줄의 인라인 요소와 함께 문단으로 묶습니다.
    let rootChild = node;
    while (rootChild.parentNode && rootChild.parentNode !== editor) rootChild = rootChild.parentNode;
    const isBlock = (candidate: Node): boolean => candidate.nodeType === 1
      && /^(P|DIV|H[1-6]|UL|OL|PRE|TABLE|BLOCKQUOTE)$/.test((candidate as Element).tagName);
    if (isBlock(rootChild)) return;
    let firstInline = rootChild;
    while (firstInline.previousSibling && !isBlock(firstInline.previousSibling)) firstInline = firstInline.previousSibling;
    const paragraph = document.createElement("p");
    editor.insertBefore(paragraph, firstInline);
    let inline: Node | null = firstInline;
    while (inline && !isBlock(inline)) {
      const next: Node | null = inline.nextSibling;
      paragraph.append(inline);
      inline = next;
    }
    blocks.add(paragraph);
  };
  selectedNodes.forEach(collectBlock);
  if (!blocks.size) {
    const container = range.startContainer;
    const candidate = container.nodeType === 1
      ? container.childNodes.item(range.startOffset) ?? container.childNodes.item(range.startOffset - 1) ?? container
      : container;
    collectBlock(candidate);
  }
  if (!blocks.size) {
    const paragraph = document.createElement("p");
    paragraph.append(document.createElement("br"));
    range.insertNode(paragraph);
    blocks.add(paragraph);
  }
  // 상위 문단을 통째로 옮길 때 그 안의 중첩 목록을 다시 처리하지 않습니다.
  const targets = [...blocks].filter((block) => ![...blocks].some((other) => other !== block && other.contains(block)));
  const tag = command === "insertOrderedList" ? "OL" : "UL";
  const removeList = targets.every((block) => block.tagName === "LI" && block.parentElement?.tagName === tag);
  let caretTarget: HTMLElement = editor;
  const outdentTails = new Map<HTMLElement, HTMLElement>();
  // 선택된 항목만 기존 목록에서 분리해 앞뒤의 선택되지 않은 목록을 유지합니다.
  const detachItem = (item: HTMLElement, replacement: HTMLElement): void => {
    const list = item.parentElement!;
    const tail = list.cloneNode(false) as HTMLElement;
    while (item.nextSibling) tail.append(item.nextSibling);
    item.remove();
    list.after(replacement);
    if (tail.hasChildNodes()) replacement.after(tail);
    if (!list.hasChildNodes()) list.remove();
  };
  targets.forEach((block) => {
    caretTarget = block;
    if (command === "indent") {
      const previous = block.previousElementSibling;
      if (block.tagName === "LI" && previous?.tagName === "LI") {
        const listTag = block.parentElement!.tagName;
        const nested = previous.lastElementChild?.tagName === listTag
          ? previous.lastElementChild
          : previous.appendChild(document.createElement(listTag.toLowerCase()));
        nested.append(block);
      } else if (block.tagName !== "LI") block.classList.add("ml-6");
      return;
    }
    if (command === "outdent" && block.tagName !== "LI") {
      block.classList.remove("ml-6");
      return;
    }
    if (command === "outdent" && block.parentElement?.parentElement?.tagName === "LI") {
      const list = block.parentElement;
      const parentItem = list.parentElement!;
      (outdentTails.get(parentItem) ?? parentItem).after(block);
      outdentTails.set(parentItem, block);
      if (!list.hasChildNodes()) list.remove();
      return;
    }
    if (removeList || command === "outdent") {
      const paragraph = document.createElement("p");
      paragraph.append(...block.childNodes);
      detachItem(block, paragraph);
      caretTarget = paragraph;
      return;
    }
    const list = document.createElement(tag.toLowerCase());
    const item = document.createElement("li");
    item.append(...block.childNodes);
    list.append(item);
    caretTarget = item;
    if (block.tagName === "LI") detachItem(block, list);
    else block.replaceWith(list);
    const previous = list.previousElementSibling;
    if (previous?.tagName === tag) {
      previous.append(...list.childNodes);
      list.remove();
    }
  });
  const restored = document.createRange();
  if (first && last && editor.contains(first) && editor.contains(last)) {
    restored.setStart(first, startOffset);
    restored.setEnd(last, collapsed ? startOffset : endOffset);
  } else {
    restored.selectNodeContents(caretTarget);
    restored.collapse(true);
  }
  return restored;
}
