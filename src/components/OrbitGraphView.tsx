"use client";

import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Memo } from "@/types/memo";
import { MainContentHeader } from "@/src/components/MainContentHeader";
import { requestMemoLinks } from "@/src/lib/geminiClient";
import type { GeminiMemoLink } from "@/src/types/gemini";

interface OrbitGraphViewProps {
  memos: Memo[];
  onOpenMemo: (memo: Memo) => void;
  onHeaderVisibilityChange?: (isVisible: boolean) => void;
  onLinksAnalyzed: (links: GeminiMemoLink[]) => void;
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

interface AiTagEdge {
  source: string;
  target: string;
  weight: number;
}

const MAX_PAN = 250;

// 💡 [메모 개수별 태그 행성 크기 계산]
// createNodes가 미리 세어 둔 태그별 메모 개수를 받아 크기·글자·빛 효과를 하나의 Tailwind 클래스 문자열로 돌려줍니다.
const getTagPlanetSize = (memoCount: number): string => {
  if (memoCount >= 8) {
    return "h-20 w-20 text-sm border-[#e5a93c] bg-[#e5a93c] font-bold text-[#0f1117] shadow-[0_0_20px_rgba(229,169,60,0.6)]";
  }
  if (memoCount >= 4) {
    return "h-16 w-16 text-xs border-[#75658f] bg-[#242334]/90 font-semibold text-[#f3f4f6] shadow-[0_0_12px_rgba(117,101,143,0.35)]";
  }
  return "h-12 w-12 text-[10px] border-[#2a2e3d] bg-[#1a1d26]/90 text-[#9ca3af]";
};

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
  onLinksAnalyzed,
}: OrbitGraphViewProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef({ active: false, x: 0, y: 0 });
  const requestedLinksSignatureRef = useRef("");
  // 💡 [선택한 태그 State]
  // 모바일과 PC에서 누른 태그 이름을 기억하며, 이 값이 바뀌면 아래 관련 메모 목록도 즉시 다시 계산됩니다.
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const nodes = useMemo(() => createNodes(memos), [memos]);
  // AI 메모 링크의 양 끝 메모에서 대표 태그를 찾아 기존 태그 행성 좌표에 그릴 연결선으로 변환합니다.
  const aiTagEdges = useMemo(() => {
    const memoById = new Map(memos.map((memo) => [memo.id, memo]));
    const visibleTags = new Set(nodes.map((node) => node.name));
    const edges = new Map<string, AiTagEdge>();
    memos.forEach((memo) => {
      const source = memo.tags.find((tag) => visibleTags.has(tag));
      if (!source) return;
      memo.links?.forEach((link) => {
        const targetMemo = memoById.get(link.targetId);
        const target = targetMemo?.tags.find((tag) => visibleTags.has(tag));
        if (!target || source === target || link.weight < 0.6) return;
        const [first, second] = [source, target].sort();
        const key = `${first}:${second}`;
        const existing = edges.get(key);
        if (!existing || existing.weight < link.weight) {
          edges.set(key, { source: first, target: second, weight: link.weight });
        }
      });
    });
    return [...edges.values()];
  }, [memos, nodes]);
  const relatedMemos = selectedTag
    ? memos.filter((memo) => memo.tags.includes(selectedTag))
    : [];

  // 💡 [AI 연관 링크 자동 생성]
  // 저장된 링크가 전혀 없는 데이터 묶음은 궤도 화면에 처음 들어왔을 때 한 번만 Gemini에 보내고, 결과를 상위 memos State로 전달합니다.
  useEffect(() => {
    if (memos.length < 2 || memos.every((memo) => memo.links !== undefined)) return;
    const signature = memos
      .map((memo) => `${memo.id}:${memo.updatedAt}:${memo.links === undefined}`)
      .join("|");
    if (requestedLinksSignatureRef.current === signature) return;
    requestedLinksSignatureRef.current = signature;
    const controller = new AbortController();
    void requestMemoLinks(memos, controller.signal)
      .then(onLinksAnalyzed)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error("AI 메모 연결을 불러오지 못했습니다.", error);
        }
      });
    return () => controller.abort();
  }, [memos, onLinksAnalyzed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 💡 [Passive 이벤트 오류 해결]
    // 브라우저가 휠 이벤트를 먼저 스크롤에 사용하지 않도록 passive: false로 등록하며, 사용자의 휠 입력은 확대 배율과 화면 다시 그리기로 이어집니다.
    const handleWheel = (event: globalThis.WheelEvent): void => {
      event.preventDefault();
      transformRef.current.scale = Math.min(
        2.4,
        Math.max(
          0.55,
          transformRef.current.scale * (event.deltaY > 0 ? 0.9 : 1.1),
        ),
      );
      setRenderVersion((current) => current + 1);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

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
      // AI가 찾은 의미 연결은 기존 태그 공통 연결선 아래에 황금빛 Glow로 먼저 그립니다.
      aiTagEdges.forEach((edge) => {
        const source = nodes.find((node) => node.name === edge.source);
        const target = nodes.find((node) => node.name === edge.target);
        if (!source || !target) return;
        const highlighted = focusTag === edge.source || focusTag === edge.target;
        context.save();
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.strokeStyle = `rgba(229, 169, 60, ${0.12 + edge.weight * 0.68})`;
        context.lineWidth = 0.75 + edge.weight * 3;
        context.shadowColor = highlighted ? "#ffc86b" : "transparent";
        context.shadowBlur = highlighted ? 8 + edge.weight * 14 : 0;
        context.stroke();
        context.restore();
      });
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
  }, [aiTagEdges, hoveredTag, nodes, renderVersion, selectedTag]);

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
      className="flex h-[calc(100dvh-48px)] flex-col overflow-hidden text-[#f3f4f6] xl:h-full"
      aria-labelledby="orbit-graph-title"
    >
      <div className="flex-none">
        <MainContentHeader
          id="orbit-graph-title"
          label="TAG ORBIT"
          title="태그 궤도 탐색"
          description="태그 행성을 따라 연결된 메모 궤도를 탐색하세요."
          onVisibilityChange={onHeaderVisibilityChange}
        />
      </div>

      <div className="glass-panel relative hidden overflow-hidden xl:block xl:min-h-0 xl:flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
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
              const rawPanX =
                transformRef.current.x + event.clientX - dragRef.current.x;
              const rawPanY =
                transformRef.current.y + event.clientY - dragRef.current.y;

              // 💡 [드래그 이동 경계 고정]
              // 현재 궤도 위치에 마우스 이동량을 더한 뒤 ±250px 안으로 잘라, 계속 끌어도 노드가 캔버스 밖으로 사라지지 않게 합니다.
              transformRef.current.x = Math.max(
                -MAX_PAN,
                Math.min(MAX_PAN, rawPanX),
              );
              transformRef.current.y = Math.max(
                -MAX_PAN,
                Math.min(MAX_PAN, rawPanY),
              );
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

      <div className="flex min-h-0 flex-1 flex-col xl:hidden">
        {/* 상단 궤도는 줄어들지 않는 flex-none 영역이라 아래 메모를 스크롤해도 같은 자리에 남습니다. */}
        <div className="relative flex-none overflow-hidden border-b border-[#2a2e3d] bg-[#0f1117]">
          <svg
            className="pointer-events-none absolute inset-x-0 top-1/2 h-32 w-full -translate-y-1/2 opacity-30"
            viewBox="0 0 360 128"
            aria-hidden="true"
          >
            <ellipse
              cx="180"
              cy="64"
              rx="155"
              ry="48"
              fill="none"
              stroke="#e5a93c"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
          </svg>
          <div className="scrollbar-hidden relative z-10 flex h-36 snap-x snap-mandatory items-center gap-4 overflow-x-auto px-[12vw] py-6">
            {nodes.map((node) => (
              <button
                key={node.name}
                type="button"
                onClick={() => selectMobileTag(node.name)}
                aria-pressed={selectedTag === node.name}
                // 태그에 연결된 메모 개수가 많을수록 큰 행성 클래스를 적용하고, 선택된 행성에는 별도의 황금 링을 더합니다.
                className={`orbit-node flex shrink-0 snap-center flex-col items-center justify-center rounded-full border transition-all duration-300 ${getTagPlanetSize(node.count)} ${selectedTag === node.name ? "z-20 scale-110 ring-2 ring-[#ffc86b] ring-offset-2 ring-offset-[#0f1117]" : "opacity-85"}`}
              >
                <strong className="max-w-[90%] truncate">#{node.name}</strong>
                <span className="mt-1 text-[9px] font-normal opacity-75">
                  {node.count}개
                </span>
              </button>
            ))}
          </div>
          <p className="pb-3 text-center text-[11px] text-[#9ca3af]">
            기록이 많이 쌓일수록 궤도 안의 행성이 커집니다
          </p>
        </div>

        {/* 하단 목록만 남은 화면 높이를 사용하고, 내용이 길면 이 영역 안에서만 세로로 움직입니다. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-6">
          {selectedTag && (
            <section
              className="py-4"
              aria-labelledby="mobile-related-memos-title"
            >
              {/* 다른 행성을 누르면 목록이 자연스럽게 교체되므로 별도의 닫기 버튼 없이 관련 메모 제목만 표시합니다. */}
              <div>
                <h3
                  id="mobile-related-memos-title"
                  className="truncate text-sm font-bold"
                >
                  #{selectedTag} 관련 메모 ({relatedMemos.length}개)
                </h3>
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
                    <strong className="block truncate text-sm">
                      {memo.title}
                    </strong>
                    <p className="mt-1 line-clamp-2 text-xs text-[#9ca3af]">
                      {memo.content}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
          {!selectedTag && (
            <p className="px-4 py-8 text-center text-sm text-[#9ca3af]">
              좌우로 밀어 태그 행성을 선택하세요.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
