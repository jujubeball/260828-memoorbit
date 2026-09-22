"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { MemoContextMenu } from "@/src/components/MemoContextMenu";
import type { Memo } from "@/types/memo";

interface MemoCardProps {
  memo: Memo;
  viewMode?: "list" | "gallery";
  onEdit: (memo: Memo) => void;
  onEditTags: (memo: Memo) => void;
  onDelete: (memo: Memo) => void;
  onTogglePin: (id: string) => void;
  isSwipeOpen: boolean;
  onSwipeOpenChange: (isOpen: boolean) => void;
}

interface MenuPosition {
  left: number;
  top: number;
}

type SwipeAxis = "horizontal" | "vertical" | null;

// 💡 [스와이프 액션 너비]
// 왼쪽 스와이프가 끝났을 때 삭제 버튼 하나가 정확히 드러나는 너비입니다.
const ACTION_WIDTH = 74;

// 💡 [짧은 고정 스와이프 너비]
// 사용자가 오른쪽으로 살짝 밀었을 때 고정 버튼 하나만 열린 채 기다리도록 맞춘 거리입니다.
const PIN_ACTION_WIDTH = 74;
const PIN_REVEAL_THRESHOLD = 60;
const PIN_FULL_SWIPE_RATIO = 0.8;

const formatMemoDate = (iso: string): string => {
  // 저장된 ISO 날짜 문자열을 사용자가 목록에서 읽기 쉬운 연월일 값으로 바꿉니다.
  const date = new Date(iso);
  // 날짜 객체에서 네 자리 연도를 꺼냅니다.
  const year = date.getFullYear();
  // 한 자리 월 앞에는 0을 붙여 항상 두 자리로 표시합니다.
  const month = String(date.getMonth() + 1).padStart(2, "0");
  // 한 자리 일 앞에도 0을 붙여 모든 카드의 날짜 폭을 일정하게 만듭니다.
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}.`;
};

// 고정 표시와 PC 고정 버튼은 같은 14px 선 아이콘을 사용하고 접근성 이름은 부모가 제공합니다.
function PinIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M16 3l5 5-4 1-4 4v4l-2 2-6-6 2-2h4l4-4zM8 16l-5 5" />
    </svg>
  );
}

export function MemoCard({
  memo,
  viewMode = "list",
  onEdit,
  onEditTags,
  onDelete,
  onTogglePin,
  isSwipeOpen,
  onSwipeOpenChange,
}: MemoCardProps): React.JSX.Element {
  // 💡 [포인터 시작점 DOM 참조]
  // 손가락이나 마우스를 처음 댄 좌표와 기존 카드 위치를 기억해 현재 이동 거리를 정확히 계산합니다.
  const cardRef = useRef<HTMLDivElement>(null);
  const pointerStartX = useRef(0);
  const pointerStartY = useRef(0);
  const startOffset = useRef(0);
  const currentOffset = useRef(0);

  // 💡 [스와이프 방향 판별]
  // 세로 스크롤과 가로 스와이프를 구분해 목록을 위아래로 움직이는 손짓이 고정 동작으로 오인되지 않게 합니다.
  const swipeAxis = useRef<SwipeAxis>(null);
  const suppressClick = useRef(false);

  // 💡 [카드 상호작용 State]
  // offset은 화면 이동 거리, isDragging은 애니메이션 여부, menuPosition은 PC 메뉴 좌표를 화면에 전달합니다.
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    if (!isSwipeOpen) return;
    // 열린 카드 바깥에서 시작된 마우스·터치 입력은 부모의 openSwipeId를 비워 액션을 즉시 닫습니다.
    const handleOutsidePointer = (event: globalThis.PointerEvent): void => {
      if (!cardRef.current?.contains(event.target as Node)) {
        onSwipeOpenChange(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [isSwipeOpen, onSwipeOpenChange]);

  const closeMenu = useCallback(() => setMenuPosition(null), []);

  const handlePointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    if ((event.target as HTMLElement).closest("button")) return;
    // 사용자가 카드를 누른 순간 포인터 좌표와 이미 열린 카드 위치를 함께 기억합니다.
    pointerStartX.current = event.clientX;
    pointerStartY.current = event.clientY;
    const visibleOffset = isSwipeOpen ? offset : 0;
    startOffset.current = visibleOffset;
    currentOffset.current = visibleOffset;
    setOffset(visibleOffset);
    swipeAxis.current = null;
    suppressClick.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // 현재 포인터 위치에서 시작점을 빼 가로·세로 이동량을 구합니다.
    const deltaX = event.clientX - pointerStartX.current;
    const deltaY = event.clientY - pointerStartY.current;
    if (
      !swipeAxis.current &&
      Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8
    ) {
      swipeAxis.current =
        Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }
    if (swipeAxis.current !== "horizontal") return;
    event.preventDefault();
    suppressClick.current = true;
    // 왼쪽 액션 너비부터 카드의 오른쪽 끝까지만 움직이며, 고정된 숫자가 아닌 실제 카드 너비를 풀 스와이프 거리로 사용합니다.
    const cardWidth = cardRef.current?.getBoundingClientRect().width ?? 0;
    const nextOffset = Math.max(
      -ACTION_WIDTH,
      Math.min(cardWidth, startOffset.current + deltaX),
    );
    currentOffset.current = nextOffset;
    setOffset(nextOffset);

  };

  const handlePointerEnd = (event: PointerEvent<HTMLElement>): void => {
    // 드래그 도중에는 메모 순서를 바꾸지 않고, 카드 너비의 80% 이상을 끝까지 당겨 손을 뗀 순간에만 고정 상태를 전환합니다.
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setIsDragging(false);
    if (swipeAxis.current === "horizontal") {
      const cardWidth = cardRef.current?.getBoundingClientRect().width ?? 0;
      const fullSwipeThreshold = cardWidth * PIN_FULL_SWIPE_RATIO;
      const shouldTogglePin =
        cardWidth > 0 && currentOffset.current >= fullSwipeThreshold;
      if (shouldTogglePin) {
        onTogglePin(memo.id);
        window.navigator.vibrate?.(20);
      }
      const finalOffset = shouldTogglePin
        ? 0
        : currentOffset.current >= PIN_REVEAL_THRESHOLD
          ? PIN_ACTION_WIDTH
          : currentOffset.current <= -50
            ? -ACTION_WIDTH
            : 0;
      currentOffset.current = finalOffset;
      setOffset(finalOffset);
      onSwipeOpenChange(finalOffset !== 0);
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    swipeAxis.current = null;
  };

  const handlePointerCancel = (event: PointerEvent<HTMLElement>): void => {
    // 브라우저가 제스처를 취소한 경우에는 사용자가 손을 뗀 것으로 보지 않고 아무 작업 없이 카드를 닫습니다.
    setIsDragging(false);
    currentOffset.current = 0;
    setOffset(0);
    onSwipeOpenChange(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    swipeAxis.current = null;
  };

  const openMemo = (): void => {
    // 스와이프 직후의 가짜 클릭은 무시하고, 열린 액션이 없을 때만 편집기를 엽니다.
    if (suppressClick.current) return;
    if (isSwipeOpen && offset !== 0) {
      currentOffset.current = 0;
      setOffset(0);
      onSwipeOpenChange(false);
      return;
    }
    onEdit(memo);
  };

  const openContextMenu = (event: MouseEvent<HTMLElement>): void => {
    // PC에서 우클릭한 실제 화면 좌표를 메뉴가 화면 밖으로 나가지 않는 범위로 저장합니다.
    event.preventDefault();
    setMenuPosition({
      left: event.clientX,
      top: event.clientY,
    });
  };

  const togglePin = (): void => {
    // 짧은 스와이프로 드러난 버튼이나 PC 메뉴를 누르면 부모의 메모 고정 State를 변경하고 모든 액션을 닫습니다.
    onTogglePin(memo.id);
    currentOffset.current = 0;
    setOffset(0);
    onSwipeOpenChange(false);
    setMenuPosition(null);
  };

  // 저장된 일반 본문을 공백으로 정리하고 날짜 옆의 한 줄 요약으로 표시합니다. 줄바꿈도 공백으로 바꿔 행 높이를 일정하게 유지합니다.
  const preview = memo.content.trim().replace(/\s+/g, " ") || "추가 텍스트 없음";

  return (
    <div
      ref={cardRef}
      className={`group relative min-w-0 max-w-full overflow-hidden border-b border-slate-800/50 text-slate-100 last:border-b-0 ${viewMode === "gallery" ? "md:rounded-2xl md:border md:border-[#2a2e3d] md:bg-[#161922] md:shadow-lg md:last:border-b" : ""}`}
    >
      <button
        type="button"
        onClick={togglePin}
        className={`absolute inset-y-0 left-0 flex w-[74px] flex-col items-center justify-center bg-[#e5a93c] text-white ${!(isSwipeOpen || isDragging) || offset <= 0 ? "invisible pointer-events-none" : "visible"}`}
        aria-label={
          memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`
        }
      >
        <span className="text-xl" aria-hidden="true">
          📌
        </span>
        <span className="text-[11px] font-semibold">
          {memo.isPinned ? "해제" : "고정"}
        </span>
      </button>
      <div
        className={`absolute inset-y-0 right-0 flex w-[74px] ${!(isSwipeOpen || isDragging) || offset >= 0 ? "invisible pointer-events-none" : "visible"}`}
      >
        <button
          type="button"
          onClick={() => {
            currentOffset.current = 0;
            setOffset(0);
            onSwipeOpenChange(false);
            onDelete(memo);
          }}
          className="flex w-[74px] flex-col items-center justify-center bg-[#ff3b30] text-white"
          aria-label={`${memo.title} 삭제`}
        >
          <span className="text-xl" aria-hidden="true">
            🗑️
          </span>
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
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openMemo();
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
        className={`memo-row relative z-10 min-w-0 max-w-full touch-pan-y px-4 py-3 hover:bg-slate-800/40 active:bg-slate-800/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#e5a93c] xl:pr-14 ${isSwipeOpen || isDragging ? "bg-[#161922]" : "bg-transparent"} ${viewMode === "gallery" ? "md:h-full md:p-3 md:pt-0 xl:pr-14" : ""} ${isDragging ? "transition-colors" : "transition-[transform,background-color] duration-200 ease-out motion-reduce:transition-none"}`}
        style={{ transform: `translateX(${isSwipeOpen || isDragging ? offset : 0}px)` }}
      >
        {viewMode === "gallery" && memo.imageUrl && (
          <div className="-mx-3 mb-3 hidden aspect-video overflow-hidden bg-[#0f1117] md:block">
            {/* PC 사진 갤러리에만 실제 첨부 사진을 표시하고 기본 커버는 만들지 않습니다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={memo.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            togglePin();
          }}
          className={`absolute right-2 top-0 hidden h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-slate-800/60 focus-visible:outline-2 focus-visible:outline-[#e5a93c] xl:flex ${memo.isPinned ? "text-[#e5a93c]" : "text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
          aria-label={
            memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`
          }
          aria-pressed={memo.isPinned}
        >
          <PinIcon />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          {memo.isPinned && (
            <span
              className="shrink-0 text-[#e5a93c] xl:hidden"
              aria-label="고정됨"
            >
              <PinIcon />
            </span>
          )}
          <h3
            className="min-w-0 flex-1 text-[17px] font-semibold text-white truncate mb-0.5"
          >
            {memo.title}
          </h3>
          {memo.syncStatus === "failed" && (
            <span
              className="shrink-0 text-xs text-amber-200/60"
              role="img"
              aria-label="서버 동기화 실패. 메모는 이 기기에 저장되어 있습니다."
              title="서버 동기화 실패. 메모는 이 기기에 저장되어 있습니다."
            >
              ⚠
            </span>
          )}
        </div>
        <div className={`mt-1 flex min-w-0 items-center gap-2 ${viewMode === "gallery" ? "md:hidden" : ""}`}>
          <time dateTime={memo.createdAt} className="shrink-0 text-[13px] font-normal text-slate-400 truncate">
            {formatMemoDate(memo.createdAt)}
          </time>
          <p className="min-w-0 flex-1 text-[13px] font-normal text-slate-400 truncate">
            {preview}
          </p>
        </div>
        {/* PC 사진 갤러리에서만 기존 상세 요약과 태그를 표시하고 모바일은 항상 위의 두 줄을 사용합니다. */}
        {viewMode === "gallery" && (
          <div className="hidden md:block">
            <p className="mt-1 line-clamp-2 whitespace-normal break-words text-sm leading-5 text-gray-400">
              {preview}
            </p>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <time dateTime={memo.createdAt} className="shrink-0">
                {formatMemoDate(memo.createdAt)}
              </time>
              {/* 갤러리에서 저장된 태그 배열을 작은 칩으로 바꿔 메모의 주제를 보여 줍니다. */}
              {memo.tags.map((tag) => (
                <span
                  key={tag}
                  className="max-w-full truncate rounded-md border border-[#2a2e3d] bg-white/5 px-1.5 py-0.5"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>

      {menuPosition && (
        <MemoContextMenu
          memo={memo}
          position={menuPosition}
          onClose={closeMenu}
          onTogglePin={onTogglePin}
          onEditTags={onEditTags}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
