"use client";

import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import type { ImageMood, Memo } from "@/types/memo";

export interface MemoDraft {
  title: string;
  content: string;
  richContent: string;
  tags: string;
  imageUrl?: string;
  aiImageMood: ImageMood;
}

interface MemoModalProps {
  isOpen: boolean;
  editingMemo: Memo | null;
  onClose: () => void;
  onSubmit: (draft: MemoDraft) => void;
}

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const createInitialHtml = (memo: Memo | null): string => {
  if (memo?.richContent) return memo.richContent;
  if (!memo) return "";
  const body = memo.content.split("\n").map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`).join("");
  return `<h1>${escapeHtml(memo.title)}</h1>${body}`;
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

const formatDate = (iso?: string): string =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(iso ? new Date(iso) : new Date());

export function MemoModal({ isOpen, editingMemo, onClose, onSubmit }: MemoModalProps): React.JSX.Element | null {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [plainText, setPlainText] = useState(editingMemo ? [editingMemo.title, editingMemo.content].filter(Boolean).join("\n") : "");
  const [imageUrl, setImageUrl] = useState(editingMemo?.imageUrl);
  const [isFormatOpen, setIsFormatOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  if (!isOpen) return null;

  const rememberSelection = (): void => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
    savedRange.current = selection.getRangeAt(0).cloneRange();
  };
  const restoreSelection = (): Range | null => {
    const selection = window.getSelection();
    const range = savedRange.current;
    if (!selection || !range || !editorRef.current?.contains(range.commonAncestorContainer)) return null;
    selection.removeAllRanges();
    selection.addRange(range);
    return range;
  };
  const syncText = (): void => setPlainText(editorRef.current?.innerText ?? "");
  const applyFormat = (command: string, value?: string): void => {
    const range = restoreSelection();
    if (!range || range.collapsed) return;
    document.execCommand(command, false, value);
    rememberSelection();
    syncText();
  };
  const insertAtCaret = (html: string): void => {
    editorRef.current?.focus({ preventScroll: true });
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    syncText();
  };
  const keepSelection = (event: ReactMouseEvent<HTMLButtonElement> | ReactPointerEvent<HTMLButtonElement>): void => event.preventDefault();
  const insertChecklist = (): void => insertAtCaret('<div class="memo-check-item"><input type="checkbox" contenteditable="false" aria-label="체크리스트 완료"><span class="memo-check-text"><br></span></div><div><br></div>');
  const insertTable = (): void => insertAtCaret("<table><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table><div><br></div>");
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor?.innerText.trim()) return;
    const [title, ...body] = editor.innerText.split("\n");
    onSubmit({ title: title.trim(), content: body.join("\n").trim(), richContent: sanitizeEditorHtml(editor.innerHTML), tags: editingMemo?.tags.join(", ") ?? "", imageUrl, aiImageMood: editingMemo?.aiImageMood ?? "수채화" });
  };
  const attachImage = (file: File | undefined): void => {
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => { if (typeof reader.result === "string") setImageUrl(reader.result); });
    reader.readAsDataURL(file);
  };
  const formatButton = "ios-tap flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-[15px] font-semibold text-white";
  const bottomButton = "ios-tap flex h-11 min-w-11 flex-1 items-center justify-center text-[#e5a93c]";

  return (
    <div className="fixed inset-0 z-[100] flex h-dvh flex-col overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-labelledby="memo-modal-title">
      <form id="memo-form" onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-3 pb-2 pt-[max(0.65rem,env(safe-area-inset-top))]">
          <button type="button" onClick={onClose} className="ios-tap flex h-11 items-center gap-1 px-1 text-[17px] text-[#e5a93c]" aria-label="메모 목록으로 돌아가기">
            <span className="text-3xl font-light" aria-hidden="true">‹</span>
            <span className="hidden sm:inline">메모</span>
          </button>
          <h2 id="memo-modal-title" className="sr-only">{editingMemo ? "메모 수정" : "새 메모"}</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => document.execCommand("undo")} className="ios-tap h-11 w-10 text-xl text-[#e5a93c]" aria-label="실행 취소">↶</button>
            <button type="button" className="ios-tap h-11 w-10 text-xl text-[#e5a93c]" aria-label="공유">⇧</button>
            <button type="button" className="ios-tap h-11 w-10 text-xl font-bold text-[#e5a93c]" aria-label="더 보기">•••</button>
            <button type="submit" disabled={!plainText.trim()} className="ios-tap ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#e5a93c] text-lg font-bold text-black disabled:opacity-40" aria-label="완료">✓</button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
          <p className="pb-4 text-center text-xs text-[#8e8e93]">{formatDate(editingMemo?.updatedAt)}</p>
          {imageUrl && (
            <figure className="relative mb-4 overflow-hidden rounded-xl bg-[#1c1c1e]">
              {/* 로컬 파일 미리보기는 운영 저장소 URL로 교체될 예정이다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="첨부한 메모 이미지 미리보기" className="max-h-72 w-full object-cover" />
              <button type="button" onClick={() => setImageUrl(undefined)} className="absolute right-2 top-2 rounded-full bg-black/75 px-3 py-1.5 text-xs">사진 제거</button>
            </figure>
          )}
          <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="메모 내용" aria-multiline="true" onInput={(event) => setPlainText(event.currentTarget.innerText)} onSelect={rememberSelection} onKeyUp={rememberSelection} className="rich-editor min-h-full w-full select-text overflow-x-hidden text-[17px] leading-7 text-white outline-none" data-placeholder="메모를 입력하세요" dangerouslySetInnerHTML={{ __html: createInitialHtml(editingMemo) }} />
        </div>

        <div className="shrink-0 border-t border-[#38383a] bg-[#1c1c1e]/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="mx-auto flex max-w-xl items-center justify-around px-1 py-1">
            <button type="button" onPointerDown={keepSelection} onClick={() => setIsFormatOpen((current) => !current)} className={bottomButton} aria-expanded={isFormatOpen} aria-label="텍스트 서식"><span className="text-base font-semibold" aria-hidden="true">가가</span></button>
            <button type="button" onPointerDown={keepSelection} onClick={insertChecklist} className={bottomButton} aria-label="체크리스트"><span className="text-2xl" aria-hidden="true">✓⃝</span></button>
            <button type="button" onPointerDown={keepSelection} onClick={insertTable} className={bottomButton} aria-label="표"><span className="text-xl" aria-hidden="true">▦</span></button>
            <button type="button" onPointerDown={keepSelection} onClick={() => imageInputRef.current?.click()} className={bottomButton} aria-label="사진 첨부"><span className="text-xl" aria-hidden="true">▧</span></button>
            <button type="button" className={bottomButton} aria-label="손글씨와 드로잉"><span className="text-xl" aria-hidden="true">⌁</span></button>
            <button type="button" className={bottomButton} aria-label="AI 추천"><span className="text-xl" aria-hidden="true">✦</span></button>
            <button type="button" onClick={() => { editorRef.current?.focus(); document.execCommand("selectAll"); document.execCommand("delete"); syncText(); }} className={bottomButton} aria-label="새 메모 작성"><span className="text-xl" aria-hidden="true">□̸</span></button>
            <input ref={imageInputRef} type="file" accept="image/*" onChange={(event) => attachImage(event.target.files?.[0])} className="hidden" />
          </div>
        </div>
      </form>

      <section className={`absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-[#2c2c2e] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_35px_rgb(0_0_0/0.45)] transition-transform duration-300 ${isFormatOpen ? "translate-y-0" : "translate-y-full"}`} aria-label="서식 도구" aria-hidden={!isFormatOpen}>
        <div className="mx-auto max-w-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="h-1 w-9 rounded-full bg-[#636366]" />
            <button type="button" onClick={() => setIsFormatOpen(false)} className="ios-tap h-9 w-9 rounded-full bg-[#48484a] text-lg" aria-label="서식 도구 닫기">×</button>
          </div>
          <div className="grid grid-cols-5 rounded-xl bg-[#3a3a3c] p-1" aria-label="문단 스타일">
            {[["제목", "h1"], ["머리말", "h2"], ["부머리말", "h3"], ["본문", "p"], ["모노", "pre"]].map(([label, value]) => <button key={value} type="button" onPointerDown={keepSelection} onClick={() => applyFormat("formatBlock", value)} className={formatButton}>{label}</button>)}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-[#3a3a3c] p-1" aria-label="글자 서식">
            {[["B", "bold", "굵게"], ["I", "italic", "기울임"], ["U", "underline", "밑줄"], ["S", "strikeThrough", "취소선"]].map(([label, command, ariaLabel]) => <button key={command} type="button" onPointerDown={keepSelection} onClick={() => applyFormat(command)} className={formatButton} aria-label={ariaLabel}>{label}</button>)}
            <button type="button" onPointerDown={keepSelection} onClick={() => setIsPaletteOpen((current) => !current)} className={formatButton} aria-expanded={isPaletteOpen} aria-label="글자 색상">✎</button>
          </div>
          {isPaletteOpen && <div className="mt-2 flex justify-center gap-4 rounded-xl bg-[#3a3a3c] p-3">{["#ffffff", "#e5a93c", "#ff453a", "#0a84ff", "#30d158"].map((color) => <button key={color} type="button" onPointerDown={keepSelection} onClick={() => applyFormat("foreColor", color)} className="format-color-button h-7 w-7 rounded-full border-2 border-white/50" data-color={color} aria-label={`${color} 글자 색상`} />)}</div>}
          <div className="mt-2 grid grid-cols-6 rounded-xl bg-[#3a3a3c] p-1" aria-label="목록과 들여쓰기">
            <button type="button" onPointerDown={keepSelection} onClick={() => applyFormat("insertUnorderedList")} className={formatButton} aria-label="순서 없는 목록">• ≡</button>
            <button type="button" onPointerDown={keepSelection} onClick={() => insertAtCaret('<ul class="dashed-list"><li><br></li></ul>')} className={formatButton} aria-label="대시 목록">– ≡</button>
            <button type="button" onPointerDown={keepSelection} onClick={() => applyFormat("insertOrderedList")} className={formatButton} aria-label="숫자 목록">1. ≡</button>
            <button type="button" onPointerDown={keepSelection} onClick={() => applyFormat("outdent")} className={formatButton} aria-label="내어쓰기">⇤</button>
            <button type="button" onPointerDown={keepSelection} onClick={() => applyFormat("indent")} className={formatButton} aria-label="들여쓰기">⇥</button>
            <button type="button" onPointerDown={keepSelection} onClick={insertTable} className={formatButton} aria-label="표">▦</button>
          </div>
        </div>
      </section>
    </div>
  );
}
