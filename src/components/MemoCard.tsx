"use client";

import { type KeyboardEvent, type TouchEvent, useRef, useState } from "react";
import type { Memo } from "@/types/memo";

interface MemoCardProps { memo: Memo; onEdit: (memo: Memo) => void; onDelete: (memo: Memo) => void; onTogglePin: (id: string) => void }
type SwipeAxis = "horizontal" | "vertical" | null;
const ACTION_WIDTH = 148;

export function MemoCard({ memo, onEdit, onDelete, onTogglePin }: MemoCardProps): React.JSX.Element {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const startOffset = useRef(0);
  const swipeAxis = useRef<SwipeAxis>(null);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
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
    if (!swipeAxis.current && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) swipeAxis.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    if (swipeAxis.current !== "horizontal") return;
    event.preventDefault();
    suppressClick.current = true;
    setOffset(Math.max(-ACTION_WIDTH, Math.min(74, startOffset.current + deltaX)));
  };
  const handleTouchEnd = (): void => {
    setIsDragging(false);
    if (swipeAxis.current === "horizontal") {
      setOffset(offset >= 38 ? 74 : offset <= -50 ? -ACTION_WIDTH : 0);
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
    swipeAxis.current = null;
  };
  const openMemo = (): void => {
    if (suppressClick.current) return;
    if (offset !== 0) { setOffset(0); return; }
    onEdit(memo);
  };
  const preview = memo.content.trim().split("\n")[0] || "추가 텍스트 없음";
  const date = new Date(memo.updatedAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });

  return (
    <div className="relative overflow-hidden bg-[#ff3b30] last:[&_.memo-row]:border-b-0">
      <button type="button" onClick={() => { onTogglePin(memo.id); setOffset(0); }} className="absolute inset-y-0 left-0 flex w-[74px] flex-col items-center justify-center bg-[#e5a93c] text-white" aria-label={memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`}>
        <span className="text-xl" aria-hidden="true">●</span>
        <span className="text-[11px] font-semibold">{memo.isPinned ? "해제" : "고정"}</span>
      </button>
      <div className="absolute inset-y-0 right-0 flex w-[148px]">
        <button type="button" onClick={() => setOffset(0)} className="w-[74px] bg-[#8e8e93] text-xl text-white" aria-label="더 보기">•••</button>
        <button type="button" onClick={() => onDelete(memo)} className="flex w-[74px] flex-col items-center justify-center bg-[#ff3b30] text-white" aria-label={`${memo.title} 삭제`}>
          <span className="text-xl" aria-hidden="true">♜</span>
          <span className="text-[11px] font-semibold">삭제</span>
        </button>
      </div>
      <article role="button" tabIndex={0} aria-label={`${memo.title} 메모 열기`} onClick={openMemo} onKeyDown={(event: KeyboardEvent<HTMLElement>) => { if (event.key === "Enter" || event.key === " ") openMemo(); }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd} className={`memo-row relative touch-pan-y border-b border-[#d1d1d6] bg-white py-3.5 pl-4 pr-5 ${isDragging ? "" : "transition-transform duration-200 ease-out"}`} style={{ transform: `translateX(${offset}px)` }}>
        <div className="flex items-center gap-2">
          {memo.isPinned && <span className="text-[10px] text-[#b77912]" aria-label="고정됨">●</span>}
          <h3 className="truncate text-[17px] font-semibold leading-5">{memo.title}</h3>
        </div>
        <p className="mt-1 flex min-w-0 gap-2 text-[15px] leading-5">
          <time className="shrink-0 text-[#3a3a3c]">{date}</time>
          <span className="truncate text-[#8e8e93]">{preview}</span>
        </p>
        {memo.tags.length > 0 && <p className="mt-0.5 truncate text-[13px] text-[#8e8e93]">{memo.tags.map((tag) => `#${tag}`).join("  ")}</p>}
      </article>
    </div>
  );
}
