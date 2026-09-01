"use client";

import { useState } from "react";
import type { Memo } from "@/types/memo";

export interface MemoryCandidate {
  memo: Memo;
  intervalLabel: "1년 전" | "100일 전";
}

interface MemoryOrbitViewProps {
  candidates: MemoryCandidate[];
  onOpenMemo: (memo: Memo) => void;
}

type ViewMode = "polaroid" | "feed";

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));

export function MemoryOrbitView({ candidates, onOpenMemo }: MemoryOrbitViewProps): React.JSX.Element | null {
  const [viewMode, setViewMode] = useState<ViewMode>("polaroid");
  const [isOpen, setIsOpen] = useState(true);

  if (candidates.length === 0) return null;

  return (
    <section className="mb-8" aria-labelledby="memory-orbit-title">
      <div className="flex h-11 items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="ios-tap flex h-11 items-center gap-2 text-left"
          aria-expanded={isOpen}
          aria-controls="memory-orbit-content"
        >
          <h2 id="memory-orbit-title" className="text-[22px] font-bold leading-7">오늘의 Memory Orbit</h2>
          <span className="text-[#b77912]" aria-hidden="true">{isOpen ? "⌃" : "⌄"}</span>
        </button>
        {isOpen && (
          <div className="flex rounded-lg bg-[#e5e5ea] p-1" aria-label="추억 보기 방식">
            <button type="button" onClick={() => setViewMode("polaroid")} className={`rounded-md px-3 py-1 text-xs ${viewMode === "polaroid" ? "bg-white shadow-sm" : "text-[#636366]"}`} aria-pressed={viewMode === "polaroid"}>폴라로이드</button>
            <button type="button" onClick={() => setViewMode("feed")} className={`rounded-md px-3 py-1 text-xs ${viewMode === "feed" ? "bg-white shadow-sm" : "text-[#636366]"}`} aria-pressed={viewMode === "feed"}>세로 피드</button>
          </div>
        )}
      </div>
      {isOpen && (
        <div id="memory-orbit-content" className={viewMode === "polaroid" ? "flex snap-x gap-4 overflow-x-auto px-1 pb-4 pt-2" : "grid gap-4 pt-2 md:grid-cols-2"}>
          {candidates.map(({ memo, intervalLabel }) => (
            <button
              key={`${intervalLabel}-${memo.id}`}
              type="button"
              onClick={() => onOpenMemo(memo)}
              className={viewMode === "polaroid" ? "ios-tap w-[min(82vw,320px)] shrink-0 snap-center rotate-[-1deg] bg-white p-3 pb-6 text-left shadow-lg" : "ios-tap overflow-hidden rounded-2xl bg-white text-left shadow-sm"}
            >
              <div className={`relative overflow-hidden bg-gradient-to-br from-[#e5a93c] via-[#8e8e93] to-[#1c1c1e] ${viewMode === "polaroid" ? "aspect-[4/3]" : "aspect-[16/9]"}`}>
                {(memo.imageUrl || memo.aiImageUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={memo.imageUrl ?? memo.aiImageUrl} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">{intervalLabel}</span>
              </div>
              <div className={viewMode === "polaroid" ? "px-1 pt-4" : "p-4"}>
                <h3 className="truncate text-lg font-bold">{memo.title}</h3>
                <p className="mt-1 text-xs text-[#8e8e93]">{formatDate(memo.createdAt)}</p>
                {viewMode === "feed" && <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#636366]">{memo.content}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
