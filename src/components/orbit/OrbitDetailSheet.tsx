"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import type { Memo } from "@/types/memo";

interface OrbitDetailSheetProps {
  memos: Memo[];
  selectedId: string | null;
  viewportHeight?: number | null;
  onOpenMemo: (memo: Memo) => void;
  onClose: () => void;
}

interface SheetGesture {
  height: number;
  snap: 40 | 85;
  startPercent: number;
}

// 손을 뗀 거리와 속도를 다음 정착 높이로 바꿉니다. 빠른 짧은 손짓도 동일하게 처리합니다.
export const resolveSheetSnap = (snap: 40 | 85, offset: number, velocity: number): 0 | 40 | 85 => {
  if (offset < -48 || velocity < -400) return 85;
  if (offset > 64 || velocity > 400) return snap === 85 ? 40 : 0;
  return snap;
};

export function OrbitDetailSheet({ memos, selectedId, viewportHeight = null, onOpenMemo, onClose }: OrbitDetailSheetProps): React.JSX.Element {
  // 최초 진입은 40%이며 드래그 중 임시 높이와 손을 뗀 뒤 정착할 높이를 분리합니다.
  const [snap, setSnap] = useState<40 | 85>(40);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const gestureRef = useRef<SheetGesture>({ height: 1, snap: 40, startPercent: 40 });
  const suppressClickUntil = useRef(0);
  const reduceMotion = useReducedMotion();

  // 💡 [캔버스를 막지 않는 바깥 터치]
  // 패널 밖 입력을 관찰만 하고 취소하거나 전파를 막지 않습니다. 시트를 닫은 같은 손짓이 캔버스의 이동·확대로 이어집니다.
  useEffect(() => {
    const outside = (event: globalThis.PointerEvent): void => {
      if (!sheetRef.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  const startPan = (): void => {
    const height = viewportHeight ?? window.innerHeight;
    // 작은 화면에서 최대 높이가 제한된 경우에도 실제 보이는 높이부터 손가락을 따라 움직입니다.
    const visibleHeight = sheetRef.current?.getBoundingClientRect().height;
    gestureRef.current = {
      height,
      snap,
      startPercent: visibleHeight ? visibleHeight / height * 100 : snap,
    };
  };
  const movePan = (_event: PointerEvent, info: PanInfo): void => {
    // 손가락 이동 픽셀을 가시 화면 높이의 비율로 바꾸어 회전·키보드 변화에도 같은 정착점을 유지합니다.
    const gesture = gestureRef.current;
    setDragPercent(Math.max(8, Math.min(85, gesture.startPercent - info.offset.y / gesture.height * 100)));
  };
  const endPan = (event: PointerEvent, info: PanInfo): void => {
    setDragPercent(null);
    suppressClickUntil.current = performance.now() + 250;
    if (event.type === "pointercancel") return;
    const next = resolveSheetSnap(gestureRef.current.snap, info.offset.y, info.velocity.y);
    if (next === 0) onClose();
    else setSnap(next);
  };

  return (
    <motion.aside
      ref={sheetRef}
      role="region"
      aria-label="성운 메모 상세 시트"
      initial={{ y: reduceMotion ? 0 : "100%", height: viewportHeight === null ? "40dvh" : viewportHeight * 0.4 }}
      animate={{ y: 0, height: viewportHeight === null ? `${dragPercent ?? snap}dvh` : viewportHeight * (dragPercent ?? snap) / 100 }}
      exit={{ y: reduceMotion ? 0 : "100%", opacity: 0 }}
      transition={{ duration: reduceMotion || dragPercent !== null ? 0 : 0.24, ease: "easeOut" }}
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-full flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-[#141822]/98 shadow-[0_-12px_40px_rgb(0_0_0/0.4)]"
      data-snap={snap}
    >
      <motion.button
        type="button"
        aria-label={snap === 40 ? "상세 시트 확장" : "상세 시트 축소"}
        aria-expanded={snap === 85}
        aria-controls="orbit-sheet-memos"
        onPanStart={startPan}
        onPan={movePan}
        onPanEnd={endPan}
        onClick={() => {
          if (performance.now() < suppressClickUntil.current) return;
          setSnap((current) => current === 40 ? 85 : 40);
        }}
        className="flex h-8 shrink-0 touch-none select-none items-center justify-center focus-visible:bg-white/10"
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-[#737b8c]" />
      </motion.button>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 pb-2">
        <h2 className="text-base font-bold text-white">
          관련 메모 {memos.length}개
        </h2>
        <button type="button" onClick={onClose} className="min-h-11 rounded-full px-3 text-sm text-[#d1d5db]">
          닫기
        </button>
      </div>
      <div id="orbit-sheet-memos" className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-4">
        {/* 선택한 성운의 메모를 텍스트 카드로 보여 주고 누른 원본 메모를 기존 편집기로 전달합니다. */}
        {memos.map((memo) => (
          <button
            key={memo.id}
            type="button"
            onClick={() => onOpenMemo(memo)}
            className={`block w-full border-b border-white/10 py-3 text-left ${memo.id === selectedId ? "bg-[#e5a93c]/8" : "hover:bg-white/5"}`}
          >
            <strong className="block truncate text-[15px] font-bold text-white md:text-base">
              {memo.title}
            </strong>
            <span className="mt-1 line-clamp-2 break-words text-sm leading-5 text-gray-400">
              {memo.content.trim() || "추가 텍스트 없음"}
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[#9ca3af]">
              <time dateTime={memo.createdAt}>
                {new Date(memo.createdAt).toLocaleDateString("ko-KR")}
              </time>
              {memo.tags.map((tag) => (
                <span key={tag} className="max-w-full truncate rounded-md border border-white/10 px-1.5 py-0.5">
                  #{tag}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </motion.aside>
  );
}
