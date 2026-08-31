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

const LEFT_ACTION_WIDTH = 152;
const PIN_THRESHOLD = 72;

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
    setIsDragging(true);
  };

  const handleTouchMove = (event: TouchEvent<HTMLElement>): void => {
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    if (!swipeAxis.current && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
      swipeAxis.current = Math.abs(deltaX) > Math.abs(deltaY)
        ? "horizontal"
        : "vertical";
    }
    if (swipeAxis.current !== "horizontal") return;

    event.preventDefault();
    suppressClick.current = true;
    const nextOffset = Math.max(
      -LEFT_ACTION_WIDTH,
      Math.min(PIN_THRESHOLD + 24, startOffset.current + deltaX),
    );
    setOffset(nextOffset);
  };

  const handleTouchEnd = (): void => {
    setIsDragging(false);

    if (swipeAxis.current === "horizontal") {
      if (offset >= PIN_THRESHOLD) {
        onTogglePin(memo.id);
        setOffset(PIN_THRESHOLD + 12);
        window.setTimeout(() => setOffset(0), 180);
      } else if (offset <= -56) {
        setOffset(-LEFT_ACTION_WIDTH);
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
    <div className="relative overflow-hidden rounded-2xl bg-stone-200">
      <div className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-stone-700 text-white md:hidden" aria-hidden="true">
        <span className="text-2xl">⌖</span>
        <span className="ml-1 text-xs font-semibold">
          {memo.isPinned ? "고정 해제" : "고정"}
        </span>
      </div>

      <div className="absolute inset-y-0 right-0 flex w-[152px] md:hidden">
        <button
          type="button"
          onClick={handleShare}
          onTouchStart={(event) => event.stopPropagation()}
          aria-label={`${memo.title} 공유`}
          className="flex flex-1 flex-col items-center justify-center bg-amber-600 text-xs font-bold text-white active:brightness-90"
        >
          <span className="text-lg" aria-hidden="true">↗</span>
          공유
        </button>
        <button
          type="button"
          onClick={() => onDelete(memo)}
          onTouchStart={(event) => event.stopPropagation()}
          aria-label={`${memo.title} 삭제`}
          className="flex flex-1 flex-col items-center justify-center bg-red-800 text-xs font-bold text-white active:brightness-90"
        >
          <span className="text-lg" aria-hidden="true">×</span>
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
        className={`relative touch-pan-y border border-stone-200 bg-[#faf9f6] p-5 shadow-sm ${
          isDragging ? "" : "transition-transform duration-200 ease-out"
        }`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {!memo.richContent && (
              <h2 className="break-words text-lg font-bold text-stone-900">
                {memo.title}
              </h2>
            )}
            <p className="mt-1 text-xs text-stone-500">
              {new Date(memo.updatedAt).toLocaleString("ko-KR")}
              {memo.isPinned ? " · 고정됨" : ""}
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-1 md:flex">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin(memo.id);
              }}
              aria-label={memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`}
              className="interactive-control rounded-lg px-2.5 py-2 text-sm font-semibold text-stone-700"
            >
              {memo.isPinned ? "고정 해제" : "고정"}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(memo);
              }}
              aria-label={`${memo.title} 수정`}
              className="interactive-control rounded-lg px-2.5 py-2 text-sm font-semibold text-stone-700"
            >
              수정
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleShare();
              }}
              aria-label={`${memo.title} 공유`}
              className="interactive-control rounded-lg px-2.5 py-2 text-sm font-semibold text-amber-800"
            >
              공유
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(memo);
              }}
              aria-label={`${memo.title} 삭제`}
              className="interactive-control rounded-lg px-2.5 py-2 text-sm font-semibold text-red-800"
            >
              삭제
            </button>
          </div>
        </header>

        {memo.richContent ? (
          <div
            className="rich-content mt-4 text-stone-800"
            dangerouslySetInnerHTML={{ __html: memo.richContent }}
          />
        ) : (
          <p
            className={`mt-4 whitespace-pre-wrap text-sm leading-6 ${
              memo.content ? "text-stone-700" : "italic text-stone-500"
            }`}
          >
            {memo.content || "추가 텍스트 없음"}
          </p>
        )}

        {memo.tags.length > 0 && (
          <footer className="mt-4 flex flex-wrap gap-1.5 border-t border-stone-200 pt-4">
            {memo.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700"
              >
                #{tag}
              </span>
            ))}
          </footer>
        )}
      </article>

      {showShareNotice && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-4 bottom-3 z-20 rounded-xl bg-stone-900 px-3 py-2 text-center text-sm font-semibold text-white shadow-lg"
        >
          준비 중인 기능입니다
        </div>
      )}
    </div>
  );
}
