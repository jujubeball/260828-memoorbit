"use client";

import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from "react";
import type { Memo } from "@/types/memo";
import { MainContentHeader } from "@/src/components/MainContentHeader";
import { requestMemoLinks } from "@/src/lib/geminiClient";
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

export function OrbitGraphView({ memos, onOpenMemo, onHeaderVisibilityChange, onLinksAnalyzed }: OrbitGraphViewProps): React.JSX.Element {
  // 💡 [캔버스와 제스처 참조]
  // 프레임마다 바뀌는 좌표는 참조에 두고 선택 메모·안내 문구만 React 상태로 화면에 전달합니다.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<OrbitLayout>({ nodes: [], edges: [], iteration: 0 });
  const transformRef = useRef<OrbitTransform>({ x: 0, y: 0, scale: 1 });
  const gestureRef = useRef<GestureState>({ points: new Map(), start: null, moved: false });
  const redrawRef = useRef<() => void>(() => {});
  const fitRef = useRef<() => void>(() => {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState("저장된 AI 연결을 표시합니다.");
  const [retry, setRetry] = useState(0);
  const selectedMemo = memos.find((memo) => memo.id === selectedId);
  // 배지 변경은 물리 배치를 다시 시작하지 않도록 노드·연결 정보만 실행 기준으로 사용합니다.
  const layoutKey = JSON.stringify(memos.map(({ id, links }) => ({ id, links })));
  const analysisKey = memos.map((memo) => `${memo.id}:${memo.updatedAt}`).join("|");
  const seedLayout = useEffectEvent(() => createOrbitLayout(memos));
  const analyze = useEffectEvent(async (signal: AbortSignal) => {
    if (memos.length < 2 || memos.every((memo) => memo.links !== undefined)) return;
    if (!navigator.onLine) { setAnalysisState("오프라인: 저장된 AI 연결만 표시합니다."); return; }
    setAnalysisState("AI 의미 연결을 분석하고 있습니다…");
    try {
      const links = await requestMemoLinks(memos, signal);
      if (signal.aborted) return;
      onLinksAnalyzed(links, memos.map((memo) => memo.id));
      setAnalysisState(links.length ? "AI 유사도에 따라 성운을 배치했습니다." : "강한 AI 연결이 아직 없습니다. 개별 메모를 표시합니다.");
    } catch {
      if (!signal.aborted) setAnalysisState("AI 분석에 실패했습니다. 저장된 연결을 유지합니다.");
    }
  });

  // 💡 [취소 가능한 AI 분석]
  // 본문이 바뀌거나 화면을 떠나면 이전 분석을 취소하고 재연결 때 다시 시도합니다.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void analyze(controller.signal); }, 0);
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
    const fit = (): void => {
      const nodes = layoutRef.current.nodes;
      if (!nodes.length) return;
      const rect = canvas.getBoundingClientRect();
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
      if (dirty) { drawOrbitCanvas(canvas, layoutRef.current, transformRef.current); dirty = false; }
      if (layoutRef.current.iteration < 180 && layoutRef.current.nodes.length > 0) frame = window.requestAnimationFrame(tick);
    };
    const redraw = (): void => { dirty = true; if (!frame) frame = window.requestAnimationFrame(tick); };
    redrawRef.current = redraw;
    fitRef.current = () => { fit(); redraw(); };
    fit(); redraw();
    const observer = new ResizeObserver(() => { fit(); redraw(); });
    observer.observe(canvas);
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
      canvas.removeEventListener("wheel", wheel);
      redrawRef.current = () => {};
      fitRef.current = () => {};
    };
  }, [layoutKey]);

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>): OrbitPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
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
    if (!gesture.points.has(event.pointerId)) return;
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
      const transform = transformRef.current;
      const nearest = [...layoutRef.current.nodes].sort((a, b) =>
        Math.hypot(a.x * transform.scale + transform.x - point.x, a.y * transform.scale + transform.y - point.y)
        - Math.hypot(b.x * transform.scale + transform.x - point.x, b.y * transform.scale + transform.y - point.y))[0];
      const hit = nearest && Math.hypot(nearest.x * transform.scale + transform.x - point.x, nearest.y * transform.scale + transform.y - point.y) <= 22;
      setSelectedId(hit ? nearest.id : null);
    }
    if (cancelled) gesture.moved = true;
    gesture.points.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const zoom = (ratio: number): void => {
    transformRef.current = zoomOrbitAt(transformRef.current, { x: 0, y: 0 }, { x: 0, y: 0 }, ratio);
    redrawRef.current();
  };

  return (
    <section className="flex h-[calc(100dvh-7rem)] min-h-80 flex-col text-[#f3f4f6] xl:h-full" aria-labelledby="orbit-graph-title">
      <MainContentHeader
        id="orbit-graph-title" label="MEMO ORBIT" title="메모 성운 궤도"
        description="AI로 연결된 메모를 확대하고 눌러보세요." onVisibilityChange={onHeaderVisibilityChange}
      />
      <div className="flex flex-wrap items-center gap-2 py-2 text-xs">
        <button type="button" onClick={() => zoom(1.2)} className="rounded border border-[#2a2e3d] px-3 py-2" aria-label="궤도 확대">
          확대 +
        </button>
        <button type="button" onClick={() => zoom(0.8)} className="rounded border border-[#2a2e3d] px-3 py-2" aria-label="궤도 축소">
          축소 −
        </button>
        <button type="button" onClick={() => fitRef.current()} className="rounded border border-[#2a2e3d] px-3 py-2">
          전체 보기
        </button>
        <select aria-label="미리 볼 메모 선택" value={selectedMemo?.id ?? ""} onChange={(event) => setSelectedId(event.target.value || null)} className="min-w-0 max-w-48 rounded bg-[#1a1d26] p-2">
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
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#2a2e3d] bg-[#0f1117]">
        <canvas
          ref={canvasRef} className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
          aria-label={`${memos.length}개 메모 성운. 메모 선택 메뉴로도 탐색할 수 있습니다.`}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={(event) => pointerEnd(event)}
          onPointerCancel={(event) => pointerEnd(event, true)} onLostPointerCapture={(event) => pointerEnd(event, true)}
        />
        {memos.length === 0 && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[#9ca3af]">
            표시할 메모가 없습니다.
          </p>
        )}
        {selectedMemo && (
          <aside aria-label="메모 미리보기" className="absolute inset-x-3 bottom-3 max-h-[60%] overflow-y-auto overscroll-contain rounded-xl border border-[#e5a93c] bg-[#121318] p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <strong className="truncate">
                {selectedMemo.title}
              </strong>
              <button type="button" onClick={() => setSelectedId(null)} className="shrink-0 p-2 text-sm">
                닫기
              </button>
            </div>
            <p className="mt-2 line-clamp-3 text-sm text-[#9ca3af]">
              {selectedMemo.content}
            </p>
            <button type="button" onClick={() => onOpenMemo(selectedMemo)} className="mt-3 rounded-lg bg-[#e5a93c] px-3 py-2 text-sm font-semibold text-[#121318]">
              메모 열기
            </button>
          </aside>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 py-2 text-xs text-[#9ca3af]">
        <p role="status">
          {analysisState}
        </p>
        <button type="button" onClick={() => setRetry((current) => current + 1)} className="shrink-0 p-2 text-[#ffc86b]">
          분석 재시도
        </button>
      </div>
      <p className="pb-2 text-xs text-[#9ca3af]">
        두 손가락으로 확대·이동 · 메모를 누르면 미리보기
      </p>
    </section>
  );
}
