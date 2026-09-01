"use client";

import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
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

type PaletteCommand = "foreColor" | "hiliteColor";

const COLORS = ["#1d4ed8", "#0f766e", "#c2410c", "#be185d", "#6d28d9"];

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
    [/아이|육아|어린이집|가족/, "육아"],
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
      if (attribute.name.startsWith("on")) {
        element.removeAttribute(attribute.name);
      }
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
  const [paletteCommand, setPaletteCommand] = useState<PaletteCommand>("foreColor");
  const [bubblePosition, setBubblePosition] = useState<BubblePosition | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnalyzedText(plainText), 300);
    return () => window.clearTimeout(timer);
  }, [plainText]);

  useEffect(() => {
    const trackSelection = (): void => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) {
        setBubblePosition(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) {
        setBubblePosition(null);
        return;
      }
      savedRange.current = range.cloneRange();
      if (selection.isCollapsed) {
        setBubblePosition(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setBubblePosition({
        left: Math.min(window.innerWidth - 170, Math.max(170, rect.left + rect.width / 2)),
        top: Math.max(12, rect.top - 58),
      });
    };
    document.addEventListener("selectionchange", trackSelection);
    return () => document.removeEventListener("selectionchange", trackSelection);
  }, []);

  const recommendedTags = useMemo(() => extractTags(analyzedText), [analyzedText]);
  const selectedTags = useMemo(
    () => tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    [tags],
  );

  if (!isOpen) return null;

  const restoreSelection = (): Range | null => {
    const selection = window.getSelection();
    const range = savedRange.current;
    if (!selection || !range || !editorRef.current?.contains(range.commonAncestorContainer)) {
      return null;
    }
    selection.removeAllRanges();
    selection.addRange(range);
    return range;
  };

  const syncEditorText = (): void => setPlainText(editorRef.current?.innerText ?? "");

  const applySelectionFormat = (command: string, value?: string): void => {
    const range = restoreSelection();
    if (!range || range.collapsed) return;
    document.execCommand(command, false, value);
    const selection = window.getSelection();
    savedRange.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    syncEditorText();
  };

  const insertAtCaret = (html: string): void => {
    editorRef.current?.focus({ preventScroll: true });
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    syncEditorText();
  };

  const keepSelection = (
    event: ReactMouseEvent<HTMLButtonElement> | ReactPointerEvent<HTMLButtonElement>,
  ): void => event.preventDefault();

  const insertChecklist = (): void => {
    insertAtCaret(
      '<div class="memo-check-item"><input type="checkbox" contenteditable="false" aria-label="체크리스트 완료"><span class="memo-check-text"><br></span></div><div><br></div>',
    );
  };

  const insertTable = (): void => {
    insertAtCaret(
      "<table><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table><div><br></div>",
    );
  };

  const toggleTag = (tag: string): void => {
    setTags(
      (selectedTags.includes(tag)
        ? selectedTags.filter((item) => item !== tag)
        : [...selectedTags, tag]
      ).join(", "),
    );
  };

  const handleEditorClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
    if (target.checked) target.setAttribute("checked", "");
    else target.removeAttribute("checked");
    syncEditorText();
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
    "interactive-control flex h-10 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold text-stone-900 transition active:scale-95";

  const formattingControls = (
    <>
      <div className="flex min-w-max rounded-xl bg-stone-200 p-1" aria-label="텍스트 스타일">
        {[["제목", "h1"], ["머리말", "h2"], ["부머리말", "h3"], ["본문", "p"], ["모노", "pre"]].map(
          ([label, format]) => (
            <button
              key={format}
              type="button"
              onPointerDown={keepSelection}
              onClick={() => applySelectionFormat("formatBlock", format)}
              className={buttonClass}
            >
              {label}
            </button>
          ),
        )}
      </div>
      <div className="flex min-w-max rounded-xl bg-stone-200 p-1" aria-label="글자 서식">
        {[["B", "bold", "굵게"], ["I", "italic", "기울임"], ["U", "underline", "밑줄"], ["S", "strikeThrough", "취소선"]].map(
          ([label, command, ariaLabel]) => (
            <button
              key={command}
              type="button"
              onPointerDown={keepSelection}
              onClick={() => applySelectionFormat(command)}
              className={buttonClass}
              aria-label={ariaLabel}
            >
              {label}
            </button>
          ),
        )}
        <button
          type="button"
          onPointerDown={keepSelection}
          onClick={() => setIsPaletteOpen((current) => !current)}
          className={buttonClass}
          aria-expanded={isPaletteOpen}
        >
          색상
        </button>
      </div>
      {isPaletteOpen && (
        <div className="flex min-w-max flex-col gap-2 rounded-xl bg-stone-200 p-2">
          <div className="flex rounded-lg bg-stone-300 p-0.5">
            {(["foreColor", "hiliteColor"] as PaletteCommand[]).map((command) => (
              <button
                key={command}
                type="button"
                onPointerDown={keepSelection}
                onClick={() => setPaletteCommand(command)}
                className={buttonClass}
                aria-pressed={paletteCommand === command}
              >
                {command === "foreColor" ? "글자" : "강조"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onPointerDown={keepSelection}
                onClick={() => applySelectionFormat(paletteCommand, color)}
                aria-label={`${color} 색상`}
                className="format-color-button h-7 w-7 rounded-full border-2 border-white shadow-sm"
                data-color={color}
              />
            ))}
          </div>
        </div>
      )}
      <div className="flex min-w-max rounded-xl bg-stone-200 p-1" aria-label="목록">
        {[["• 목록", "insertUnorderedList"], ["1. 목록", "insertOrderedList"], ["내어쓰기", "outdent"], ["들여쓰기", "indent"]].map(
          ([label, command]) => (
            <button
              key={command}
              type="button"
              onPointerDown={keepSelection}
              onClick={() => applySelectionFormat(command)}
              className={buttonClass}
            >
              {label}
            </button>
          ),
        )}
      </div>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex w-full min-w-full items-stretch justify-center overflow-hidden bg-white xl:items-center xl:bg-stone-950/50 xl:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memo-modal-title"
    >
      <div className="flex h-dvh w-full min-w-full flex-col overflow-hidden bg-[#faf9f6] xl:h-[90dvh] xl:min-w-0 xl:max-w-3xl xl:rounded-3xl xl:border xl:border-stone-300 xl:shadow-2xl">
        <header className="z-20 flex shrink-0 items-center justify-between border-b border-stone-300 bg-[#faf9f6] px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] xl:px-6 xl:py-4">
          <button type="button" onClick={onClose} className="interactive-control rounded-xl px-3 py-2 text-sm font-semibold text-stone-800">
            취소
          </button>
          <h2 id="memo-modal-title" className="text-base font-bold text-stone-950">
            {editingMemo ? "메모 수정" : "새 메모"}
          </h2>
          <button type="submit" form="memo-form" disabled={!plainText.trim()} className="interactive-control rounded-xl px-3 py-2 text-sm font-bold text-amber-800 disabled:opacity-40">
            완료
          </button>
        </header>
        <form id="memo-form" onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 overscroll-contain xl:px-8 xl:py-7">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-label="메모 내용"
              aria-multiline="true"
              onClick={handleEditorClick}
              onInput={(event) => setPlainText(event.currentTarget.innerText)}
              className="rich-editor min-h-full w-full select-text overflow-x-hidden text-base leading-7 text-stone-900 outline-none"
              dangerouslySetInnerHTML={{ __html: createInitialHtml(editingMemo) }}
            />
          </div>
          <div className="z-20 shrink-0 border-t border-stone-300 bg-[#faf9f6] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 xl:px-6">
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 items-center gap-1 xl:hidden">
                <button type="button" onPointerDown={keepSelection} onClick={() => setIsMobileToolbarOpen((current) => !current)} className="interactive-control rounded-lg bg-stone-800 px-3 py-2 text-sm font-bold text-white" aria-expanded={isMobileToolbarOpen}>
                  가가
                </button>
                <button type="button" onPointerDown={keepSelection} onClick={insertChecklist} className="interactive-control rounded-lg px-2 py-2 text-sm font-semibold text-stone-900">
                  체크리스트
                </button>
                <button type="button" onPointerDown={keepSelection} onClick={insertTable} className="interactive-control rounded-lg px-2 py-2 text-sm font-semibold text-stone-900">
                  표
                </button>
              </div>
              <input value={tags} onChange={(event) => setTags(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-stone-400 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:ring-2 focus:ring-amber-700" placeholder="태그 추가" aria-label="태그" />
            </div>
            {recommendedTags.length > 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="실시간 추천 태그">
                {recommendedTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)} aria-pressed={isSelected} className={`interactive-control shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${isSelected ? "border-amber-800 bg-amber-800 text-white" : "border-stone-500 bg-white text-stone-800"}`}>
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      </div>
      {bubblePosition && (
        <div className="fixed z-[120] hidden max-w-[min(92vw,760px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-2xl border border-stone-700 bg-stone-950 p-1.5 shadow-2xl xl:flex" style={{ left: bubblePosition.left, top: bubblePosition.top }} role="toolbar" aria-label="선택 영역 서식 도구">
          {formattingControls}
        </div>
      )}
      {isMobileToolbarOpen && (
        <section className="absolute inset-x-0 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-[130] max-h-[42dvh] overflow-y-auto border-y border-stone-300 bg-[#faf9f6] px-4 py-3 shadow-[0_-8px_24px_rgb(41_37_36/0.12)] xl:hidden" aria-label="서식 도구">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-950">선택 영역 서식</h3>
            <button type="button" onClick={() => setIsMobileToolbarOpen(false)} className="interactive-control rounded-lg px-3 py-2 text-sm font-bold text-amber-800">
              닫기
            </button>
          </div>
          <p className="mt-1 text-xs text-stone-700">본문에서 글자를 선택한 뒤 원하는 서식을 누르세요.</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">{formattingControls}</div>
        </section>
      )}
    </div>
  );
}
