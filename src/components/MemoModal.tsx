"use client";

import {
  type FormEvent,
  type MouseEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Memo } from "@/types/memo";

export interface MemoDraft {
  text: string;
  tags: string;
}

interface MemoModalProps {
  isOpen: boolean;
  editingMemo: Memo | null;
  onClose: () => void;
  onSubmit: (draft: MemoDraft) => void;
}

type BlockStyle = "title" | "heading" | "body";

const parseTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

export function MemoModal({
  isOpen,
  editingMemo,
  onClose,
  onSubmit,
}: MemoModalProps): React.JSX.Element | null {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<MemoDraft>(() => ({
    text: editingMemo
      ? [editingMemo.title, editingMemo.content].filter(Boolean).join("\n")
      : "",
    tags: editingMemo?.tags.join(", ") ?? "",
  }));

  const recommendedTags = useMemo(() => {
    const tags: string[] = [];

    if (/[가-힣]/.test(draft.text)) tags.push("생각", "기록");
    if (/react/i.test(draft.text)) tags.push("React");
    if (/next(?:\.js)?/i.test(draft.text)) tags.push("Next.js");

    return [...new Set(tags)];
  }, [draft.text]);

  if (!isOpen) return null;

  const replaceSelection = (
    replacement: string,
    selectionOffset = replacement.length,
  ): void => {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const nextText = `${draft.text.slice(0, start)}${replacement}${draft.text.slice(end)}`;

    setDraft((value) => ({ ...value, text: nextText }));
    requestAnimationFrame(() => {
      editor.focus();
      const cursor = start + selectionOffset;
      editor.setSelectionRange(cursor, cursor);
    });
  };

  const preserveSelection = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
  };

  const applyBold = (): void => {
    const editor = editorRef.current;
    if (!editor) return;

    const selectedText = draft.text.slice(editor.selectionStart, editor.selectionEnd);
    const value = selectedText || "굵은 텍스트";
    replaceSelection(`**${value}**`, value.length + 4);
  };

  const applyBlockStyle = (style: BlockStyle): void => {
    const editor = editorRef.current;
    if (!editor) return;

    const lineStart = draft.text.lastIndexOf("\n", editor.selectionStart - 1) + 1;
    const nextLineIndex = draft.text.indexOf("\n", editor.selectionEnd);
    const lineEnd = nextLineIndex === -1 ? draft.text.length : nextLineIndex;
    const selectedLines = draft.text.slice(lineStart, lineEnd);
    const prefix = style === "title" ? "# " : style === "heading" ? "## " : "";
    const formatted = selectedLines
      .split("\n")
      .map((line) => `${prefix}${line.replace(/^#{1,2}\s+/, "")}`)
      .join("\n");
    const nextText = `${draft.text.slice(0, lineStart)}${formatted}${draft.text.slice(lineEnd)}`;

    setDraft((value) => ({ ...value, text: nextText }));
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(lineStart + formatted.length, lineStart + formatted.length);
    });
  };

  const insertChecklist = (): void => {
    const editor = editorRef.current;
    if (!editor) return;

    const selectedText = draft.text.slice(editor.selectionStart, editor.selectionEnd);
    const checklist = (selectedText || "할 일")
      .split("\n")
      .map((line) => `- [ ] ${line}`)
      .join("\n");
    replaceSelection(checklist);
  };

  const insertTable = (): void => {
    const table = [
      "| 항목 | 내용 |",
      "| --- | --- |",
      "| 이름 | 값을 입력하세요 |",
      "| 이름 | 값을 입력하세요 |",
    ].join("\n");

    replaceSelection(table);
  };

  const toggleTag = (tag: string): void => {
    const current = parseTags(draft.tags);
    const next = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag];

    setDraft((value) => ({ ...value, tags: next.join(", ") }));
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (draft.text.trim()) {
      onSubmit({ ...draft, text: draft.text.trim() });
    }
  };

  const toolbarButtonClass =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memo-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <header className="flex items-center justify-between">
          <h2 id="memo-modal-title" className="text-xl font-bold">
            {editingMemo ? "메모 수정" : "새 메모"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            닫기
          </button>
        </header>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div
            className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2"
            role="toolbar"
            aria-label="메모 서식"
          >
            <button type="button" onMouseDown={preserveSelection} onClick={() => applyBlockStyle("title")} className={toolbarButtonClass}>
              제목
            </button>
            <button type="button" onMouseDown={preserveSelection} onClick={() => applyBlockStyle("heading")} className={toolbarButtonClass}>
              머리말
            </button>
            <button type="button" onMouseDown={preserveSelection} onClick={() => applyBlockStyle("body")} className={toolbarButtonClass}>
              본문
            </button>
            <button type="button" onMouseDown={preserveSelection} onClick={applyBold} className={toolbarButtonClass} aria-label="굵게">
              <strong>가</strong>
            </button>
            <button type="button" onMouseDown={preserveSelection} onClick={insertChecklist} className={toolbarButtonClass}>
              체크리스트
            </button>
            <button type="button" onMouseDown={preserveSelection} onClick={insertTable} className={toolbarButtonClass}>
              표
            </button>
          </div>

          <label className="block">
            <span className="sr-only">메모 내용</span>
            <textarea
              ref={editorRef}
              autoFocus
              rows={12}
              value={draft.text}
              onChange={(event) =>
                setDraft((value) => ({ ...value, text: event.target.value }))
              }
              className="w-full resize-none rounded-xl border border-slate-200 p-4 text-base leading-7 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              placeholder={"첫 줄에 제목을 쓰고\n다음 줄부터 생각을 자유롭게 적어 보세요."}
            />
          </label>

          <label className="block text-sm font-semibold">
            태그
            <input
              value={draft.tags}
              onChange={(event) =>
                setDraft((value) => ({ ...value, tags: event.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="일상, 생각 (쉼표로 구분)"
            />
          </label>

          {recommendedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 rounded-xl bg-violet-50 p-3">
              {recommendedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-700"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-slate-600">
              취소
            </button>
            <button
              type="submit"
              disabled={!draft.text.trim()}
              className="rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
            >
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
