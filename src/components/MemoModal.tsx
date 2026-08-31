"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Memo } from "@/types/memo";

export interface MemoDraft {
  title: string;
  content: string;
  richContent: string;
  tags: string;
}

interface MemoModalProps {
  isOpen: boolean;
  editingMemo: Memo | null;
  onClose: () => void;
  onSubmit: (draft: MemoDraft) => void;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const createInitialHtml = (memo: Memo | null): string => {
  if (memo?.richContent) return memo.richContent;
  if (!memo) return "";

  const body = memo.content
    .split("\n")
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");

  return `<h1>${escapeHtml(memo.title)}</h1>${body}`;
};

const extractTags = (text: string): string[] => {
  const rules: Array<[RegExp, string]> = [
    [/운동|달리기|수영|산책/, "운동"],
    [/아이|육아|어린이|가족/, "육아"],
    [/개발|코드|react|next|typescript/i, "개발"],
    [/장보기|마트|구매|식재료/, "장보기"],
    [/여행|숙소|기차|비행기/, "여행"],
    [/책|독서|문장/, "독서"],
    [/오늘|일상|아침|저녁/, "일상"],
  ];

  return rules.filter(([pattern]) => pattern.test(text)).map(([, tag]) => tag);
};

const sanitizeEditorHtml = (html: string): string => {
  const container = document.createElement("div");
  container.innerHTML = html;
  container.querySelectorAll("script, style, iframe, object, embed").forEach((element) => element.remove());
  container.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (attribute.name.startsWith("on")) element.removeAttribute(attribute.name);
    });
  });
  return container.innerHTML;
};

export function MemoModal({
  isOpen,
  editingMemo,
  onClose,
  onSubmit,
}: MemoModalProps): React.JSX.Element | null {
  const editorRef = useRef<HTMLDivElement>(null);
  const [plainText, setPlainText] = useState(
    editingMemo
      ? [editingMemo.title, editingMemo.content].filter(Boolean).join("\n")
      : "",
  );
  const [analyzedText, setAnalyzedText] = useState(plainText);
  const [tags, setTags] = useState(editingMemo?.tags.join(", ") ?? "");

  useEffect(() => {
    const debounceTimer = window.setTimeout(() => {
      setAnalyzedText(plainText);
    }, 300);

    return () => window.clearTimeout(debounceTimer);
  }, [plainText]);

  const recommendedTags = useMemo(() => extractTags(analyzedText), [analyzedText]);

  if (!isOpen) return null;

  const runCommand = (command: string, value?: string): void => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setPlainText(editorRef.current?.innerText ?? "");
  };

  const insertChecklist = (): void => {
    runCommand(
      "insertHTML",
      '<div class="memo-check-item"><label><input type="checkbox" contenteditable="false"><span>할 일</span></label></div><div><br></div>',
    );
  };

  const insertTable = (): void => {
    runCommand(
      "insertHTML",
      '<table><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table><div><br></div>',
    );
  };

  const toggleTag = (tag: string): void => {
    const current = tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const next = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag];

    setTags(next.join(", "));
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor?.innerText.trim()) return;

    const [title, ...bodyLines] = editor.innerText.split("\n");
    onSubmit({
      title: title.trim(),
      content: bodyLines.join("\n").trim(),
      richContent: sanitizeEditorHtml(editor.innerHTML),
      tags,
    });
  };

  const toolbarButtonClass =
    "interactive-control rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700 transition active:scale-95";

  return (
    <div
      className="fixed inset-0 z-[100] flex w-full min-w-full items-end justify-center overflow-hidden bg-stone-950/45 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memo-modal-title"
    >
      <div className="flex h-[90dvh] max-h-[90vh] w-full min-w-full flex-col overflow-hidden rounded-t-3xl bg-[#faf9f6] shadow-2xl sm:min-w-0 sm:max-w-2xl sm:rounded-3xl">
        <header className="z-20 flex shrink-0 items-center justify-between gap-4 border-b border-stone-200 bg-[#faf9f6]/95 px-4 py-4 backdrop-blur sm:px-6">
          <h2 id="memo-modal-title" className="text-xl font-bold text-stone-900">
            {editingMemo ? "메모 수정" : "새 메모"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="메모 편집기 닫기"
            className="interactive-control rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 active:scale-95"
          >
            닫기
          </button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div
            className="z-10 flex max-w-full shrink-0 gap-2 overflow-x-auto border-b border-stone-200 bg-stone-100/95 p-2 px-4 backdrop-blur sm:px-6"
            role="toolbar"
            aria-label="메모 서식 도구"
          >
            <button type="button" onClick={() => runCommand("formatBlock", "h1")} className={toolbarButtonClass} aria-label="제목 서식 적용">
              제목
            </button>
            <button type="button" onClick={() => runCommand("formatBlock", "h2")} className={toolbarButtonClass} aria-label="머리말 서식 적용">
              머리말
            </button>
            <button type="button" onClick={() => runCommand("formatBlock", "p")} className={toolbarButtonClass} aria-label="본문 서식 적용">
              본문
            </button>
            <button type="button" onClick={() => runCommand("bold")} className={toolbarButtonClass} aria-label="선택한 글자를 굵게">
              <strong>가</strong>
            </button>
            <button type="button" onClick={insertChecklist} className={toolbarButtonClass} aria-label="체크리스트 삽입">
              체크리스트
            </button>
            <button type="button" onClick={insertTable} className={toolbarButtonClass} aria-label="표 삽입">
              표
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-3 overscroll-contain sm:px-6">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-label="메모 제목과 본문"
              aria-multiline="true"
              data-placeholder="첫 줄에 제목을 쓰고 다음 줄부터 생각을 자유롭게 적어 보세요."
              onInput={(event) => setPlainText(event.currentTarget.innerText)}
              className="rich-editor min-h-full w-full overflow-x-hidden text-base leading-7 text-stone-800 outline-none"
              dangerouslySetInnerHTML={{ __html: createInitialHtml(editingMemo) }}
            />
          </div>

          <div className="z-20 shrink-0 space-y-3 border-t border-stone-200 bg-[#faf9f6]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6">
            <label className="block text-sm font-semibold text-stone-800">
              <span className="sr-only">태그</span>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
                placeholder="태그 추가 (쉼표로 구분)"
              />
            </label>

            {recommendedTags.length > 0 && (
              <section aria-label="실시간 추천 태그">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {recommendedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-pressed={tags.split(",").map((item) => item.trim()).includes(tag)}
                      className="interactive-control shrink-0 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 active:scale-95"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="interactive-control rounded-xl px-4 py-2 text-stone-700 active:scale-95">
                취소
              </button>
              <button
                type="submit"
                disabled={!plainText.trim()}
                className="interactive-control rounded-xl bg-stone-800 px-4 py-2 font-semibold text-white active:scale-95 disabled:opacity-40"
              >
                저장
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
