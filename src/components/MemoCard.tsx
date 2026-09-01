"use client";

import { type KeyboardEvent, type TouchEvent, useRef, useState } from "react";
import type { Memo } from "@/types/memo";

interface MemoCardProps {
  memo: Memo;
  onEdit: (memo: Memo) => void;
  onDelete: (memo: Memo) => void;
  onTogglePin: (id: string) => void;
}

type SwipeAxis = "horizontal" | "vertical" | null;

const ACTION_WIDTH = 152;
const PIN_WIDTH = 96;
const PIN_THRESHOLD = 132;

export function MemoCard({
  memo,
  onEdit,
  onDelete,
  onTogglePin,
}: MemoCardProps): React.JSX.Element {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const startOffset = useRef(0);
  const swipeAxis = useRef<SwipeAxis>(null);
  const suppressClick = useRef(false);
  const didGiveFeedback = useRef(false);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showShareNotice, setShowShareNotice] = useState(false);

  const handleTouchStart = (event: TouchEvent<HTMLElement>): void => {
    const touch = event.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    startOffset.current = offset;
    swipeAxis.current = null;
    suppressClick.current = false;
    didGiveFeedback.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (event: TouchEvent<HTMLElement>): void => {
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    if (!swipeAxis.current && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
      swipeAxis.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }
    if (swipeAxis.current !== "horizontal") return;

    event.preventDefault();
    suppressClick.current = true;
    const nextOffset = Math.max(
      -ACTION_WIDTH,
      Math.min(PIN_THRESHOLD + 24, startOffset.current + deltaX),
    );
    setOffset(nextOffset);
    if (nextOffset >= PIN_THRESHOLD && !didGiveFeedback.current) {
      didGiveFeedback.current = true;
      window.navigator.vibrate?.(20);
    }
  };

  const handleTouchEnd = (): void => {
    setIsDragging(false);
    if (swipeAxis.current === "horizontal") {
      if (offset >= PIN_THRESHOLD) {
        onTogglePin(memo.id);
        setOffset(PIN_THRESHOLD + 12);
        window.setTimeout(() => setOffset(0), 180);
      } else if (offset >= 40) {
        setOffset(PIN_WIDTH);
      } else if (offset <= -56) {
        setOffset(-ACTION_WIDTH);
      } else {
        setOffset(0);
      }
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    swipeAxis.current = null;
  };

  const handleCardClick = (): void => {
    if (suppressClick.current) return;
    if (offset !== 0) {
      setOffset(0);
      return;
    }
    onEdit(memo);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onEdit(memo);
    }
  };

  const handleShare = (): void => {
    setShowShareNotice(true);
    window.setTimeout(() => setShowShareNotice(false), 1800);
  };

  return (
    <div className="relative overflow-hidden bg-stone-200 xl:rounded-2xl">
      <button
        type="button"
        onClick={() => {
          onTogglePin(memo.id);
          setOffset(0);
        }}
        onTouchStart={(event) => event.stopPropagation()}
        className={`absolute inset-y-0 left-0 flex w-24 items-center justify-center text-white transition-colors xl:hidden ${
          offset >= PIN_THRESHOLD ? "bg-amber-700" : "bg-stone-800"
        }`}
        aria-label={memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`}
      >
        <span aria-hidden="true">●</span>
        <span className="ml-1 text-xs font-semibold">
          {memo.isPinned ? "고정 해제" : "고정"}
        </span>
      </button>

      <div className="absolute inset-y-0 right-0 flex w-[152px] xl:hidden">
        <button
          type="button"
          onClick={handleShare}
          onTouchStart={(event) => event.stopPropagation()}
          aria-label={`${memo.title} 공유`}
          className="flex flex-1 items-center justify-center bg-amber-700 text-xs font-bold text-white"
        >
          공유
        </button>
        <button
          type="button"
          onClick={() => onDelete(memo)}
          onTouchStart={(event) => event.stopPropagation()}
          aria-label={`${memo.title} 삭제`}
          className="flex flex-1 items-center justify-center bg-red-800 text-xs font-bold text-white"
        >
          삭제
        </button>
      </div>

      <article
        role="button"
        tabIndex={0}
        aria-label={`${memo.title} 메모 열기`}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`relative touch-pan-y border-b border-stone-300 bg-[#faf9f6] px-1 py-4 xl:border xl:p-5 xl:shadow-sm ${
          isDragging ? "" : "transition-transform duration-200 ease-out"
        }`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {(memo.imageUrl || memo.aiImageUrl) && (
          <div className="mb-4 overflow-hidden rounded-xl bg-stone-200">
            {/* 저장된 사용자 이미지 또는 캐시된 AI 이미지 URL을 표시한다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={memo.imageUrl ?? memo.aiImageUrl} alt="" className="h-40 w-full object-cover" />
          </div>
        )}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-stone-950 xl:text-lg">
              {memo.title}
            </h2>
            <p className="mt-1 text-xs text-stone-600">
              {new Date(memo.updatedAt).toLocaleString("ko-KR")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin(memo.id);
              }}
              aria-label={memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`}
              aria-pressed={memo.isPinned}
              className={`pin-control rounded-lg px-2.5 py-2 text-sm font-bold ${
                memo.isPinned ? "bg-amber-800 text-white" : "text-stone-800"
              }`}
            >
              <span aria-hidden="true">{memo.isPinned ? "●" : "○"}</span>
            </button>
            <div className="hidden items-center gap-1 xl:flex">
              <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(memo); }} className="interactive-control rounded-lg px-2.5 py-2 text-sm font-semibold text-stone-800">
                수정
              </button>
              <button type="button" onClick={(event) => { event.stopPropagation(); handleShare(); }} className="interactive-control rounded-lg px-2.5 py-2 text-sm font-semibold text-amber-900">
                공유
              </button>
              <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(memo); }} className="interactive-control rounded-lg px-2.5 py-2 text-sm font-semibold text-red-800">
                삭제
              </button>
            </div>
          </div>
        </header>

        <p className={`mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-6 ${memo.content ? "text-stone-800" : "italic text-stone-600"}`}>
          {memo.content || "추가 텍스트 없음"}
        </p>

        {memo.tags.length > 0 && (
          <footer className="mt-3 flex flex-wrap gap-1.5 xl:mt-4 xl:border-t xl:border-stone-300 xl:pt-4">
            {memo.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-800">
                #{tag}
              </span>
            ))}
          </footer>
        )}
      </article>

      {showShareNotice && (
        <div role="status" className="pointer-events-none absolute inset-x-4 bottom-3 z-20 rounded-xl bg-stone-950 px-3 py-2 text-center text-sm font-semibold text-white shadow-lg">
          공유 기능을 준비하고 있습니다.
        </div>
      )}
    </div>
  );
}
