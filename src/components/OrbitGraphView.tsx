"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, type PointerEvent } from "react";
import type { Memo } from "@/types/memo";
import { MainContentHeader } from "@/src/components/MainContentHeader";
import {
  GeminiApiError,
  getGeminiErrorLabel,
  requestMemoLinks,
} from "@/src/lib/geminiClient";
import type { GeminiMemoLink } from "@/src/types/gemini";
import {
  createOrbitLayout,
  getOrbitClusterSummaries,
  stepOrbitLayout,
  zoomOrbitAt,
  type OrbitLayout,
  type OrbitPoint,
  type OrbitTransform,
} from "@/src/lib/orbitClustering";
import { drawOrbitCanvas } from "@/src/lib/orbitCanvas";

interface OrbitGraphViewProps {
  memos: Memo[];
  onOpenMemo: (memo: Memo) => void;
  onHeaderVisibilityChange?: (isVisible: boolean) => void;
  onLinksAnalyzed: (links: GeminiMemoLink[], analyzedIds: string[]) => void;
}

interface GestureState {
  points: Map<number, OrbitPoint>;
  start: OrbitPoint | null;
  moved: boolean;
}

const midpoint = (a: OrbitPoint, b: OrbitPoint): OrbitPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: OrbitPoint, b: OrbitPoint): number => Math.hypot(a.x - b.x, a.y - b.y);
const formatOrbitDate = (iso: string): string =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));

