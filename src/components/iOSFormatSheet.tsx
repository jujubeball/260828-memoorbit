import { useEffect, useRef, useState, type PointerEvent } from "react";
import { InlineFormatTools } from "@/src/components/InlineFormatTools";
import { EditorIcon } from "@/src/components/EditorIcon";
import type { EditorFormatState } from "@/src/lib/editorSelection";

interface IOSFormatSheetProps {
  activeFormat: EditorFormatState;
  disabled: boolean;
  onClose: () => void;
  onLink: () => void;
  onRestoreSelection: () => void;
  onKeepSelection: (event: PointerEvent<HTMLButtonElement>) => void;
  onFormat: (command: string, value?: string) => void;
}

// 네 그룹은 선택 상태와 명령만 전달받고, 실제 본문과 선택 범위는 작성 모달이 관리합니다.
export function IOSFormatSheet({
  activeFormat,
  disabled,
  onKeepSelection,
  onFormat,
  onClose,
  onLink,
  onRestoreSelection,
}: IOSFormatSheetProps): React.JSX.Element {
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const buttonClass = (active: boolean): string =>
    `flex h-11 min-w-11 shrink-0 transition-transform duration-150 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-[#e5a93c] items-center justify-center rounded-lg px-1 text-xs font-semibold disabled:opacity-40 ${active ? "bg-amber-500 text-black" : "text-[#f3f4f6] hover:bg-white/10"}`;

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[aria-label="글자색 선택"], [aria-label="링크 주소 입력"]')) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end bg-black/35"
      role="presentation"
      onPointerDown={(event) => {
        event.preventDefault();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        id="memo-format-sheet"
        aria-label="서식 도구"
        className="max-h-[max(8rem,calc(var(--viewport-height)-10rem))] w-full shrink-0 overflow-y-auto touch-pan-y rounded-t-3xl border-t border-white/10 bg-slate-900 p-3 shadow-xl backdrop-blur-md animate-[format-sheet-in_180ms_ease-out] transition-transform motion-reduce:animate-none"
        style={{ transform: `translateY(${dragOffset}px)` }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="포맷 시트 내리기"
          className="mx-auto mb-1 flex h-6 w-20 touch-none items-center justify-center"
          onPointerDown={(event) => {
            event.preventDefault();
            dragStartY.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStartY.current === null) return;
            event.preventDefault();
            setDragOffset(Math.max(0, event.clientY - dragStartY.current));
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            const shouldClose = dragOffset > 70;
            dragStartY.current = null;
            setDragOffset(0);
            if (shouldClose) onClose();
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-500" />
        </button>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">포맷</h3>
          <button type="button" onPointerDown={onKeepSelection} onClick={onClose} aria-label="포맷 닫기" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-slate-300">
            <EditorIcon name="close" className="h-5 w-5" />
          </button>
        </div>
      <div
        className="flex items-center gap-x-4 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide px-2 py-1 overscroll-x-contain rounded-lg bg-white/5 touch-pan-x"
        role="group"
        aria-label="문단 스타일"
      >
        {/* 버튼 목록을 화면에 펼칠 때 현재 선택의 크기와 같은 버튼만 황금색으로 표시합니다. */}
        {[["제목", "h1"], ["머리말", "h2"], ["부머리말", "h3"], ["본문", "p"], ["모노스페이스", "pre"]].map(([label, value]) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onPointerDown={onKeepSelection}
            onClick={() => onFormat("formatBlock", value)}
            aria-pressed={activeFormat.block === value}
            className={`${buttonClass(activeFormat.block === value)} grow whitespace-nowrap px-2`}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="flex items-center gap-x-4 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide px-2 py-1 mt-2 overscroll-x-contain touch-pan-x"
        role="group"
        aria-label="인라인 서식"
      >
        <InlineFormatTools
          activeFormat={activeFormat}
          disabled={disabled}
          onKeepSelection={onKeepSelection}
          onFormat={onFormat}
          onLink={onLink}
          onRestoreSelection={onRestoreSelection}
        />

      </div>
      <div className="flex items-center gap-x-4 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide px-2 py-1 mt-2 border-t border-white/10 pt-2 touch-pan-x overscroll-x-contain">
        <div
          className="flex shrink-0 flex-[3] gap-1"
          role="group"
          aria-label="목록 스타일"
        >
          {/* 목록 버튼은 선택이 포함된 문단에 점·번호·대시 목록 명령을 전달합니다. */}
          {([
            ["bullet", "insertUnorderedList", "순서 없는 목록"],
            ["dash", "insertDashedList", "대시 목록"],
            ["number", "insertOrderedList", "숫자 목록"],
          ] as const).map(([icon, command, ariaLabel]) => (
            <button
              key={command}
              type="button"
              disabled={disabled}
              onPointerDown={onKeepSelection}
              onClick={() => onFormat(command)}
              aria-label={ariaLabel}
              title={ariaLabel}
              aria-pressed={activeFormat.list === command}
              className={`${buttonClass(activeFormat.list === command)} flex-1`}
            >
              <EditorIcon name={icon} className="h-5 w-5" />
            </button>
          ))}
        </div>
        <div className="flex shrink-0 flex-[3] gap-1 border-l border-white/10 pl-2" role="group" aria-label="들여쓰기 조절">
          {/* 현재 문단을 안쪽이나 바깥쪽으로 옮기되 선택한 글자는 그대로 유지합니다. */}
          {([["outdent", "내어쓰기"], ["indent", "들여쓰기"], ["inset", "인셋 컨테이너"]] as const).map(([command, label]) => (
            <button
              key={command}
              type="button"
              disabled={disabled}
              onPointerDown={onKeepSelection}
              onClick={() => onFormat(command)}
              aria-label={label}
              aria-pressed={command === "inset" ? activeFormat.inset : undefined}
              className={`${buttonClass(command === "inset" && activeFormat.inset)} flex-1`}
            >
              <EditorIcon name={command} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>
      </section>
    </div>
  );
}
