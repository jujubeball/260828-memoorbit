import type { OrbitLayout, OrbitTransform } from "@/src/lib/orbitClustering";

// 💡 [성운 배경과 희소 연결선 그리기]
// 물리 계산이 만든 좌표를 받아 같은 그룹의 중심·궤도·메모를 그립니다. 내용과 React 상태는 변경하지 않습니다.
export const drawOrbitCanvas = (
  canvas: HTMLCanvasElement,
  layout: OrbitLayout,
  transform: OrbitTransform,
  edgeRevealProgress = 1,
  selectedId: string | null = null,
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
  const selectedIndex = selectedId === null
    ? -1
    : nodes.findIndex((node) => node.id === selectedId);
  const relatedNodeIndices = new Set<number>();
  if (selectedIndex >= 0) {
    edges.forEach((edge) => {
      if (edge.source === selectedIndex) relatedNodeIndices.add(edge.target);
      if (edge.target === selectedIndex) relatedNodeIndices.add(edge.source);
    });
  }
  const clusters = new Map<string, typeof nodes>();
  nodes.forEach((node) => clusters.set(node.cluster, [...(clusters.get(node.cluster) ?? []), node]));
  clusters.forEach((members) => {
    if (members.length < 2) return;
    const x = members.reduce((sum, node) => sum + node.x, 0) / members.length;
    const y = members.reduce((sum, node) => sum + node.y, 0) / members.length;
    const radius = Math.max(
      28,
      ...members.map((node) => Math.hypot(node.x - x, node.y - y) + node.radius + 12),
    );
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, "rgba(229,169,60,0.13)");
    glow.addColorStop(1, "rgba(229,169,60,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(229,169,60,0.2)";
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(x, y, radius, radius * 0.72, -0.3, 0, Math.PI * 2);
    context.stroke();
  });
  // 강한 선부터 노드당 최대 네 개만 보여 복잡한 거미줄 모양을 줄입니다.
  const degree = new Map<number, number>();
  [...edges].sort((a, b) => b.weight - a.weight).forEach((edge) => {
    if (
      (edge.weight < 0.75 && !edge.isFallback)
      || (degree.get(edge.source) ?? 0) >= 4
      || (degree.get(edge.target) ?? 0) >= 4
    ) return;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    const a = nodes[edge.source];
    const b = nodes[edge.target];
    const isSelectedEdge = selectedIndex < 0
      || edge.source === selectedIndex
      || edge.target === selectedIndex;
    const selectionOpacity = selectedIndex < 0 ? 1 : isSelectedEdge ? 1 : 0.12;
    const edgeOpacity = edge.weight * 0.65 * edgeRevealProgress * selectionOpacity;
    const gradient = context.createLinearGradient(a.x, a.y, b.x, b.y);
    gradient.addColorStop(0, `rgba(125,211,252,${edgeOpacity * 0.55})`);
    gradient.addColorStop(0.5, `rgba(229,169,60,${edgeOpacity})`);
    gradient.addColorStop(1, `rgba(56,189,248,${edgeOpacity * 0.65})`);
    context.strokeStyle = gradient;
    context.lineWidth = edge.weight * 1.8 + Math.min(3, edge.sharedTagCount) * 0.45;
    context.shadowColor = "#e5a93c";
    context.shadowBlur = (isSelectedEdge ? 10 : 5) * edgeRevealProgress;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.quadraticCurveTo((a.x + b.x) / 2 + 8, (a.y + b.y) / 2 - 12, b.x, b.y);
    context.stroke();
  });
  context.shadowBlur = 0;
  nodes.forEach((node, index) => {
    const isSelected = index === selectedIndex;
    const isRelated = relatedNodeIndices.has(index);
    const isDimmed = selectedIndex >= 0 && !isSelected && !isRelated;
    context.globalAlpha = isDimmed ? 0.28 : 1;
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
    context.shadowBlur = isSelected
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
  context.globalAlpha = 1;
  context.shadowBlur = 0;
};
