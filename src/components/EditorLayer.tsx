import { type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useVisualViewport } from "@/src/hooks/useVisualViewport";

export interface EditorLayerAnchor {
  top: number;
  right: number;
  width?: number;
  height?: number;
}

interface EditorLayerProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  anchor?: EditorLayerAnchor;
}

// 💡 [툴바와 레이어의 좌표 분리]
// 흐림 효과가 있는 툴바 안의 fixed 요소는 툴바 크기에 갇힐 수 있으므로 문서 바깥 레이어로 옮깁니다.
// 키보드가 줄인 가시 높이를 적용해 시트 바닥이 실제 입력 가능 화면의 바닥과 맞닿게 합니다.
export function EditorLayer({ children, onClose, className = "z-[140]", anchor }: EditorLayerProps): React.JSX.Element {
  const viewport = useVisualViewport();
  return createPortal(
    <div
      className={`fixed left-0 right-0 top-0 flex h-[var(--layer-height)] items-end bg-black/40 [transform:translateZ(0)] ${className}`}
      style={{ "--layer-height": viewport.height === null ? "100dvh" : `${viewport.height}px` } as CSSProperties}
      role="presentation"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onClose();
      }}
    >
      {anchor ? (
        <div
          data-layer-anchor="true"
          className="absolute w-[var(--popover-width)] max-w-full overflow-y-auto max-h-[calc(var(--layer-height)-var(--popover-bottom)-0.5rem)] bottom-[var(--popover-bottom)]"
          style={{
            // 💡 [터치한 도구 버튼 위에 배치]
            // 키보드가 화면을 줄이면 위쪽과 좌우 경계를 보정하고, 긴 안내는 팝오버 안에서만 스크롤합니다.
            "--popover-bottom": `clamp(0px, calc(var(--layer-height) - min(${anchor.top}px, calc(var(--layer-height) - 4rem)) + 0.5rem), max(0px, calc(var(--layer-height) - ${anchor.height ?? 320}px)))`,
            "--popover-width": `${anchor.width ?? 512}px`,
            left: `clamp(0px, calc(${anchor.right}px - var(--popover-width)), max(0px, calc(100% - var(--popover-width))))`,
          } as CSSProperties}
        >
          {children}
        </div>
      ) : children}
    </div>,
    document.body,
  );
}
