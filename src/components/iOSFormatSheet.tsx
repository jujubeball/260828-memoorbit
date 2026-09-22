import type { PointerEvent } from "react";
import { EditorIcon } from "@/src/components/EditorIcon";
import type { EditorFormatState } from "@/src/lib/editorSelection";

interface IOSFormatSheetProps {
  activeFormat: EditorFormatState;
  disabled: boolean;
  onKeepSelection: (event: PointerEvent<HTMLButtonElement>) => void;
  onFormat: (command: string, value?: string) => void;
}

// 두 행의 버튼은 선택 상태와 명령만 전달받고, 실제 본문과 선택 범위는 작성 모달이 관리합니다.
export function IOSFormatSheet({ activeFormat, disabled, onKeepSelection, onFormat }: IOSFormatSheetProps): React.JSX.Element {
  const buttonClass = (active: boolean): string =>
    `flex h-11 min-w-11 shrink-0 transition-transform duration-150 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-[#e5a93c] items-center justify-center rounded-lg px-1 text-xs font-semibold disabled:opacity-40 ${active ? "bg-[#e5a93c]/15 text-[#ffc86b]" : "text-[#f3f4f6] hover:bg-white/10"}`;

  return (
    <section
      id="memo-format-sheet"
      aria-label="서식 도구"
      className="mx-2 mb-2 shrink-0 rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-xl backdrop-blur-md animate-[format-sheet-in_180ms_ease-out] motion-reduce:animate-none"
    >
      <div
        className="scrollbar-hidden flex gap-2 overflow-x-auto overscroll-x-contain rounded-lg bg-white/5 touch-pan-x"
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
        className="scrollbar-hidden mt-2 flex gap-2 overflow-x-auto overscroll-x-contain touch-pan-x"
        role="group"
        aria-label="글자 서식과 목록"
      >
        {/* 선택 글자 전체에 적용된 서식만 눌린 상태로 표시하고 재클릭은 같은 서식 해제로 연결합니다. */}
        {([
          ["B", "bold", "굵게", "font-bold"],
          ["I", "italic", "기울임", "italic"],
          ["U", "underline", "밑줄", "underline"],
          ["S", "strikeThrough", "취소선", "line-through"],
        ] as const).map(([label, command, ariaLabel, typography]) => (
          <button
            key={command}
            type="button"
            disabled={disabled}
            onPointerDown={onKeepSelection}
            onClick={() => onFormat(command)}
            aria-label={ariaLabel}
            aria-pressed={activeFormat[command]}
            className={`${buttonClass(activeFormat[command])} flex-1 text-lg ${typography}`}
          >
            {label}
          </button>
        ))}

        {/* 목록과 들여쓰기는 글자 서식과 달리 선택이 포함된 문단에 명령을 전달합니다. */}
        {([
          ["bullet", "insertUnorderedList", "순서 없는 목록"],
          ["number", "insertOrderedList", "숫자 목록"],
          ["outdent", "outdent", "내어쓰기"],
          ["indent", "indent", "들여쓰기"],
        ] as const).map(([icon, command, ariaLabel]) => (
          <button
            key={command}
            type="button"
            disabled={disabled}
            onPointerDown={onKeepSelection}
            onClick={() => onFormat(command)}
            aria-label={ariaLabel}
            title={ariaLabel}
            className={`${buttonClass(false)} flex-1`}
          >
            <EditorIcon name={icon} className="h-5 w-5" />
          </button>
        ))}
      </div>
    </section>
  );
}
