"use client";

import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
interface BubblePosition {
  left: number;
  top: number;
}

const COLORS = ["#2563eb", "#0f766e", "#ea580c", "#db2777", "#7c3aed"];
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
  container
    .querySelectorAll("script, style, iframe, object, embed")
    .forEach((element) => element.remove());
  container.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (attribute.name.startsWith("on"))
        element.removeAttribute(attribute.name);
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
  const savedRange = useRef<Range | null>(null);
  const [plainText, setPlainText] = useState(
    editingMemo
      ? [editingMemo.title, editingMemo.content].filter(Boolean).join("\n")
      : "",
  );
  const [analyzedText, setAnalyzedText] = useState(plainText);
  const [tags, setTags] = useState(editingMemo?.tags.join(", ") ?? "");
  const [isMobileToolbarOpen, setIsMobileToolbarOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteCommand, setPaletteCommand] = useState<
    "foreColor" | "hiliteColor"
  >("foreColor");
  const [bubblePosition, setBubblePosition] = useState<BubblePosition | null>(
    null,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setAnalyzedText(plainText), 300);
    return () => window.clearTimeout(timer);
  }, [plainText]);

  useEffect(() => {
    const trackSelection = (): void => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (
        !editor ||
        !selection ||
        selection.rangeCount === 0 ||
        selection.isCollapsed
      ) {
        setBubblePosition(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) {
        setBubblePosition(null);
        return;
      }
      savedRange.current = range.cloneRange();
      const rect = range.getBoundingClientRect();
      setBubblePosition({
        left: Math.min(
          window.innerWidth - 170,
          Math.max(170, rect.left + rect.width / 2),
        ),
        top: Math.max(12, rect.top - 58),
      });
    };
    document.addEventListener("selectionchange", trackSelection);
    return () =>
      document.removeEventListener("selectionchange", trackSelection);
  }, []);

  const recommendedTags = useMemo(
    () => extractTags(analyzedText),
    [analyzedText],
  );
  if (!isOpen) return null;

  const restoreSelection = (): void => {
    const selection = window.getSelection();
    if (!selection || !savedRange.current) return;
    selection.removeAllRanges();
    selection.addRange(savedRange.current);
  };
  const runCommand = (command: string, value?: string): void => {
    editorRef.current?.focus({ preventScroll: true });
    restoreSelection();
    document.execCommand(command, false, value);
    setPlainText(editorRef.current?.innerText ?? "");
  };
  const keepSelection = (event: ReactMouseEvent<HTMLButtonElement>): void =>
    event.preventDefault();
  const insertChecklist = (): void =>
    runCommand(
      "insertHTML",
      '<div class="memo-check-item"><label><input type="checkbox" contenteditable="false"><span><br></span></label></div><div><br></div>',
    );
  const insertTable = (): void =>
    runCommand(
      "insertHTML",
      "<table><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table><div><br></div>",
    );
  const insertDashedList = (): void =>
    runCommand("insertHTML", '<ul class="dashed-list"><li><br></li></ul>');
  const toggleTag = (tag: string): void => {
    const current = tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setTags(
      (current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
      ).join(", "),
    );
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
  const buttonClass =
    "interactive-control flex h-10 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold text-stone-800 transition active:scale-95";

  const formattingControls = (
    <>
      <div
        className="flex min-w-max rounded-xl bg-stone-200/80 p-1"
        aria-label="텍스트 스타일"
      >
        {[
          ["제목", "h1"],
          ["머리말", "h2"],
          ["부머리말", "h3"],
          ["본문", "p"],
          ["모노", "pre"],
        ].map(([label, format]) => (
          <button
            key={format}
            type="button"
            onMouseDown={keepSelection}
            onClick={() => runCommand("formatBlock", format)}
            className={buttonClass}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="flex min-w-max rounded-xl bg-stone-200/80 p-1"
        aria-label="글자 서식"
      >
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => runCommand("bold")}
          className={buttonClass}
          aria-label="굵게"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => runCommand("italic")}
          className={buttonClass}
          aria-label="기울임"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => runCommand("underline")}
          className={buttonClass}
          aria-label="밑줄"
        >
          <span className="underline">U</span>
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => runCommand("strikeThrough")}
          className={buttonClass}
          aria-label="취소선"
        >
          <span className="line-through">S</span>
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => setIsPaletteOpen((current) => !current)}
          className={buttonClass}
          aria-label="글자 색상"
        >
          ✎
        </button>
      </div>
      {isPaletteOpen && (
        <div
          className="flex min-w-max flex-col gap-2 rounded-xl bg-stone-200/80 p-2"
          aria-label="글자 및 형광펜 색상 팔레트"
        >
          <div className="flex rounded-lg bg-stone-300 p-0.5">
            <button
              type="button"
              onMouseDown={keepSelection}
              onClick={() => setPaletteCommand("foreColor")}
              className={buttonClass}
              aria-pressed={paletteCommand === "foreColor"}
            >
              글자
            </button>
            <button
              type="button"
              onMouseDown={keepSelection}
              onClick={() => setPaletteCommand("hiliteColor")}
              className={buttonClass}
              aria-pressed={paletteCommand === "hiliteColor"}
            >
              형광펜
            </button>
          </div>
          <div className="flex items-center gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onMouseDown={keepSelection}
                onClick={() => runCommand(paletteCommand, color)}
                aria-label={`${color} ${paletteCommand === "foreColor" ? "글자" : "형광펜"} 색상`}
                className="h-7 w-7 shrink-0 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}
      <div
        className="flex min-w-max rounded-xl bg-stone-200/80 p-1"
        aria-label="목록과 들여쓰기"
      >
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => runCommand("insertUnorderedList")}
          className={buttonClass}
        >
          • 목록
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={insertDashedList}
          className={buttonClass}
        >
          − 목록
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => runCommand("insertOrderedList")}
          className={buttonClass}
        >
          1. 목록
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => runCommand("outdent")}
          className={buttonClass}
          aria-label="내어쓰기"
        >
          ←
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => runCommand("indent")}
          className={buttonClass}
          aria-label="들여쓰기"
        >
          →
        </button>
      </div>
      <div
        className="flex min-w-max rounded-xl bg-stone-200/80 p-1"
        aria-label="삽입 도구"
      >
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={insertChecklist}
          className={buttonClass}
        >
          체크리스트
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={insertTable}
          className={buttonClass}
        >
          표
        </button>
      </div>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex w-full min-w-full items-stretch justify-center overflow-hidden bg-[#faf9f6] sm:items-center sm:bg-stone-950/45 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memo-modal-title"
    >
      <div className="flex h-dvh w-full min-w-full flex-col overflow-hidden bg-[#faf9f6] sm:h-[90dvh] sm:min-w-0 sm:max-w-3xl sm:rounded-3xl sm:border sm:border-stone-200 sm:shadow-2xl">
        <header className="z-20 flex shrink-0 items-center justify-between border-b border-stone-200 bg-[#faf9f6]/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="interactive-control rounded-xl px-3 py-2 text-sm font-semibold text-stone-700"
          >
            취소
          </button>
          <h2
            id="memo-modal-title"
            className="text-base font-bold text-stone-900"
          >
            {editingMemo ? "메모 수정" : "새 메모"}
          </h2>
          <button
            type="submit"
            form="memo-form"
            disabled={!plainText.trim()}
            className="interactive-control rounded-xl px-3 py-2 text-sm font-bold text-amber-700 disabled:opacity-40"
          >
            완료
          </button>
        </header>
        <form
          id="memo-form"
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 overscroll-contain sm:px-8 sm:py-7">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-label="메모"
              aria-multiline="true"
              onInput={(event) => setPlainText(event.currentTarget.innerText)}
              className="rich-editor min-h-full w-full select-text overflow-x-hidden text-base leading-7 text-stone-800 outline-none"
              dangerouslySetInnerHTML={{
                __html: createInitialHtml(editingMemo),
              }}
            />
          </div>
          <div className="z-20 shrink-0 border-t border-stone-200 bg-[#faf9f6]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMobileToolbarOpen(true)}
                className="interactive-control rounded-xl bg-stone-200 px-3 py-2 font-bold text-stone-800 sm:hidden"
                aria-label="서식 도구 열기"
              >
                Aa
              </button>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-stone-200"
                placeholder="태그 추가 (쉼표로 구분)"
                aria-label="태그"
              />
            </div>
            {recommendedTags.length > 0 && (
              <div
                className="mt-2 flex gap-2 overflow-x-auto pb-1"
                aria-label="실시간 추천 태그"
              >
                {recommendedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={tags
                      .split(",")
                      .map((item) => item.trim())
                      .includes(tag)}
                    className="interactive-control shrink-0 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-800"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>
      {bubblePosition && (
        <div
          className="fixed z-[120] hidden max-w-[min(92vw,760px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-2xl border border-stone-700 bg-stone-900 p-1.5 shadow-2xl sm:flex"
          style={{ left: bubblePosition.left, top: bubblePosition.top }}
          role="toolbar"
          aria-label="선택 영역 서식 도구"
        >
          {formattingControls}
        </div>
      )}
      {isMobileToolbarOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-end bg-stone-950/30 sm:hidden"
          onClick={() => setIsMobileToolbarOpen(false)}
        >
          <section
            className="max-h-[72dvh] w-full overflow-y-auto rounded-t-3xl bg-[#faf9f6] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            aria-label="서식 도구"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-300" />
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-900">포맷</h3>
              <button
                type="button"
                onClick={() => setIsMobileToolbarOpen(false)}
                className="interactive-control rounded-lg px-3 py-2 text-sm font-bold text-amber-700"
              >
                완료
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-3 overflow-x-auto">
              {formattingControls}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
