import { useState, type PointerEvent } from "react";
import { EditorIcon } from "@/src/components/EditorIcon";
import type { EditorFormatState } from "@/src/lib/editorSelection";

interface InlineFormatToolsProps {
  activeFormat: EditorFormatState;
  disabled: boolean;
  quick?: boolean;
  onKeepSelection: (event: PointerEvent<HTMLButtonElement>) => void;
  onFormat: (command: string, value?: string) => void;
  onLink: () => void;
}

export function InlineFormatTools({ activeFormat, disabled, quick = false, onKeepSelection, onFormat, onLink }: InlineFormatToolsProps): React.JSX.Element {
  // 색상 입력창 대신 프리셋 버튼을 펼쳐 본문 포커스와 선택을 계속 유지합니다.
  const [colorsOpen, setColorsOpen] = useState(false);
  const buttonClass = (active: boolean): string => `flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-lg ${active ? "bg-amber-500 text-black" : "text-amber-400 hover:bg-white/10"} disabled:opacity-40`;
  return (
    <>
      {/* 같은 명령을 퀵 서식 바와 포맷 시트에서 공유해 선택·토글 방식이 달라지지 않게 합니다. */}
      {([
        ["B", "bold", "굵게", "font-bold"],
        ["I", "italic", "기울임", "italic"],
        ["U", "underline", "밑줄", "underline"],
        ["S", "strikeThrough", "취소선", "line-through"],
      ] as const).map(([label, command, name, typography]) => (
        <button key={command} type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={() => onFormat(command)} aria-label={name} aria-pressed={activeFormat[command]} className={`${buttonClass(activeFormat[command])} flex-1 ${typography}`}>
          {label}
        </button>
      ))}
      <button type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={() => onFormat("highlight")} aria-label="형광펜" aria-pressed={activeFormat.highlight} className={buttonClass(activeFormat.highlight)}>
        <EditorIcon name="pen" className="h-5 w-5" />
      </button>
      {quick ? (
        <>
          <button type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={onLink} aria-label="링크" aria-pressed={Boolean(activeFormat.link)} className={buttonClass(Boolean(activeFormat.link))}>
            <EditorIcon name="link" className="h-5 w-5" />
          </button>
          {(["outdent", "indent"] as const).map((command) => (
            <button key={command} type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={() => onFormat(command)} aria-label={command === "indent" ? "들여쓰기" : "내어쓰기"} className={buttonClass(false)}>
              <EditorIcon name={command} className="h-5 w-5" />
            </button>
          ))}
        </>
      ) : (
        <>
          <button type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={() => setColorsOpen((open) => !open)} aria-label="색상 선택" aria-expanded={colorsOpen} className={buttonClass(Boolean(activeFormat.color))}>
            <EditorIcon name="palette" className="h-5 w-5" />
          </button>
          {colorsOpen && ([
            ["#ffffff", "흰색", "bg-white"], ["#e5a93c", "노란색", "bg-amber-500"],
            ["#ff453a", "빨간색", "bg-red-500"], ["#0a84ff", "파란색", "bg-blue-500"], ["#30d158", "초록색", "bg-green-500"],
          ] as const).map(([color, label, className]) => (
            <button key={color} type="button" disabled={disabled} onPointerDown={onKeepSelection} onClick={() => onFormat("foreColor", color)} aria-label={`${label} 글자`} aria-pressed={activeFormat.color === color} className={`${buttonClass(activeFormat.color === color)} border border-white/20`}>
              <span className={`h-5 w-5 rounded-full ${className}`} />
            </button>
          ))}
        </>
      )}
    </>
  );
}
