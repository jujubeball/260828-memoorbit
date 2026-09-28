import { useRef, type ReactNode } from "react";

interface EditorToolbarProps {
  children: ReactNode;
  onPreserveSelection: () => void;
}

// 💡 [브라우저 기본 가로 스크롤]
// 손가락 이동과 관성은 브라우저가 처리합니다. 선택 범위 보관과 스크롤 직후 오클릭 차단만 담당합니다.
export function EditorToolbar({ children, onPreserveSelection }: EditorToolbarProps): React.JSX.Element {
  const suppressClick = useRef(false);
  return (
    <div
      className="flex items-center gap-6 overflow-x-auto whitespace-nowrap scrollbar-none px-4 py-2.5 bg-slate-900/95 border-t border-slate-800 pb-[env(safe-area-inset-bottom)] w-full touch-pan-x overscroll-x-contain"
      role="toolbar"
      aria-label="메모 작성 도구"
      onPointerDown={(event) => {
        onPreserveSelection();
        suppressClick.current = false;
        // 마우스의 포커스 이동만 차단하고 터치의 기본 스크롤은 취소하지 않습니다.
        if (event.pointerType === "mouse") event.preventDefault();
      }}
      onScroll={() => { suppressClick.current = true; }}
      onPointerCancel={() => { suppressClick.current = true; }}
      onClickCapture={(event) => {
        if (!suppressClick.current || event.detail === 0) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }}
    >
      {children}
    </div>
  );
}
