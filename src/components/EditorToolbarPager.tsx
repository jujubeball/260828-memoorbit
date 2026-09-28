import { useRef, type ReactNode } from "react";

interface EditorToolbarPagerProps {
  children: ReactNode;
  onPreserveSelection: () => void;
}

interface ToolbarDrag {
  x: number;
  scrollLeft: number;
  moved: boolean;
  page: HTMLElement | null;
  pageScrollLeft: number;
}

export function EditorToolbarPager({ children, onPreserveSelection }: EditorToolbarPagerProps): React.JSX.Element {
  const drag = useRef<ToolbarDrag | null>(null);
  const suppressClick = useRef(false);
  return (
    <div
      className="overflow-x-auto whitespace-nowrap scrollbar-none flex w-full touch-none snap-x snap-mandatory overscroll-x-contain"
      role="toolbar"
      aria-label="메모 작성 도구"
      onPointerDown={(event) => {
        // 💡 [선택을 보존하는 가로 넘김]
        // 버튼과 빈 공간 어디서 시작하든 본문의 책갈피를 저장하고 기본 포커스 이동을 막습니다.
        onPreserveSelection();
        event.preventDefault();
        suppressClick.current = false;
        const page = event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-toolbar-page]")
          : null;
        drag.current = {
          x: event.clientX,
          scrollLeft: event.currentTarget.scrollLeft,
          moved: false,
          page,
          pageScrollLeft: page?.scrollLeft ?? 0,
        };
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
        // 페이지 안의 긴 도구 줄을 먼저 스크롤하고, 끝에 도달한 이후의 이동만 다음 페이지로 전달합니다.
        const pageLimit = origin.page ? Math.max(0, origin.page.scrollWidth - origin.page.clientWidth) : 0;
        const pageScrollLeft = Math.max(0, Math.min(pageLimit, origin.pageScrollLeft - delta));
        if (origin.page) origin.page.scrollLeft = pageScrollLeft;
        event.currentTarget.scrollLeft = origin.scrollLeft - delta - (pageScrollLeft - origin.pageScrollLeft);
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
        const overflowDistance = event.currentTarget.scrollLeft - origin.scrollLeft;
        const direction = Math.abs(overflowDistance) >= 40 ? Math.sign(overflowDistance) : 0;
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
