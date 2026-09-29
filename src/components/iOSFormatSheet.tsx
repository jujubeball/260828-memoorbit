import { useEffect, useState, type PointerEvent } from "react";
import { EditorLayer } from "@/src/components/EditorLayer";
import { LayerSwipeHandle } from "@/src/components/LayerSwipeHandle";
import { InlineFormatTools } from "@/src/components/InlineFormatTools";
import { EditorIcon } from "@/src/components/EditorIcon";
import { LayerCloseButton } from "@/src/components/LayerCloseButton";
import type { EditorFormatState } from "@/src/lib/editorSelection";

interface IOSFormatSheetProps {
  activeFormat: EditorFormatState;
  disabled: boolean;
  onClose: () => void;
  onLink: (anchor: HTMLButtonElement) => void;
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
  const buttonClass = (active: boolean): string =>
    `flex h-11 min-w-11 shrink-0 transition-transform duration-150 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-[#e5a93c] items-center justify-center rounded-lg px-1 text-xs font-semibold disabled:opacity-40 ${active ? "bg-amber-500 text-black" : "text-[#f3f4f6] hover:bg-white/10"}`;

  // 손잡이를 아래로 당긴 거리만 시트에 반영하고, 취소하면 원래 자리로 돌려놓습니다.
  const [dragOffset, setDragOffset] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  // 💡 [시트 닫기 전환]
  // X·배경 터치·아래 드래그는 같은 퇴장 동작을 거친 뒤 부모가 선택 복원과 시트 제거를 마무리합니다.
  useEffect(() => {
    if (!isClosing) return;
    const timer = window.setTimeout(onClose, 160);
    return () => window.clearTimeout(timer);
  }, [isClosing, onClose]);

  return (
    <EditorLayer onClose={() => setIsClosing(true)} className="z-[130]">
      <section
        id="memo-format-sheet"
        style={{ transform: `translateY(${dragOffset}px)` }}
        aria-label="서식 도구"
        className={`fixed bottom-0 left-0 right-0 z-40 w-full bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-[env(safe-area-inset-bottom)] max-h-[85%] overflow-y-auto touch-pan-y rounded-t-3xl px-3 pt-3 shadow-xl transition-transform motion-reduce:animate-none ${isClosing ? "pointer-events-none animate-[format-sheet-out_160ms_ease-in_forwards]" : "animate-[format-sheet-in_180ms_ease-out]"}`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <LayerSwipeHandle
          onClose={() => setIsClosing(true)}
          onDrag={setDragOffset}
          keyboardClose={false}
          label="포맷 시트 내리기"
          barClassName="w-10 h-1 bg-slate-700 rounded-full mx-auto my-2"
        />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">포맷</h3>
          <LayerCloseButton
            aria-label="포맷 닫기"
            onPointerDown={onKeepSelection}
            onClick={() => setIsClosing(true)}
          />
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
    </EditorLayer>
  );
}
