import { useRef, type ReactNode } from "react";

interface EditorToolbarPagerProps {
  children: ReactNode;
  onPreserveSelection: () => void;
}

interface ToolbarDrag {
  x: number;
  scrollLeft: number;
  moved: boolean;
}

export function EditorToolbarPager({ children, onPreserveSelection }: EditorToolbarPagerProps): React.JSX.Element {
  const drag = useRef<ToolbarDrag | null>(null);
  const suppressClick = useRef(false);
  return (
    <div
      className="overflow-x-auto whitespace-nowrap scrollbar-hide flex w-full touch-none snap-x snap-mandatory overscroll-x-contain"
      role="toolbar"
      aria-label="메모 작성 도구"
      onPointerDown={(event) => {
        // 💡 [선택을 보존하는 가로 넘김]
        // 버튼과 빈 공간 어디서 시작하든 본문의 책갈피를 저장하고 기본 포커스 이동을 막습니다.
        onPreserveSelection();
        event.preventDefault();
        suppressClick.current = false;
        drag.current = { x: event.clientX, scrollLeft: event.currentTarget.scrollLeft, moved: false };
      }}
      onPointerMove={(event) => {
        const origin = drag.current;
        if (!origin) return;
        event.preventDefault();
        const delta = event.clientX - origin.x;
        if (Math.abs(delta) < 10 && !origin.moved) return;
        origin.moved = true;
        event.currentTarget.style.scrollSnapType = "none";
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.scrollLeft = origin.scrollLeft - delta;
      }}
      onPointerUp={(event) => {
        const origin = drag.current;
        drag.current = null;
        if (!origin?.moved) return;
        event.preventDefault();
        suppressClick.current = true;
        event.currentTarget.style.removeProperty("scroll-snap-type");
        const width = event.currentTarget.clientWidth;
        if (!width) return;
        const direction = event.clientX < origin.x ? 1 : -1;
        const page = Math.max(0, Math.min(1, Math.round(origin.scrollLeft / width) + direction));
        event.currentTarget.scrollTo({ left: page * width, behavior: "smooth" });
      }}
      onPointerCancel={(event) => {
        drag.current = null;
        suppressClick.current = true;
        event.currentTarget.style.removeProperty("scroll-snap-type");
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }}
    >
      {children}
    </div>
  );
}
