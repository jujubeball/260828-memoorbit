"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Memo } from "@/types/memo";

interface OrbitGraphViewProps {
  memos: Memo[];
  onOpenMemo: (memo: Memo) => void;
}

interface TagNode {
  name: string;
  count: number;
  related: string[];
  x: number;
  y: number;
}

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

const createNodes = (memos: Memo[]): TagNode[] => {
  const counts = new Map<string, number>();
  const links = new Map<string, Set<string>>();
  memos.forEach((memo) => memo.tags.forEach((tag) => {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
    const related = links.get(tag) ?? new Set<string>();
    memo.tags.filter((item) => item !== tag).forEach((item) => related.add(item));
    links.set(tag, related);
  }));
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 16).map(([name, count], index, items) => {
    const angle = (index / items.length) * Math.PI * 2;
    const radius = 115 + (index % 4) * 55;
    return { name, count, related: [...(links.get(name) ?? [])], x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
};

export function OrbitGraphView({ memos, onOpenMemo }: OrbitGraphViewProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef({ active: false, x: 0, y: 0 });
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);
  const nodes = useMemo(() => createNodes(memos), [memos]);
  const relatedMemos = selectedTag ? memos.filter((memo) => memo.tags.includes(selectedTag)) : [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const draw = (): void => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      const transform = transformRef.current;
      context.save();
      context.translate(rect.width / 2 + transform.x, rect.height / 2 + transform.y);
      context.scale(transform.scale, transform.scale);
      const focusTag = hoveredTag ?? selectedTag;
      const focusNode = nodes.find((node) => node.name === focusTag);
      nodes.forEach((node) => {
        node.related.forEach((relatedName) => {
          const related = nodes.find((item) => item.name === relatedName);
          if (!related || node.name > related.name) return;
          const highlighted = focusNode && (focusNode.name === node.name || focusNode.name === related.name) && focusNode.related.includes(focusNode.name === node.name ? related.name : node.name);
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.lineTo(related.x, related.y);
          context.strokeStyle = highlighted ? "#ffc86b" : "#2a2e3d";
          context.lineWidth = highlighted ? 2.5 : 1;
          context.stroke();
        });
      });
      nodes.forEach((node) => {
        const radius = Math.min(34, 17 + node.count * 1.5);
        const active = node.name === focusTag;
        context.beginPath();
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fillStyle = active ? "#e5a93c" : "#1a1d26";
        context.fill();
        context.strokeStyle = active ? "#ffc86b" : "#596077";
        context.lineWidth = active ? 3 : 1;
        context.stroke();
        context.fillStyle = active ? "#0f1117" : "#f3f4f6";
        context.font = `${active ? "600" : "500"} 12px sans-serif`;
        context.textAlign = "center";
        context.fillText(`#${node.name}`, node.x, node.y + 4);
      });
      context.restore();
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [hoveredTag, nodes, renderVersion, selectedTag]);

  useEffect(() => {
    if (!isSheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSheetOpen]);

  const findNode = (clientX: number, clientY: number): TagNode | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const rect = canvas.getBoundingClientRect();
    const transform = transformRef.current;
    const x = (clientX - rect.left - rect.width / 2 - transform.x) / transform.scale;
    const y = (clientY - rect.top - rect.height / 2 - transform.y) / transform.scale;
    return nodes.find((node) => Math.hypot(node.x - x, node.y - y) <= Math.min(34, 17 + node.count * 1.5));
  };

  const selectMobileTag = (tag: string): void => {
    setSelectedTag(tag);
    setIsSheetOpen(true);
  };

  const closeSheet = (): void => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setIsSheetOpen(false);
  };

  const openRelatedMemo = (memo: Memo): void => {
    closeSheet();
    onOpenMemo(memo);
  };

  return (
    <section className="text-[#f3f4f6]" aria-labelledby="orbit-graph-title">
      <p className="text-sm font-semibold text-[#ffc86b]">Orbit Graph</p>
      <h2 id="orbit-graph-title" className="mt-1 text-3xl font-bold">생각 궤적 탐색</h2>
      <p className="mt-2 text-sm text-[#9ca3af]">태그 행성을 따라 연결된 기록을 탐색하세요.</p>

      <div className="glass-panel relative mt-5 hidden h-[650px] overflow-hidden xl:block">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onWheel={(event: WheelEvent<HTMLCanvasElement>) => {
            event.preventDefault();
            transformRef.current.scale = Math.min(2.4, Math.max(0.55, transformRef.current.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
            setRenderVersion((current) => current + 1);
          }}
          onMouseDown={(event) => { dragRef.current = { active: true, x: event.clientX, y: event.clientY }; }}
          onMouseUp={() => { dragRef.current.active = false; }}
          onMouseLeave={() => { dragRef.current.active = false; setHoveredTag(null); }}
          onMouseMove={(event: ReactMouseEvent<HTMLCanvasElement>) => {
            if (dragRef.current.active) {
              transformRef.current.x += event.clientX - dragRef.current.x;
              transformRef.current.y += event.clientY - dragRef.current.y;
              dragRef.current.x = event.clientX;
              dragRef.current.y = event.clientY;
              setRenderVersion((current) => current + 1);
              return;
            }
            setHoveredTag(findNode(event.clientX, event.clientY)?.name ?? null);
          }}
          onClick={(event) => setSelectedTag(findNode(event.clientX, event.clientY)?.name ?? null)}
          aria-label="마우스 휠로 확대하고 드래그로 이동하는 태그 궤도 그래프"
        />
        <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-[#2a2e3d] bg-[#0f1117]/75 px-3 py-2 text-xs text-[#9ca3af] backdrop-blur-md">휠: 확대·축소 · 드래그: 이동</div>
        {(hoveredTag || selectedTag) && <div className="pointer-events-none absolute right-4 top-4 w-64 rounded-xl border border-[#2a2e3d] bg-[#1a1d26]/90 p-4 backdrop-blur-md"><strong>#{hoveredTag ?? selectedTag}</strong><p className="mt-2 text-xs text-[#9ca3af]">{memos.filter((memo) => memo.tags.includes(hoveredTag ?? selectedTag ?? "")).length}개의 메모 · 클릭하면 궤도를 고정합니다.</p></div>}
        {selectedTag && <div className="absolute inset-x-4 bottom-4 grid max-h-60 gap-2 overflow-y-auto rounded-2xl border border-[#2a2e3d] bg-[#0f1117]/80 p-3 backdrop-blur-md">{relatedMemos.map((memo) => <button key={memo.id} type="button" onClick={() => onOpenMemo(memo)} className="rounded-xl bg-white/5 px-4 py-3 text-left hover:bg-white/10"><strong className="block truncate text-sm">{memo.title}</strong><span className="text-xs text-[#9ca3af]">{memo.tags.map((tag) => `#${tag}`).join(" ")}</span></button>)}</div>}
      </div>

      <div className="mt-5 xl:hidden">
        <div className="flex snap-x gap-4 overflow-x-auto px-[12vw] py-8">
          {nodes.map((node) => <button key={node.name} type="button" onClick={() => selectMobileTag(node.name)} className="orbit-node flex aspect-square w-36 shrink-0 snap-center flex-col items-center justify-center rounded-full border border-[#596077] bg-[#1a1d26]/80 shadow-[0_0_30px_rgb(229_169_60/0.2)]"><strong>#{node.name}</strong><span className="mt-2 text-xs text-[#9ca3af]">{node.count}개의 기록</span></button>)}
        </div>
        <p className="text-center text-xs text-[#9ca3af]">좌우로 밀어 태그 행성을 탐색하세요</p>
      </div>

      {isSheetOpen && selectedTag && (
        <div
          className="fixed inset-0 z-[140] flex items-end bg-[#0f1117]/70 p-3 xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="orbit-sheet-title"
        >
          <button
            type="button"
            onClick={closeSheet}
            className="absolute inset-0 cursor-default"
            aria-label="연관 메모 팝업 닫기"
          />
          <div className="relative max-h-[70dvh] w-full overflow-y-auto overscroll-contain rounded-3xl border border-[#2a2e3d] bg-[rgba(26,29,38,0.85)] shadow-[0_-20px_60px_rgb(0_0_0/0.45)] backdrop-blur-md">
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#2a2e3d] bg-[#1a1d26]/90 p-5 backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-2">
                <h3 id="orbit-sheet-title" className="truncate text-xl font-bold">
                  #{selectedTag} 궤도의 메모
                </h3>
                <span className="shrink-0 rounded-full bg-[#e5a93c]/15 px-2.5 py-1 text-xs font-semibold text-[#ffc86b]">
                  총 {relatedMemos.length}개
                </span>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                className="glass-icon-button shrink-0"
                aria-label="연관 메모 닫기"
              >
                ×
              </button>
            </header>
            <div className="grid gap-2 p-5">
              {relatedMemos.map((memo) => (
                <button
                  key={memo.id}
                  type="button"
                  onClick={() => openRelatedMemo(memo)}
                  className="rounded-xl border border-[#2a2e3d] bg-[#0f1117]/45 p-4 text-left shadow-sm"
                >
                  <strong>{memo.title}</strong>
                  <p className="mt-1 line-clamp-2 text-sm text-[#9ca3af]">
                    {memo.content}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
