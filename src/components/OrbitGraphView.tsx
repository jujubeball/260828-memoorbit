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
import { MainContentHeader } from "@/src/components/MainContentHeader";

interface OrbitGraphViewProps {
  memos: Memo[];
  onOpenMemo: (memo: Memo) => void;
  onHeaderVisibilityChange?: (isVisible: boolean) => void;
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
  memos.forEach((memo) =>
    memo.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
      const related = links.get(tag) ?? new Set<string>();
      memo.tags
        .filter((item) => item !== tag)
        .forEach((item) => related.add(item));
      links.set(tag, related);
    }),
  );
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 16)
    .map(([name, count], index, items) => {
      const angle = (index / items.length) * Math.PI * 2;
      const radius = 115 + (index % 4) * 55;
      return {
        name,
        count,
        related: [...(links.get(name) ?? [])],
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
};

export function OrbitGraphView({
  memos,
  onOpenMemo,
  onHeaderVisibilityChange,
}: OrbitGraphViewProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef({ active: false, x: 0, y: 0 });
  // 💡 [선택한 태그 State]
  // 모바일과 PC에서 누른 태그 이름을 기억하며, 이 값이 바뀌면 아래 관련 메모 목록도 즉시 다시 계산됩니다.
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const nodes = useMemo(() => createNodes(memos), [memos]);
  const relatedMemos = selectedTag
    ? memos.filter((memo) => memo.tags.includes(selectedTag))
    : [];

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
      context.translate(
        rect.width / 2 + transform.x,
        rect.height / 2 + transform.y,
      );
      context.scale(transform.scale, transform.scale);
      const focusTag = hoveredTag ?? selectedTag;
      const focusNode = nodes.find((node) => node.name === focusTag);
      nodes.forEach((node) => {
        node.related.forEach((relatedName) => {
          const related = nodes.find((item) => item.name === relatedName);
          if (!related || node.name > related.name) return;
          const highlighted =
            focusNode &&
            (focusNode.name === node.name || focusNode.name === related.name) &&
            focusNode.related.includes(
              focusNode.name === node.name ? related.name : node.name,
            );
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

  const findNode = (clientX: number, clientY: number): TagNode | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const rect = canvas.getBoundingClientRect();
    const transform = transformRef.current;
    const x =
      (clientX - rect.left - rect.width / 2 - transform.x) / transform.scale;
    const y =
      (clientY - rect.top - rect.height / 2 - transform.y) / transform.scale;
    return nodes.find(
      (node) =>
        Math.hypot(node.x - x, node.y - y) <=
        Math.min(34, 17 + node.count * 1.5),
    );
  };

  // 💡 [모바일 태그 선택 함수]
  // 태그 행성을 누르면 같은 태그는 닫고 다른 태그는 선택하여, 팝업 없이 그래프 아래 목록을 교체합니다.
  const selectMobileTag = (tag: string): void => {
    setSelectedTag((current) => (current === tag ? null : tag));
  };

  return (
    <section
      className="text-[#f3f4f6] xl:flex xl:h-full xl:flex-col xl:overflow-hidden"
      aria-labelledby="orbit-graph-title"
    >
      <MainContentHeader
        id="orbit-graph-title"
        label="TAG ORBIT"
        title="태그 궤도 탐색"
        description="태그 행성을 따라 연결된 메모 궤도를 탐색하세요."
        onVisibilityChange={onHeaderVisibilityChange}
      />

      <div className="glass-panel relative hidden overflow-hidden xl:block xl:min-h-0 xl:flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onWheel={(event: WheelEvent<HTMLCanvasElement>) => {
            event.preventDefault();
            transformRef.current.scale = Math.min(
              2.4,
              Math.max(
                0.55,
                transformRef.current.scale * (event.deltaY > 0 ? 0.9 : 1.1),
              ),
            );
            setRenderVersion((current) => current + 1);
          }}
          onMouseDown={(event) => {
            dragRef.current = {
              active: true,
              x: event.clientX,
              y: event.clientY,
            };
          }}
          onMouseUp={() => {
            dragRef.current.active = false;
          }}
          onMouseLeave={() => {
            dragRef.current.active = false;
            setHoveredTag(null);
          }}
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
          onClick={(event) =>
            setSelectedTag(findNode(event.clientX, event.clientY)?.name ?? null)
          }
          aria-label="마우스 휠로 확대하고 드래그로 이동하는 태그 궤도 그래프"
        />
        <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-[#2a2e3d] bg-[#0f1117]/75 px-3 py-2 text-xs text-[#9ca3af] backdrop-blur-md">
          휠: 확대·축소 · 드래그: 이동
        </div>
        {(hoveredTag || selectedTag) && (
          <div className="pointer-events-none absolute right-4 top-4 w-64 rounded-xl border border-[#2a2e3d] bg-[#1a1d26]/90 p-4 backdrop-blur-md">
            <strong>#{hoveredTag ?? selectedTag}</strong>
            <p className="mt-2 text-xs text-[#9ca3af]">
              {
                memos.filter((memo) =>
                  memo.tags.includes(hoveredTag ?? selectedTag ?? ""),
                ).length
              }
              개의 메모 · 클릭하면 궤도를 고정합니다.
            </p>
          </div>
        )}
        {selectedTag && (
          <div className="absolute inset-x-4 bottom-4 grid max-h-[300px] gap-2 overflow-y-auto rounded-2xl border border-[#2a2e3d] bg-[#0f1117]/80 p-3 backdrop-blur-md">
            {relatedMemos.map((memo) => (
              <button
                key={memo.id}
                type="button"
                onClick={() => onOpenMemo(memo)}
                className="rounded-xl bg-white/5 px-4 py-3 text-left hover:bg-white/10"
              >
                <strong className="block truncate text-sm">{memo.title}</strong>
                <span className="text-xs text-[#9ca3af]">
                  {memo.tags.map((tag) => `#${tag}`).join(" ")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pb-6 xl:hidden">
        <div className="scrollbar-hidden flex snap-x gap-4 overflow-x-auto px-[12vw] py-8">
          {nodes.map((node) => (
            <button
              key={node.name}
              type="button"
              onClick={() => selectMobileTag(node.name)}
              aria-pressed={selectedTag === node.name}
              className={`orbit-node flex aspect-square w-36 shrink-0 snap-center flex-col items-center justify-center rounded-full border shadow-[0_0_30px_rgb(229_169_60/0.2)] transition-colors ${selectedTag === node.name ? "border-[#ffc86b] bg-[#e5a93c] text-[#0f1117]" : "border-[#596077] bg-[#1a1d26]/80"}`}
            >
              <strong>#{node.name}</strong>
              <span className="mt-2 text-xs text-[#9ca3af]">
                {node.count}개의 기록
              </span>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-[#9ca3af]">
          좌우로 밀어 태그 행성을 탐색하세요
        </p>
        {selectedTag && (
          <section
            className="mt-5 border-t border-[#2a2e3d] pt-4"
            aria-labelledby="mobile-related-memos-title"
          >
            <div className="flex items-center justify-between gap-3">
              <h3
                id="mobile-related-memos-title"
                className="truncate text-sm font-bold"
              >
                #{selectedTag} 관련 메모 ({relatedMemos.length}개)
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="shrink-0 text-xs text-[#9ca3af] underline underline-offset-4"
              >
                닫기
              </button>
            </div>
            {/* 선택된 태그의 메모를 팝업이 아닌 현재 문서 흐름 안에서 세로로 쌓아 보여 줍니다. */}
            <div className="mt-3 flex flex-col gap-2">
              {relatedMemos.map((memo) => (
                <button
                  key={memo.id}
                  type="button"
                  onClick={() => onOpenMemo(memo)}
                  className="rounded-xl border border-[#2a2e3d] bg-[#1a1d26]/80 p-3 text-left shadow-sm"
                >
                  <strong className="block truncate text-sm">{memo.title}</strong>
                  <p className="mt-1 line-clamp-2 text-xs text-[#9ca3af]">
                    {memo.content}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
