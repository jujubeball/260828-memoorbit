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
import { createOrbitLayout, stepOrbitLayout, zoomOrbitAt, type OrbitLayout, type OrbitPoint, type OrbitTransform } from "@/src/lib/orbitClustering";
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
  const panFrameRef = useRef(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const selectedMemo = memos.find((memo) => memo.id === selectedId);
  const connectedMemoIds = useMemo(() => {
    const connectedIds = new Set<string>();
    if (!selectedId) return connectedIds;
    const layout = createOrbitLayout(memos);
    const selectedIndex = layout.nodes.findIndex((node) => node.id === selectedId);
    layout.edges.forEach((edge) => {
      if (edge.source === selectedIndex) connectedIds.add(layout.nodes[edge.target].id);
      if (edge.target === selectedIndex) connectedIds.add(layout.nodes[edge.source].id);
    });
    return connectedIds;
  }, [memos, selectedId]);
  const connectedMemos = memos.filter((memo) => connectedMemoIds.has(memo.id));
  const previewImage = selectedMemo?.imageUrl ?? selectedMemo?.images?.[0]?.url;
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
      setAnalysisState("네트워크 통신 오류: 저장된 연결을 유지합니다.");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisState("AI 의미 연결을 분석하고 있습니다…");
    try {
      const links = await requestMemoLinks(memos, signal);
      if (signal.aborted) return;
      edgeRevealStartedAtRef.current = performance.now();
      onLinksAnalyzed(links, memos.map((memo) => memo.id));
      setAnalysisState(links.length ? "AI 유사도에 따라 성운을 배치했습니다." : "강한 AI 연결이 아직 없습니다. 개별 메모를 표시합니다.");
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
      setAnalysisState(`${category}: 저장된 연결을 유지합니다.`);
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
        if (hoveredIdRef.current !== nextHoveredId) {
          hoveredIdRef.current = nextHoveredId;
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
      setSelectedId(findNodeAtPoint(point));
    }
    if (cancelled) gesture.moved = true;
    gesture.points.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const zoom = (ratio: number): void => {
    transformRef.current = zoomOrbitAt(transformRef.current, { x: 0, y: 0 }, { x: 0, y: 0 }, ratio);
    redrawRef.current();
  };

  const clearHoveredNode = (): void => {
    if (!hoveredIdRef.current) return;
    hoveredIdRef.current = null;
    redrawRef.current();
  };

  // 💡 [연결 메모로 부드럽게 이동]
  // 프리뷰의 연결 칩을 누르면 목표 노드가 중앙에 오도록 현재 좌표와 목표 좌표를 360ms 동안 보간합니다.
  const focusNode = (id: string): void => {
    const node = layoutRef.current.nodes.find((item) => item.id === id);
    if (!node) return;
    window.cancelAnimationFrame(panFrameRef.current);
    const startedAt = performance.now();
    const start = transformRef.current;
    const targetScale = Math.max(1.25, Math.min(2, start.scale));
    const target = {
      scale: targetScale,
      x: -node.x * targetScale,
      y: -node.y * targetScale,
    };
    setSelectedId(id);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      transformRef.current = target;
      redrawRef.current();
      return;
    }
    const animate = (now: number): void => {
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
          aria-label={`${memos.length}개 메모 성운. 메모 선택 메뉴로도 탐색할 수 있습니다.`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={(event) => pointerEnd(event)}
          onPointerCancel={(event) => pointerEnd(event, true)}
          onPointerLeave={clearHoveredNode}
          onLostPointerCapture={(event) => pointerEnd(event, true)}
        />

        <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => zoom(1.2)}
            className="rounded-lg border border-white/10 bg-[#121318]/75 px-3 py-2 text-[#ffc86b] shadow-lg backdrop-blur-md"
            aria-label="궤도 확대"
          >
            확대 +
          </button>
          <button
            type="button"
            onClick={() => zoom(0.8)}
            className="rounded-lg border border-white/10 bg-[#121318]/75 px-3 py-2 text-[#ffc86b] shadow-lg backdrop-blur-md"
            aria-label="궤도 축소"
          >
            축소 −
          </button>
          <button
            type="button"
            onClick={() => fitRef.current()}
            className="rounded-lg border border-white/10 bg-[#121318]/75 px-3 py-2 text-[#d1d5db] shadow-lg backdrop-blur-md"
          >
            전체 보기
          </button>
          <select
            aria-label="미리 볼 메모 선택"
            value={selectedMemo?.id ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              if (id) focusNode(id);
              else setSelectedId(null);
            }}
            className="min-w-0 max-w-44 rounded-lg border border-white/10 bg-[#121318]/80 p-2 text-[#d1d5db] shadow-lg backdrop-blur-md"
          >
            <option value="">
              메모 선택 ({memos.length}개)
            </option>
            {memos.map((memo) => (
              <option key={memo.id} value={memo.id}>
                {memo.title}
              </option>
            ))}
          </select>
        </div>

        {memos.length === 0 && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[#9ca3af]">
            표시할 메모가 없습니다.
          </p>
        )}

        {!selectedMemo && (
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

        {selectedMemo && (
          <aside
            aria-label="메모 미리보기"
            className="absolute inset-x-3 bottom-3 z-20 max-h-[68%] overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-[#121318]/82 p-4 shadow-[0_20px_60px_rgb(0_0_0/0.55)] backdrop-blur-xl sm:left-auto sm:right-4 sm:w-96"
          >
            {previewImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImage}
                alt=""
                className="mb-3 max-h-40 w-full rounded-xl object-cover"
              />
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block truncate text-base text-white">
                  {selectedMemo.title}
                </strong>
                <time className="mt-1 block text-xs text-[#9ca3af]">
                  {formatOrbitDate(selectedMemo.createdAt)}
                </time>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#d1d5db]"
              >
                닫기
              </button>
            </div>
            {selectedMemo.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedMemo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#e5a93c]/35 bg-[#e5a93c]/10 px-2.5 py-1 text-xs text-[#ffc86b]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 line-clamp-4 text-sm leading-6 text-[#d1d5db]">
              {selectedMemo.content || "추가 본문이 없습니다."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextMemo = connectedMemos[0];
                  if (nextMemo) focusNode(nextMemo.id);
                }}
                disabled={connectedMemos.length === 0}
                className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-200 disabled:opacity-40"
              >
                연결된 메모 ({connectedMemos.length}개)
              </button>
              <button
                type="button"
                onClick={() => onOpenMemo(selectedMemo)}
                className="rounded-lg bg-[#e5a93c] px-3 py-2 text-sm font-semibold text-[#121318]"
              >
                메모 열기
              </button>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
