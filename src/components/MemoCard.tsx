"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type TouchEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Memo } from "@/types/memo";

interface MemoCardProps {
  memo: Memo;
  viewMode?: "list" | "gallery";
  onEdit: (memo: Memo) => void;
  onDelete: (memo: Memo) => void;
  onTogglePin: (id: string) => void;
}

interface MenuPosition {
  left: number;
  top: number;
}

type SwipeAxis = "horizontal" | "vertical" | null;
const ACTION_WIDTH = 148;

const formatMemoDate = (iso: string): string => {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

export function MemoCard({
  memo,
  viewMode = "list",
  onEdit,
  onDelete,
  onTogglePin,
}: MemoCardProps): React.JSX.Element {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const startOffset = useRef(0);
  const swipeAxis = useRef<SwipeAxis>(null);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    if (!menuPosition) return;
    const closeMenu = (): void => setMenuPosition(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [menuPosition]);

  const handleTouchStart = (event: TouchEvent<HTMLElement>): void => {
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
    startOffset.current = offset;
    swipeAxis.current = null;
    suppressClick.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (event: TouchEvent<HTMLElement>): void => {
    const deltaX = event.touches[0].clientX - touchStartX.current;
    const deltaY = event.touches[0].clientY - touchStartY.current;
    if (!swipeAxis.current && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
      swipeAxis.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }
    if (swipeAxis.current !== "horizontal") return;
    event.preventDefault();
    suppressClick.current = true;
    setOffset(Math.max(-ACTION_WIDTH, Math.min(74, startOffset.current + deltaX)));
  };

  const handleTouchEnd = (): void => {
    setIsDragging(false);
    if (swipeAxis.current === "horizontal") {
      setOffset(offset >= 38 ? 74 : offset <= -50 ? -ACTION_WIDTH : 0);
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    swipeAxis.current = null;
  };

  const openMemo = (): void => {
    if (suppressClick.current) return;
    if (offset !== 0) {
      setOffset(0);
      return;
    }
    onEdit(memo);
  };

  const openContextMenu = (event: MouseEvent<HTMLElement>): void => {
    event.preventDefault();
    setMenuPosition({
      left: Math.min(event.clientX, window.innerWidth - 190),
      top: Math.min(event.clientY, window.innerHeight - 120),
    });
  };

  const togglePin = (): void => {
    onTogglePin(memo.id);
    setOffset(0);
    setMenuPosition(null);
  };

  const preview = memo.content.trim().split("\n")[0] || "추가 텍스트 없음";

  return (
    <div className={`group relative overflow-hidden bg-[#ff3b30] last:[&_.memo-row]:border-b-0 ${viewMode === "gallery" ? "rounded-2xl shadow-sm" : ""}`}>
      <button
        type="button"
        onClick={togglePin}
        className="absolute inset-y-0 left-0 flex w-[74px] flex-col items-center justify-center bg-[#e5a93c] text-white xl:hidden"
        aria-label={memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`}
      >
        <span className="text-xl" aria-hidden="true">●</span>
        <span className="text-[11px] font-semibold">{memo.isPinned ? "해제" : "고정"}</span>
      </button>
      <div className="absolute inset-y-0 right-0 flex w-[148px] xl:hidden">
        <button
          type="button"
          onClick={() => setOffset(0)}
          className="w-[74px] bg-[#8e8e93] text-xl text-white"
          aria-label="더 보기"
        >
          •••
        </button>
        <button
          type="button"
          onClick={() => onDelete(memo)}
          className="flex w-[74px] flex-col items-center justify-center bg-[#ff3b30] text-white"
          aria-label={`${memo.title} 삭제`}
        >
          <span className="text-xl" aria-hidden="true">♜</span>
          <span className="text-[11px] font-semibold">삭제</span>
        </button>
      </div>
      <article
        role="button"
        tabIndex={0}
        aria-label={`${memo.title} 메모 열기`}
        onClick={openMemo}
        onContextMenu={openContextMenu}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          if (event.key === "Enter" || event.key === " ") openMemo();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`memo-row relative touch-pan-y bg-white ${viewMode === "gallery" ? "h-full border-0 pb-5 pl-4 pr-14 pt-0" : "border-b border-[#d1d1d6] py-3.5 pl-4 pr-14"} ${isDragging ? "" : "transition-transform duration-200 ease-out"}`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {viewMode === "gallery" && (
          <div className="-ml-4 -mr-14 mb-4 aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#e5a93c] via-[#8e8e93] to-[#1c1c1e]">
            {(memo.imageUrl || memo.aiImageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={memo.imageUrl ?? memo.aiImageUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            togglePin();
          }}
          className={`absolute right-3 top-3 hidden h-9 w-9 items-center justify-center rounded-full text-lg transition xl:flex ${memo.isPinned ? "text-[#b77912] opacity-100" : "text-[#8e8e93] opacity-0 hover:bg-[#f2f2f7] group-hover:opacity-100 focus:opacity-100"}`}
          aria-label={memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`}
          aria-pressed={memo.isPinned}
        >
          <span aria-hidden="true">{memo.isPinned ? "●" : "○"}</span>
        </button>
        <div className="flex items-center gap-2">
          {memo.isPinned && (
            <span className="text-[10px] text-[#b77912] xl:hidden" aria-label="고정됨">●</span>
          )}
          <h3 className="truncate text-[17px] font-semibold leading-5">{memo.title}</h3>
        </div>
        <p className="mt-1 flex min-w-0 gap-2 text-[15px] leading-5">
          <time className="shrink-0 text-[#3a3a3c]">{formatMemoDate(memo.updatedAt)}</time>
          <span className="truncate text-[#8e8e93]">{preview}</span>
        </p>
        {memo.tags.length > 0 && (
          <p className="mt-0.5 truncate text-[13px] text-[#8e8e93]">
            {memo.tags.map((tag) => `#${tag}`).join("  ")}
          </p>
        )}
      </article>

      {menuPosition && (
        <div
          className="fixed z-[180] hidden w-44 overflow-hidden rounded-xl border border-black/10 bg-white/95 py-1 shadow-xl backdrop-blur-xl xl:block"
          style={{ left: menuPosition.left, top: menuPosition.top }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={togglePin}
            className="flex h-11 w-full items-center justify-between px-4 text-left text-sm hover:bg-[#f2f2f7]"
            role="menuitem"
          >
            <span>{memo.isPinned ? "고정 해제" : "메모 고정"}</span>
            <span className="text-[#b77912]" aria-hidden="true">●</span>
          </button>
        </div>
      )}
    </div>
  );
}
