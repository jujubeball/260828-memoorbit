"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { readEditorRange, restoreEditorRange } from "@/src/lib/editorSelection";

interface EditorSnapshot {
  html: string;
  start?: number;
  end?: number;
}

// 💡 [선택 위치의 주소]
// HTML 복원 시 빈 글자 노드가 사라질 수 있으므로 자식 순서 대신 본문 시작부터의 글자 수를 기록합니다.
function textOffset(editor: HTMLElement, node: Node, offset: number): number {
  const prefix = editor.ownerDocument.createRange();
  prefix.selectNodeContents(editor);
  prefix.setEnd(node, offset);
  return prefix.toString().length;
}

export function useEditorHistory(editorRef: RefObject<HTMLDivElement | null>, initialHtml: string) {
  const history = useRef<EditorSnapshot[]>([{ html: initialHtml }]);
  const cursor = useRef(0);
  const [availability, setAvailability] = useState({ undo: false, redo: false });

  // 입력과 서식 명령이 끝날 때 호출합니다. 되돌린 뒤 새로 쓰면 이전의 다시 실행 경로를 버립니다.
  const record = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || history.current[cursor.current].html === editor.innerHTML) return;
    const range = readEditorRange(editor);
    const next: EditorSnapshot = {
      html: editor.innerHTML,
      start: range ? textOffset(editor, range.startContainer, range.startOffset) : undefined,
      end: range ? textOffset(editor, range.endContainer, range.endOffset) : undefined,
    };
    history.current = [...history.current.slice(0, cursor.current + 1), next].slice(-100);
    cursor.current = history.current.length - 1;
    setAvailability({ undo: cursor.current > 0, redo: false });
  }, [editorRef]);

  // 💡 [본문과 선택을 함께 복원]
  // 저장된 HTML을 복원한 다음 글자 수로 선택을 찾아 올립니다. 주소가 없으면 본문 끝에 커서를 둡니다.
  const travel = useCallback((direction: -1 | 1): Range | null => {
    const editor = editorRef.current;
    const nextIndex = cursor.current + direction;
    if (!editor || nextIndex < 0 || nextIndex >= history.current.length) return null;
    cursor.current = nextIndex;
    const snapshot = history.current[nextIndex];
    editor.innerHTML = snapshot.html;
    const findPosition = (offset?: number): { node: Node; offset: number } | null => {
      if (offset === undefined) return null;
      const walker = editor.ownerDocument.createTreeWalker(editor, 4);
      let remaining = offset;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const length = node.textContent?.length ?? 0;
        if (remaining <= length) return { node, offset: remaining };
        remaining -= length;
      }
      return { node: editor, offset: editor.childNodes.length };
    };
    const start = findPosition(snapshot.start);
    const end = findPosition(snapshot.end);
    let range: Range | null = null;
    if (start && end) {
      range = editor.ownerDocument.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
    }
    setAvailability({ undo: nextIndex > 0, redo: nextIndex < history.current.length - 1 });
    return restoreEditorRange(editor, range);
  }, [editorRef]);

  return { record, travel, availability };
}