export function OrbitGraphView({ memos, onOpenMemo, onHeaderVisibilityChange, onLinksAnalyzed }: OrbitGraphViewProps): React.JSX.Element {
  // 💡 [캔버스와 제스처 참조]
  // 프레임마다 바뀌는 좌표는 참조에 두고 선택 메모·안내 문구만 React 상태로 화면에 전달합니다.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<OrbitLayout>({ nodes: [], edges: [], iteration: 0 });
  const transformRef = useRef<OrbitTransform>({ x: 0, y: 0, scale: 1 });
  const gestureRef = useRef<GestureState>({ points: new Map(), start: null, moved: false });
  const redrawRef = useRef<() => void>(() => {});
  const fitRef = useRef<() => void>(() => {});
  const edgeRevealStartedAtRef = useRef<number | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const hoveredClusterIdRef = useRef<string | null>(null);
  const panFrameRef = useRef(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orbitQuery, setOrbitQuery] = useState("");
  const [discoveryMemoIds, setDiscoveryMemoIds] = useState<string[]>([]);
  const [analysisState, setAnalysisState] = useState("저장된 AI 연결을 표시합니다.");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [retry, setRetry] = useState(0);
  // 배지 변경은 물리 배치를 다시 시작하지 않도록 노드·연결 정보만 실행 기준으로 사용합니다.
  const layoutKey = JSON.stringify(memos.map(({
    id,
    links,
    tags,
    content,
    isPinned,
    createdAt,
  }) => ({ id, links, tags, content, isPinned, createdAt })));
  const discoveryMemos = discoveryMemoIds
    .map((id) => memos.find((memo) => memo.id === id))
    .filter((memo): memo is Memo => memo !== undefined);
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    memos.forEach((memo) => memo.tags.forEach((tag) => {
      const normalized = tag.trim();
      if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6);
  }, [memos]);
  const analysisKey = memos.map((memo) => `${memo.id}:${memo.updatedAt}`).join("|");
  const seedLayout = useEffectEvent(() => createOrbitLayout(memos));
  const analyze = useEffectEvent(async (signal: AbortSignal, force = false) => {
    if (memos.length < 2) return;
    if (!force && memos.every((memo) => memo.links !== undefined)) return;
    if (!navigator.onLine) {
      console.error("[Tag Orbit] AI 분석을 시작하지 못했습니다.", {
        category: "network",
        details: "브라우저가 오프라인 상태입니다.",
        memoCount: memos.length,
      });
      setAnalysisState("네트워크 통신 오류: 로컬 태그 성운을 표시합니다.");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisState("AI 의미 연결을 분석하고 있습니다…");
    try {
      const links = await requestMemoLinks(memos, signal);
      if (signal.aborted) return;
      edgeRevealStartedAtRef.current = performance.now();
      onLinksAnalyzed(links, memos.map((memo) => memo.id));
      setAnalysisState(links.length ? "AI 유사도에 따라 성운을 배치했습니다." : "로컬 태그와 작성일로 성운을 배치했습니다.");
    } catch (error) {
      if (signal.aborted) return;
      const category = getGeminiErrorLabel(error);
      const details = error instanceof GeminiApiError
        ? error.details
        : error instanceof Error
          ? error.message
          : String(error);
      console.error("[Tag Orbit] AI 연결 분석 실패", {
        category,
        details,
        memoCount: memos.length,
      });
      setAnalysisState(`${category}: 로컬 태그 성운을 표시합니다.`);
    } finally {
      if (!signal.aborted) setIsAnalyzing(false);
    }
  });

  // 💡 [취소 가능한 AI 분석]
  // 본문이 바뀌거나 화면을 떠나면 이전 분석을 취소하고 재연결 때 다시 시도합니다.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void analyze(controller.signal, retry > 0);
    }, 0);
    const online = (): void => setRetry((current) => current + 1);
    window.addEventListener("online", online);
    return () => { window.clearTimeout(timer); controller.abort(); window.removeEventListener("online", online); };
  }, [analysisKey, retry]);

  // 💡 [프레임별 물리 계산]
  // 노드 계산은 프레임마다 한 단계씩 진행하고 안정화 후에는 제스처나 크기 변경 때만 다시 그립니다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    layoutRef.current = seedLayout();
    let frame = 0;
    let dirty = true;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fit = (): void => {
      const nodes = layoutRef.current.nodes;
      if (!nodes.length) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const left = Math.min(...nodes.map((node) => node.x)) - 45;
      const right = Math.max(...nodes.map((node) => node.x)) + 45;
      const top = Math.min(...nodes.map((node) => node.y)) - 45;
      const bottom = Math.max(...nodes.map((node) => node.y)) + 45;
      const scale = Math.max(0.12, Math.min(1.8, (rect.width - 24) / (right - left), (rect.height - 24) / (bottom - top)));
      transformRef.current = { scale, x: -(left + right) / 2 * scale, y: -(top + bottom) / 2 * scale };
    };
    const tick = (): void => {
      frame = 0;
      if (layoutRef.current.iteration < 180 && layoutRef.current.nodes.length > 0) {
        layoutRef.current = stepOrbitLayout(layoutRef.current);
        dirty = true;
      }
      const edgeRevealProgress = edgeRevealStartedAtRef.current === null
        ? 1
        : Math.min(1, (performance.now() - edgeRevealStartedAtRef.current) / 650);
      if (edgeRevealProgress < 1) dirty = true;
      else edgeRevealStartedAtRef.current = null;
      if (dirty) {
        drawOrbitCanvas(
          canvas,
          layoutRef.current,
          transformRef.current,
          edgeRevealProgress,
          selectedIdRef.current ?? hoveredIdRef.current,
          hoveredClusterIdRef.current,
        );
        dirty = false;
      }
      const shouldPulse = !reduceMotion
        && layoutRef.current.nodes.some((node) => node.isPinned);
      if (
        (layoutRef.current.iteration < 180 && layoutRef.current.nodes.length > 0)
        || edgeRevealProgress < 1
        || shouldPulse
      ) frame = window.requestAnimationFrame(tick);
    };
    const redraw = (): void => { dirty = true; if (!frame) frame = window.requestAnimationFrame(tick); };
    redrawRef.current = redraw;
    fitRef.current = () => { fit(); redraw(); };
    fit(); redraw();
    const resize = (): void => {
      fit();
      redraw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement ?? canvas);
    window.addEventListener("resize", resize);
    const wheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const point = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
      transformRef.current = zoomOrbitAt(transformRef.current, point, point, event.deltaY > 0 ? 0.9 : 1.1);
      redraw();
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("wheel", wheel);
      redrawRef.current = () => {};
      fitRef.current = () => {};
    };
  }, [layoutKey]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    redrawRef.current();
  }, [selectedId]);

  useEffect(() => () => window.cancelAnimationFrame(panFrameRef.current), []);

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>): OrbitPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  };
  const findNodeAtPoint = (point: OrbitPoint): string | null => {
    const transform = transformRef.current;
    const nearest = [...layoutRef.current.nodes].sort((a, b) =>
      Math.hypot(a.x * transform.scale + transform.x - point.x, a.y * transform.scale + transform.y - point.y)
      - Math.hypot(b.x * transform.scale + transform.x - point.x, b.y * transform.scale + transform.y - point.y))[0];
    if (!nearest) return null;
    const nodeDistance = Math.hypot(
      nearest.x * transform.scale + transform.x - point.x,
      nearest.y * transform.scale + transform.y - point.y,
    );
    const hitRadius = Math.max(16, nearest.radius * transform.scale + 8);
    return nodeDistance <= hitRadius ? nearest.id : null;
  };
  const findClusterAtPoint = (point: OrbitPoint): string | null => {
    const transform = transformRef.current;
    const clusters = getOrbitClusterSummaries(layoutRef.current);
    const nearest = clusters
      .map((cluster) => ({
        cluster,
        distance: Math.hypot(
          cluster.x * transform.scale + transform.x - point.x,
          (cluster.y - cluster.radius * 0.35) * transform.scale + transform.y - point.y,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest) return null;
    const labelHitRadius = Math.max(28, Math.min(64, nearest.cluster.radius * transform.scale * 0.45));
    return nearest.distance <= labelHitRadius ? nearest.cluster.id : null;
  };
  // 한 손가락 탭은 미리보기로, 이동이나 두 손가락 사용은 확대·이동으로 분리합니다.
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const gesture = gestureRef.current;
    const point = pointFromEvent(event);
    if (!gesture.points.size) { gesture.start = point; gesture.moved = false; }
    gesture.points.set(event.pointerId, point);
    if (gesture.points.size > 1) gesture.moved = true;
  };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    const gesture = gestureRef.current;
    if (!gesture.points.has(event.pointerId)) {
      if (event.pointerType === "mouse") {
        const nextHoveredId = findNodeAtPoint(pointFromEvent(event));
        const nextHoveredClusterId = nextHoveredId
          ? layoutRef.current.nodes.find((node) => node.id === nextHoveredId)?.cluster ?? null
          : findClusterAtPoint(pointFromEvent(event));
        if (hoveredIdRef.current !== nextHoveredId) {
          hoveredIdRef.current = nextHoveredId;
          redrawRef.current();
        }
        if (hoveredClusterIdRef.current !== nextHoveredClusterId) {
          hoveredClusterIdRef.current = nextHoveredClusterId;
          redrawRef.current();
        }
      }
      return;
    }
    const previous = [...gesture.points.values()];
    const point = pointFromEvent(event);
    if (gesture.start && distance(gesture.start, point) > 6) gesture.moved = true;
    gesture.points.set(event.pointerId, point);
    const next = [...gesture.points.values()];
    if (previous.length >= 2) {
      transformRef.current = zoomOrbitAt(transformRef.current, midpoint(previous[0], previous[1]), midpoint(next[0], next[1]),
        distance(next[0], next[1]) / Math.max(1, distance(previous[0], previous[1])));
    } else if (gesture.moved) {
      transformRef.current = { ...transformRef.current, x: transformRef.current.x + point.x - previous[0].x, y: transformRef.current.y + point.y - previous[0].y };
    }
    redrawRef.current();
  };
  const pointerEnd = (event: PointerEvent<HTMLCanvasElement>, cancelled = false): void => {
    const gesture = gestureRef.current;
    if (!gesture.points.has(event.pointerId)) return;
    const point = pointFromEvent(event);
    if (!cancelled && !gesture.moved && gesture.points.size === 1 && gesture.start && distance(gesture.start, point) <= 6) {
      const nodeId = findNodeAtPoint(point);
      const clusterId = nodeId
        ? layoutRef.current.nodes.find((node) => node.id === nodeId)?.cluster ?? null
        : findClusterAtPoint(point);
      if (clusterId) openCluster(clusterId, nodeId);
      else {
        setSelectedId(null);
        setDiscoveryMemoIds([]);
      }
    }
    if (cancelled) gesture.moved = true;
    gesture.points.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const clearHoveredNode = (): void => {
    if (!hoveredIdRef.current && !hoveredClusterIdRef.current) return;
    hoveredIdRef.current = null;
    hoveredClusterIdRef.current = null;
    redrawRef.current();
  };

  // 💡 [성운 카메라 이동]
  // 검색·태그·클러스터 선택이 만든 목표 중심과 배율까지 현재 카메라 좌표를 360ms 동안 부드럽게 보간합니다.
  const animateCamera = (center: OrbitPoint, targetScale: number): void => {
    window.cancelAnimationFrame(panFrameRef.current);
    const start = transformRef.current;
    let startedAt: number | null = null;
    const target = {
      scale: targetScale,
      x: -center.x * targetScale,
      y: -center.y * targetScale,
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      transformRef.current = target;
      redrawRef.current();
      return;
    }
    const animate = (now: number): void => {
      startedAt ??= now;
      const progress = Math.min(1, (now - startedAt) / 360);
      const eased = 1 - Math.pow(1 - progress, 3);
      transformRef.current = {
        scale: start.scale + (target.scale - start.scale) * eased,
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
      };
      redrawRef.current();
      if (progress < 1) panFrameRef.current = window.requestAnimationFrame(animate);
    };
    panFrameRef.current = window.requestAnimationFrame(animate);
  };

  const focusMemoGroup = (memoIds: string[], targetScale = 1.2): void => {
    const idSet = new Set(memoIds);
    const nodes = layoutRef.current.nodes.filter((node) => idSet.has(node.id));
    if (!nodes.length) return;
    animateCamera({
      x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length,
      y: nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length,
    }, targetScale);
  };

  // 클러스터나 노드를 누르면 같은 성운의 메모 ID를 패널에 전달하고 선택한 별을 함께 강조합니다.
  const openCluster = (clusterId: string, selectedNodeId: string | null = null): void => {
    const memberIds = layoutRef.current.nodes
      .filter((node) => node.cluster === clusterId)
      .map((node) => node.id);
    setSelectedId(selectedNodeId);
    setDiscoveryMemoIds(memberIds);
    focusMemoGroup(memberIds, selectedNodeId ? 1.45 : 1.15);
  };

  const focusTag = (tag: string): void => {
    const normalizedTag = tag.toLowerCase();
    const memberIds = memos
      .filter((memo) => memo.tags.some((memoTag) => memoTag.trim().toLowerCase() === normalizedTag))
      .map((memo) => memo.id);
    setSelectedId(null);
    setDiscoveryMemoIds(memberIds);
    focusMemoGroup(memberIds, 1.15);
  };

  const searchOrbit = (): void => {
    const query = orbitQuery.trim().toLowerCase();
    if (!query) return;
    const matches = memos.filter((memo) =>
      memo.title.toLowerCase().includes(query)
      || memo.content.toLowerCase().includes(query)
      || memo.tags.some((tag) => tag.toLowerCase().includes(query)));
    if (matches.length === 0) {
      setSelectedId(null);
      setDiscoveryMemoIds([]);
      setAnalysisState(`“${orbitQuery.trim()}” 검색 결과가 없습니다.`);
      return;
    }
    setSelectedId(matches.length === 1 ? matches[0].id : null);
    setDiscoveryMemoIds(matches.map((memo) => memo.id));
    focusMemoGroup(matches.map((memo) => memo.id), matches.length === 1 ? 1.55 : 1.2);
  };

  return (
    <section
      className="flex h-[calc(100dvh-3.5rem)] min-h-80 flex-col text-[#f3f4f6] xl:h-full"
      aria-labelledby="orbit-graph-title"
    >
      <MainContentHeader
        id="orbit-graph-title"
        label="MEMO ORBIT"
        title="메모 성운 궤도"
        description="AI와 로컬 관계로 연결된 메모를 탐색합니다."
        onVisibilityChange={onHeaderVisibilityChange}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#182033_0%,#0b0e16_45%,#07090f_100%)] xl:rounded-2xl xl:border xl:border-[#2a2e3d]">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
          aria-label={`${memos.length}개 메모 성운. 상단 검색과 태그 칩 또는 성운의 별을 눌러 탐색할 수 있습니다.`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={(event) => pointerEnd(event)}
          onPointerCancel={(event) => pointerEnd(event, true)}
          onPointerLeave={clearHoveredNode}
          onLostPointerCapture={(event) => pointerEnd(event, true)}
        />

        <div className="absolute left-1/2 top-3 z-20 w-[min(92%,42rem)] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#121318]/72 p-2.5 shadow-[0_16px_45px_rgb(0_0_0/0.42)] backdrop-blur-xl">
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              searchOrbit();
            }}
          >
            <span aria-hidden="true" className="pl-1 text-sm">
              🔭
            </span>
            <input
              type="search"
              value={orbitQuery}
              onChange={(event) => setOrbitQuery(event.target.value)}
              placeholder="성운에서 제목, 내용, 태그 검색"
              className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-white outline-none placeholder:text-[#7f8798]"
            />
            <button
              type="submit"
              className="rounded-lg bg-[#e5a93c] px-3 py-1.5 text-xs font-bold text-[#121318]"
            >
              이동
            </button>
          </form>
          {topTags.length > 0 && (
            <div className="scrollbar-hidden mt-2 flex gap-1.5 overflow-x-auto border-t border-white/10 pt-2">
              {topTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => focusTag(tag)}
                  className="shrink-0 rounded-full border border-sky-300/20 bg-sky-300/8 px-2.5 py-1 text-xs text-sky-100 transition hover:border-sky-300/50 hover:bg-sky-300/15"
                >
                  #{tag} {count}
                </button>
              ))}
            </div>
          )}
        </div>

        {memos.length === 0 && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[#9ca3af]">
            표시할 메모가 없습니다.
          </p>
        )}

        {discoveryMemos.length === 0 && (
          <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#121318]/70 px-3 py-2 text-xs text-[#9ca3af] shadow-xl backdrop-blur-md sm:left-auto sm:w-auto">
            <p role="status" aria-live="polite" className="truncate">
              {analysisState}
            </p>
            <button
              type="button"
              onClick={() => setRetry((current) => current + 1)}
              disabled={isAnalyzing}
              className="flex shrink-0 items-center gap-2 text-[#ffc86b] disabled:cursor-wait disabled:opacity-60"
            >
              {isAnalyzing && (
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#ffc86b]/30 border-t-[#ffc86b] motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              {isAnalyzing ? "분석 중…" : "재시도"}
            </button>
          </div>
        )}

        <aside
          aria-label="성운 메모 탐색 패널"
          aria-hidden={discoveryMemos.length === 0}
          inert={discoveryMemos.length === 0}
          className={`absolute bottom-0 right-0 top-0 z-30 flex w-[min(88%,25rem)] flex-col border-l border-white/15 bg-[#11141d]/88 shadow-[-18px_0_55px_rgb(0_0_0/0.48)] backdrop-blur-2xl transition duration-300 ease-out ${discoveryMemos.length > 0 ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"}`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[#e5a93c]">
                DISCOVERY
              </p>
              <h3 className="mt-1 text-lg font-bold text-white">
                이 성운의 메모 {discoveryMemos.length}개
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setDiscoveryMemoIds([]);
              }}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#d1d5db]"
            >
              닫기
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {discoveryMemos.map((memo) => {
              const image = memo.imageUrl ?? memo.images?.[0]?.url;
              return (
                <button
                  key={memo.id}
                  type="button"
                  onClick={() => onOpenMemo(memo)}
                  className={`flex w-full gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-[#e5a93c]/50 hover:bg-white/8 ${memo.id === selectedId ? "border-[#e5a93c]/55 bg-[#e5a93c]/10" : "border-white/10 bg-white/5"}`}
                >
                  {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-white">
                      {memo.title}
                    </strong>
                    <time className="mt-1 block text-xs text-[#9ca3af]">
                      {formatOrbitDate(memo.createdAt)}
                    </time>
                    <span className="mt-2 block truncate text-xs text-[#ffc86b]">
                      {memo.tags.length > 0 ? memo.tags.map((tag) => `#${tag}`).join(" ") : "태그 없음"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}
