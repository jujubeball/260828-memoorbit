"use client";

import { useMemo, useState } from "react";
import type { Memo } from "@/types/memo";

interface OrbitGraphViewProps {
  memos: Memo[];
  onOpenMemo: (memo: Memo) => void;
}

interface TagNode {
  name: string;
  count: number;
  related: string[];
}

export function OrbitGraphView({ memos, onOpenMemo }: OrbitGraphViewProps): React.JSX.Element {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const nodes = useMemo<TagNode[]>(() => {
    const counts = new Map<string, number>();
    const links = new Map<string, Set<string>>();
    memos.forEach((memo) => {
      memo.tags.forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
        const related = links.get(tag) ?? new Set<string>();
        memo.tags.filter((item) => item !== tag).forEach((item) => related.add(item));
        links.set(tag, related);
      });
    });
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 14)
      .map(([name, count]) => ({ name, count, related: [...(links.get(name) ?? [])] }));
  }, [memos]);
  const relatedMemos = selectedTag ? memos.filter((memo) => memo.tags.includes(selectedTag)) : [];

  return (
    <section aria-labelledby="orbit-graph-title">
      <div className="mb-5">
        <p className="text-sm font-semibold text-[#b77912]">Orbit Graph</p>
        <h2 id="orbit-graph-title" className="mt-1 text-3xl font-bold">생각 궤적 탐색</h2>
        <p className="mt-2 text-sm text-[#636366]">행성을 누르면 같은 태그 궤도에 있는 메모가 연결됩니다.</p>
      </div>
      <div className="relative min-h-[520px] overflow-hidden rounded-3xl bg-[#090b18] p-5 text-white shadow-xl">
        <div className="pointer-events-none absolute inset-0 opacity-50 orbit-stars" />
        <div className="relative flex min-h-[410px] flex-wrap content-center items-center justify-center gap-4 sm:gap-7">
          {nodes.map((node, index) => {
            const isSelected = selectedTag === node.name;
            const isRelated = selectedTag
              ? nodes.find((item) => item.name === selectedTag)?.related.includes(node.name)
              : false;
            const size = Math.min(112, 54 + node.count * 5);
            return (
              <button
                key={node.name}
                type="button"
                onClick={() => setSelectedTag(isSelected ? null : node.name)}
                className={`orbit-node relative flex shrink-0 flex-col items-center justify-center rounded-full border text-center shadow-[0_0_30px_rgb(229_169_60/0.24)] transition-transform hover:scale-110 ${isSelected ? "border-white bg-[#e5a93c] text-black" : isRelated ? "border-[#e5a93c] bg-[#3c315f]" : "border-white/20 bg-[#222744]"}`}
                style={{ width: size, height: size, animationDelay: `${index * -0.45}s` }}
                aria-pressed={isSelected}
              >
                <span className="max-w-[80%] truncate text-sm font-bold">#{node.name}</span>
                <span className="mt-1 text-[10px] opacity-70">{node.count}개</span>
              </button>
            );
          })}
        </div>
        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <h3 className="text-sm font-semibold">{selectedTag ? `#${selectedTag} 궤도의 메모` : "행성을 선택해 생각의 연결을 확인하세요"}</h3>
          {selectedTag && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {relatedMemos.map((memo) => (
                <button key={memo.id} type="button" onClick={() => onOpenMemo(memo)} className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-left hover:bg-white/20">
                  <span className="block max-w-52 truncate text-sm font-semibold">{memo.title}</span>
                  <span className="mt-1 block text-xs text-white/55">{memo.tags.map((tag) => `#${tag}`).join(" ")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
