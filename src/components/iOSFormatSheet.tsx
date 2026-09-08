import type { PointerEvent } from "react";
import type { EditorFormatState } from "@/src/lib/editorSelection";

interface IOSFormatSheetProps {
  activeFormat: EditorFormatState;
  disabled: boolean;
  onKeepSelection: (event: PointerEvent<HTMLButtonElement>) => void;
  onFormat: (command: string, value?: string) => void;
}

// 세 행의 버튼은 선택 상태와 명령만 전달받고, 실제 본문과 선택 범위는 작성 모달이 관리합니다.
export function IOSFormatSheet({ activeFormat, disabled, onKeepSelection, onFormat }: IOSFormatSheetProps): React.JSX.Element {
  const buttonClass = (active: boolean): string =>
    `ios-tap flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1 text-xs font-semibold disabled:opacity-40 ${active ? "bg-[#e5a93c] text-[#121318]" : "text-[#f3f4f6] hover:bg-white/10"}`;

  return (
    <section
      id="memo-format-sheet"
      aria-label="서식 도구"
      className="mx-3 mb-2 shrink-0 rounded-2xl border border-[#2a2e3d] bg-[#1e2029] p-3 shadow-2xl animate-[format-sheet-in_180ms_ease-out] motion-reduce:animate-none"
    >
      <div className="grid grid-cols-[1fr_1.35fr_1.7fr_1fr_2.35fr] gap-0.5 rounded-xl bg-[#121318]/60 p-1" role="group" aria-label="문단 스타일">
        {/* 버튼 목록을 화면에 펼칠 때 현재 선택의 크기와 같은 버튼만 황금색으로 표시합니다. */}
        {[["제목", "h1"], ["머리말", "h2"], ["부머리말", "h3"], ["본문", "p"], ["모노스페이스", "pre"]].map(([label, value]) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onPointerDown={onKeepSelection}
            onClick={() => onFormat("formatBlock", value)}
            aria-pressed={activeFormat.block === value}
            className={`${buttonClass(activeFormat.block === value)} whitespace-nowrap`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-[#121318]/60 p-1" role="group" aria-label="글자 서식">
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
            className={`${buttonClass(activeFormat[command])} text-lg ${typography}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[1.7fr_1.7fr_1fr_1fr] gap-1 rounded-xl bg-[#121318]/60 p-1" role="group" aria-label="목록과 들여쓰기">
        {/* 목록과 들여쓰기는 글자 서식과 달리 선택이 포함된 문단에 명령을 전달합니다. */}
        {[["• 불릿 목록", "insertUnorderedList", "순서 없는 목록"], ["1. 숫자 목록", "insertOrderedList", "숫자 목록"], ["⇤", "outdent", "내어쓰기"], ["⇥", "indent", "들여쓰기"]].map(([label, command, ariaLabel]) => (
          <button
            key={command}
            type="button"
            disabled={disabled}
            onPointerDown={onKeepSelection}
            onClick={() => onFormat(command)}
            aria-label={ariaLabel}
            title={ariaLabel}
            className={buttonClass(false)}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
