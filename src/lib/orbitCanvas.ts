import {
  getOrbitClusterSummaries,
  type OrbitLayout,
  type OrbitTransform,
} from "@/src/lib/orbitClustering";

interface LabelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// 💡 [성운 정보 재사용]
// 물리 좌표가 바뀔 때만 중심을 계산하고 간선 배열이 바뀔 때만 정렬해 호버 중 반복 작업을 줄입니다.
const clusterCache = new WeakMap<OrbitLayout, ReturnType<typeof getOrbitClusterSummaries>>();
const edgeCache = new WeakMap<OrbitLayout["edges"], OrbitLayout["edges"]>();

// 💡 [성운 배경과 희소 연결선 그리기]
// 물리 계산이 만든 좌표를 받아 같은 그룹의 중심·궤도·메모를 그립니다. 내용과 React 상태는 변경하지 않습니다.
export const drawOrbitCanvas = (
  canvas: HTMLCanvasElement,
  layout: OrbitLayout,
  transform: OrbitTransform,
  edgeRevealProgress = 1,
  selectedId: string | null = null,
  focusedClusterId: string | null = null,
  hoveredId: string | null = null,
  focusProgress = 1,
): void => {
  const context = canvas.getContext("2d");
  if (!context) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) {
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  context.translate(rect.width / 2 + transform.x, rect.height / 2 + transform.y);
  context.scale(transform.scale, transform.scale);
  const { nodes, edges } = layout;
  const selectedIndex = nodes.findIndex((node) => node.id === selectedId);
  const hoveredIndex = nodes.findIndex((node) => node.id === hoveredId);
  const hasFocus = selectedIndex >= 0 || hoveredIndex >= 0;
  const isFocusIndex = (index: number): boolean => index === selectedIndex || index === hoveredIndex;
  const relatedNodeIndices = new Set<number>();
  if (hasFocus) {
    for (const edge of edges) {
      if (isFocusIndex(edge.source)) relatedNodeIndices.add(edge.target);
      if (isFocusIndex(edge.target)) relatedNodeIndices.add(edge.source);
    }
  }
  let clusters = clusterCache.get(layout);
  if (!clusters) {
    clusters = getOrbitClusterSummaries(layout);
    clusterCache.set(layout, clusters);
  }
  context.globalAlpha = hasFocus ? 0.15 : 1;
  clusters.forEach((cluster) => {
    const isFocusedCluster = cluster.id === focusedClusterId;
    const glow = context.createRadialGradient(
      cluster.x,
      cluster.y,
      0,
      cluster.x,
      cluster.y,
      cluster.radius,
    );
    glow.addColorStop(0, isFocusedCluster ? "rgba(125,211,252,0.24)" : "rgba(229,169,60,0.13)");
    glow.addColorStop(1, "rgba(229,169,60,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cluster.x, cluster.y, cluster.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = isFocusedCluster ? "rgba(125,211,252,0.55)" : "rgba(229,169,60,0.2)";
    context.lineWidth = isFocusedCluster ? 1.8 : 1;
    context.shadowColor = isFocusedCluster ? "#7dd3fc" : "transparent";
    context.shadowBlur = isFocusedCluster ? 18 : 0;
    context.beginPath();
    context.ellipse(
      cluster.x,
      cluster.y,
      cluster.radius,
      cluster.radius * 0.72,
      -0.3,
      0,
      Math.PI * 2,
    );
    context.stroke();
  });
  // 강한 선부터 노드당 최대 네 개만 보여 복잡한 거미줄 모양을 줄입니다.
  context.globalAlpha = 1;
  const degree = new Map<number, number>();
  let sortedEdges = edgeCache.get(edges);
  if (!sortedEdges) {
    sortedEdges = [...edges].sort((a, b) => b.weight - a.weight);
    edgeCache.set(edges, sortedEdges);
  }
  sortedEdges.forEach((edge) => {
    const isSelectedEdge = hasFocus && (isFocusIndex(edge.source) || isFocusIndex(edge.target));
    if (!isSelectedEdge && (
      (edge.weight < 0.75 && !edge.isFallback)
      || (degree.get(edge.source) ?? 0) >= 4
      || (degree.get(edge.target) ?? 0) >= 4
    )) return;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    const a = nodes[edge.source];
    const b = nodes[edge.target];
    const selectionOpacity = hasFocus && !isSelectedEdge ? 0.15 : 1;
    const isHighlightedEdge = isSelectedEdge;
    const edgeOpacity = edge.weight * 0.65 * edgeRevealProgress * selectionOpacity;
    const gradient = context.createLinearGradient(a.x, a.y, b.x, b.y);
    gradient.addColorStop(0, `rgba(125,211,252,${edgeOpacity * 0.55})`);
    gradient.addColorStop(0.5, `rgba(229,169,60,${edgeOpacity})`);
    gradient.addColorStop(1, `rgba(56,189,248,${edgeOpacity * 0.65})`);
    context.strokeStyle = gradient;
    context.lineWidth = edge.weight * 1.8 + Math.min(3, edge.sharedTagCount) * 0.45;
    context.shadowColor = "#e5a93c";
    context.shadowBlur = (isHighlightedEdge ? 16 : 0) * edgeRevealProgress;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.quadraticCurveTo((a.x + b.x) / 2 + 8, (a.y + b.y) / 2 - 12, b.x, b.y);
    context.stroke();
  });
  context.shadowBlur = 0;
  nodes.forEach((node, index) => {
    const isSelected = isFocusIndex(index);
    const isRelated = relatedNodeIndices.has(index);
    const isDimmed = hasFocus && !isSelected && !isRelated;
    context.globalAlpha = isDimmed ? 0.15 : 1;
    const baseRadius = Number.isFinite(node.radius) ? node.radius : 8;
    const pulse = node.isPinned
      ? (Math.sin(performance.now() / 360) + 1) * 1.2
      : 0;
    const displayRadius = baseRadius + pulse;
    const nodeGlow = context.createRadialGradient(
      node.x - displayRadius * 0.25,
      node.y - displayRadius * 0.3,
      1,
      node.x,
      node.y,
      displayRadius,
    );
    nodeGlow.addColorStop(0, isSelected ? "#fff3c4" : "#ffc86b");
    nodeGlow.addColorStop(0.55, isRelated ? "#e5a93c" : "#c88923");
    nodeGlow.addColorStop(1, "#6d4410");
    context.shadowColor = isSelected || isRelated ? "#ffc86b" : "#e5a93c";
    context.shadowBlur = isDimmed ? 0 : isSelected
      ? 22
      : node.isPinned
        ? 18 + pulse * 2
        : isRelated
          ? 14
          : 7;
    context.beginPath();
    context.arc(node.x, node.y, displayRadius, 0, Math.PI * 2);
    context.fillStyle = nodeGlow;
    context.fill();
    context.strokeStyle = isSelected ? "#fff3c4" : "#ffc86b";
    context.lineWidth = isSelected ? 2.5 : isRelated ? 1.8 : 1;
    context.stroke();

  });

  // 💡 [서치라이트 제목 충돌 검사]
  // 선택·호버 제목부터 자리를 예약한 뒤 직접 연결된 이웃을 배치합니다. 다른 제목이나 원형 노드와 겹치는 제목은 숨깁니다.
  const labelBoxes: LabelBox[] = [];
  const drawLabel = (index: number): void => {
    const node = nodes[index];
    if (!node) return;
    const fontSize = 12 / transform.scale;
    const gap = 7 / transform.scale;
    const title = node.title.length > 18 ? `${node.title.slice(0, 18)}…` : node.title;
    context.font = `${fontSize}px sans-serif`;
    const width = context.measureText(title).width;
    const padding = 3 / transform.scale;
    const box = {
      left: node.x + node.radius + gap,
      right: node.x + node.radius + gap + width + padding,
      top: node.y - fontSize / 2 - padding,
      bottom: node.y + fontSize / 2 + padding,
    };
    if (labelBoxes.some((other) => box.left < other.right && box.right > other.left
      && box.top < other.bottom && box.bottom > other.top)) return;
    if (nodes.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      const dx = other.x - Math.max(box.left, Math.min(other.x, box.right));
      const dy = other.y - Math.max(box.top, Math.min(other.y, box.bottom));
      return dx * dx + dy * dy < (other.radius + padding) ** 2;
    })) return;
    labelBoxes.push(box);
    context.globalAlpha = focusProgress;
    context.shadowBlur = 5;
    context.shadowColor = "#07090f";
    context.fillStyle = "#e5e7eb";
    context.textAlign = "start";
    context.textBaseline = "middle";
    context.fillText(title, box.left, node.y);
  };
  if (hasFocus) {
    drawLabel(selectedIndex);
    if (hoveredIndex !== selectedIndex) drawLabel(hoveredIndex);
    relatedNodeIndices.forEach((index) => {
      if (!isFocusIndex(index)) drawLabel(index);
    });
  }

  if (!hasFocus && transform.scale < 1.35) {
    clusters.forEach((cluster) => {
      const isFocused = cluster.id === focusedClusterId;
      const fontSize = (isFocused ? 15 : 13) / transform.scale;
      context.globalAlpha = isFocused ? 1 : 0.82;
      context.font = `700 ${fontSize}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = isFocused ? "#bae6fd" : "#fcd38d";
      context.shadowColor = isFocused ? "#38bdf8" : "#e5a93c";
      context.shadowBlur = isFocused ? 14 : 9;
      context.fillText(
        `#${cluster.label} (${cluster.memberIds.length})`,
        cluster.x,
        cluster.y - cluster.radius * 0.35,
      );
    });
  }
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.textAlign = "start";
};
