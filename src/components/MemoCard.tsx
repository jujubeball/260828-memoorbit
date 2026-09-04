"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { MemoOrbitDefaultCover } from "@/src/components/MemoOrbitDefaultCover";
import type { Memo } from "@/types/memo";

interface MemoCardProps {
  memo: Memo;
  viewMode?: "list" | "gallery";
  onEdit: (memo: Memo) => void;
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
// 왼쪽 스와이프가 끝났을 때 더 보기와 삭제 버튼 두 개가 정확히 드러나는 전체 너비입니다.
const ACTION_WIDTH = 148;

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

export function MemoCard({
  memo,
  viewMode = "list",
  onEdit,
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

  useEffect(() => {
    if (!menuPosition) return;
    // PC 우클릭 메뉴가 열린 뒤 다른 곳을 클릭하거나 스크롤하면 메뉴를 닫습니다.
    const closeMenu = (): void => setMenuPosition(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [menuPosition]);

  const handlePointerDown = (event: PointerEvent<HTMLElement>): void => {
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
      left: Math.min(event.clientX, window.innerWidth - 190),
      top: Math.min(event.clientY, window.innerHeight - 120),
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

  // 카드에는 본문 전체 대신 첫 본문 줄만 보여 주어 목록 높이가 지나치게 늘어나지 않게 합니다.
  const preview = memo.content.trim().split("\n")[0] || "추가 텍스트 없음";

  return (
    <div
      ref={cardRef}
      className={`group relative overflow-hidden bg-[#2a2e3d] text-[#f3f4f6] last:[&_.memo-row]:border-b-0 ${viewMode === "gallery" ? "rounded-2xl border border-[#2a2e3d] shadow-lg" : "rounded-lg border border-[#2a2e3d] sm:rounded-none sm:border-0"}`}
    >
      <button
        type="button"
        onClick={togglePin}
        className={`absolute inset-y-0 left-0 flex w-[74px] flex-col items-center justify-center bg-[#e5a93c] text-white xl:hidden ${offset < 0 ? "invisible pointer-events-none" : "visible"}`}
        aria-label={
          memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`
        }
      >
        <span className="text-xl" aria-hidden="true">
          ●
        </span>
        <span className="text-[11px] font-semibold">
          {memo.isPinned ? "해제" : "고정"}
        </span>
      </button>
      <div
        className={`absolute inset-y-0 right-0 flex w-[148px] xl:hidden ${offset > 0 ? "invisible pointer-events-none" : "visible"}`}
      >
        <button
          type="button"
          onClick={() => {
            currentOffset.current = 0;
            setOffset(0);
            onSwipeOpenChange(false);
          }}
          className="w-[74px] bg-[#8e8e93] text-xl text-white"
          aria-label="더 보기"
        >
          •••
        </button>
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
            ♜
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
          if (event.key === "Enter" || event.key === " ") openMemo();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
        className={`memo-row relative z-10 touch-pan-y bg-[#161922] opacity-100 ${viewMode === "gallery" ? "h-full border-0 pb-3 pl-3 pr-3 pt-0" : "border-b border-[#2a2e3d] px-3 py-2 sm:py-3.5 sm:pl-4 sm:pr-14"} ${isDragging ? "" : "transition-transform duration-200 ease-out"}`}
        style={{ transform: `translateX(${isSwipeOpen || isDragging ? offset : 0}px)` }}
      >
        {viewMode === "gallery" && (
          // 갤러리의 두 열이 작은 화면에도 나란히 들어가도록 썸네일 비율과 안쪽 여백을 작게 유지합니다.
          <div className="-ml-3 -mr-3 mb-3 aspect-video overflow-hidden bg-[#0f1117]">
            {/* 💡 [메모 카드 기본 커버 분기]
                사용자가 첨부한 imageUrl이 있으면 사진을 보여 주고, 없으면 같은 자리에 MemoOrbit 브랜드 궤도 그래픽을 채웁니다. */}
            {memo.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={memo.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <MemoOrbitDefaultCover title={memo.title} />
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
          aria-label={
            memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`
          }
          aria-pressed={memo.isPinned}
        >
          <span aria-hidden="true">{memo.isPinned ? "●" : "○"}</span>
        </button>
        <div className="flex items-center gap-2">
          {memo.isPinned && (
            <span
              className="text-[10px] text-[#b77912] xl:hidden"
              aria-label="고정됨"
            >
              ●
            </span>
          )}
          <h3
            className={`truncate font-bold ${viewMode === "gallery" ? "text-sm leading-5" : "text-[15px] leading-5 sm:text-base xl:text-[17px]"}`}
          >
            {memo.title}
          </h3>
        </div>
        <p
          className={`min-w-0 ${viewMode === "gallery" ? "mt-1 grid gap-0.5 text-xs leading-4" : "mt-0.5 flex gap-2 text-sm leading-4 text-[#d1d5db] sm:leading-5 xl:text-[15px]"}`}
        >
          <time
            className={`shrink-0 text-[#9ca3af] ${viewMode === "gallery" ? "text-xs" : "text-sm xl:text-[15px]"}`}
          >
            {formatMemoDate(memo.updatedAt)}
          </time>
          <span className="truncate text-[#9ca3af]">{preview}</span>
        </p>
        {memo.tags.length > 0 && (
          <p className="hidden truncate text-xs leading-4 text-[#9ca3af] sm:mt-0.5 sm:block sm:text-[13px]">
            {memo.tags.map((tag) => `#${tag}`).join("  ")}
          </p>
        )}
      </article>

      {menuPosition && (
        <div
          className="fixed z-40 hidden w-44 overflow-hidden rounded-xl border border-[#2a2e3d] bg-[#1a1d26]/95 py-1 text-[#f3f4f6] shadow-xl backdrop-blur-md xl:block"
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
            <span className="text-[#b77912]" aria-hidden="true">
              ●
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
