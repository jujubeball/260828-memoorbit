import { useEffect, useState, type PointerEvent } from "react";
import { EditorLayer } from "@/src/components/EditorLayer";
import { LayerSwipeHandle } from "@/src/components/LayerSwipeHandle";
import { EditorIcon } from "@/src/components/EditorIcon";
import type { EditorFormatState } from "@/src/lib/editorSelection";

interface InlineFormatToolsProps {
  activeFormat: EditorFormatState;
  disabled: boolean;
  onKeepSelection: (event: PointerEvent<HTMLButtonElement>) => void;
  onFormat: (command: string, value?: string) => void;
  onLink: (anchor: HTMLButtonElement) => void;
  onRestoreSelection: () => void;
}

export function InlineFormatTools({ activeFormat: activeStyles, disabled, onKeepSelection, onFormat, onLink, onRestoreSelection }: InlineFormatToolsProps): React.JSX.Element {
  // 색상 입력창 대신 프리셋 버튼을 펼쳐 본문 포커스와 선택을 계속 유지합니다.
  const [colorsOpen, setColorsOpen] = useState(false);
  const closeColors = (): void => {
    setColorsOpen(false);
    onRestoreSelection();
  };
  useEffect(() => {
    if (!colorsOpen) return;
    const closeWithEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeColors();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  });
  // 버튼 배경은 공유된 선택 상태가 활성일 때만 노란색이며, 팝오버를 여는 것만으로 활성화하지 않습니다.
  const buttonClass = (active: boolean): string => `flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-lg ${active ? "bg-amber-500 text-black" : "text-slate-300 hover:bg-white/10"} disabled:opacity-40`;
  return (
    <>
      {/* 같은 명령을 퀵 서식 바와 포맷 시트에서 공유해 선택·토글 방식이 달라지지 않게 합니다. */}
      {([
        ["B", "bold", "굵게", "font-bold"],
        ["I", "italic", "기울임", "italic"],
        ["U", "underline", "밑줄", "underline"],
        ["S", "strikeThrough", "취소선", "line-through"],
      ] as const).map(([label, command, name, typography]) => (
        <button key={command} type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={() => onFormat(command)} aria-label={name} aria-pressed={activeStyles[command]} className={`${buttonClass(activeStyles[command])} ${typography}`}>
          {label}
        </button>
      ))}
      <button type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={() => onFormat("highlight")} aria-label="형광펜" aria-pressed={activeStyles.highlight} className={buttonClass(activeStyles.highlight)}>
        <EditorIcon name="pen" className="h-5 w-5" />
      </button>
      <button type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={() => setColorsOpen(true)} aria-label="색상 선택" aria-expanded={colorsOpen} aria-pressed={Boolean(activeStyles.color)} className={buttonClass(Boolean(activeStyles.color))}>
        <EditorIcon name="palette" className="h-5 w-5" />
      </button>
      <button type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={(event) => onLink(event.currentTarget)} aria-label="링크" aria-pressed={Boolean(activeStyles.link)} className={buttonClass(Boolean(activeStyles.link))}>
        <EditorIcon name="link" className="h-5 w-5" />
      </button>
      {colorsOpen && (
        <EditorLayer onClose={closeColors}>
          <section className="mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 px-3 pt-3 pb-[env(safe-area-inset-bottom)] shadow-2xl" role="dialog" aria-modal="true" aria-label="글자색 선택">
            <LayerSwipeHandle onClose={closeColors} label="색상 선택 내리기" />
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">글자색</h3>
              <button type="button" onPointerDown={onKeepSelection} onClick={closeColors} aria-label="색상 선택 닫기" className={buttonClass(false)}>
                <EditorIcon name="close" className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
              {([
                ["#ffffff", "흰색", "bg-white"], ["#e5a93c", "노란색", "bg-amber-500"],
                ["#ff453a", "빨간색", "bg-red-500"], ["#0a84ff", "파란색", "bg-blue-500"], ["#30d158", "초록색", "bg-green-500"],
              ] as const).map(([color, label, className]) => (
                <button key={color} type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={() => { onFormat("foreColor", color); setColorsOpen(false); }} aria-label={`${label} 글자`} aria-pressed={activeStyles.color === color} className={`${buttonClass(activeStyles.color === color)} border border-white/20`}>
                  <span className={`h-5 w-5 rounded-full ${className}`} />
                </button>
              ))}
            </div>
          </section>
        </EditorLayer>
      )}
    </>
  );
}
