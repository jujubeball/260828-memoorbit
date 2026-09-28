import { type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useVisualViewport } from "@/src/hooks/useVisualViewport";

interface EditorLayerProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}

// 💡 [툴바와 레이어의 좌표 분리]
// 흐림 효과가 있는 툴바 안의 fixed 요소는 툴바 크기에 갇힐 수 있으므로 문서 바깥 레이어로 옮깁니다.
// 키보드가 줄인 가시 높이를 적용해 시트 바닥이 실제 입력 가능 화면의 바닥과 맞닿게 합니다.
export function EditorLayer({ children, onClose, className = "z-[140]" }: EditorLayerProps): React.JSX.Element {
  const viewport = useVisualViewport();
  return createPortal(
    <div
      className={`fixed left-0 right-0 top-0 flex h-[var(--layer-height)] items-end bg-black/40 ${className}`}
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
      {children}
    </div>,
    document.body,
  );
}
