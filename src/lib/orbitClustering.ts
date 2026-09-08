import type { Memo } from "@/types/memo";

export interface OrbitNode {
  id: string;
  cluster: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface OrbitEdge {
  source: number;
  target: number;
  weight: number;
}

export interface OrbitLayout {
  nodes: OrbitNode[];
  edges: OrbitEdge[];
  iteration: number;
}

export interface OrbitTransform { x: number; y: number; scale: number }
export interface OrbitPoint { x: number; y: number }

// 💡 [확대 중심 보존]
// 두 손가락 중점 아래 있던 메모가 확대 후에도 같은 손가락 위치에 오도록 이동량을 함께 계산합니다.
export const zoomOrbitAt = (
  transform: OrbitTransform, previous: OrbitPoint, next: OrbitPoint, ratio: number,
): OrbitTransform => {
  const scale = Math.max(0.12, Math.min(4, transform.scale * ratio));
  const factor = scale / transform.scale;
  return { scale, x: next.x - (previous.x - transform.x) * factor, y: next.y - (previous.y - transform.y) * factor };
};

// 메모를 ID 순서로 정렬해 동일 입력은 항상 동일한 초기 위치와 클러스터를 만들도록 합니다.
export const createOrbitLayout = (memos: Memo[]): OrbitLayout => {
  const ordered = [...memos].sort((a, b) => a.id.localeCompare(b.id));
  const indices = new Map(ordered.map((memo, index) => [memo.id, index]));
  const parents = ordered.map((_, index) => index);
  const root = (index: number): number => {
    while (parents[index] !== index) index = parents[index];
    return index;
  };
  const pairs = new Map<string, OrbitEdge>();
  // 저장된 AI 점수만 사용하며 미분석 쌍에 가짜 유사도를 채우지 않습니다.
  ordered.forEach((memo, index) => memo.links?.forEach((link) => {
    const target = indices.get(link.targetId);
    if (target === undefined || target === index || !Number.isFinite(link.weight)
      || link.weight < 0 || link.weight > 1) return;
    const source = Math.min(index, target);
    const end = Math.max(index, target);
    const key = `${source}:${end}`;
    if ((pairs.get(key)?.weight ?? -1) < link.weight) pairs.set(key, { source, target: end, weight: link.weight });
  }));
  const edges = [...pairs.values()];
  edges.forEach((edge) => {
    if (edge.weight >= 0.75) parents[root(edge.target)] = root(edge.source);
  });
  const groups = new Map<number, number[]>();
  ordered.forEach((_, index) => {
    const key = root(index);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  const positions = new Map<number, OrbitPoint>();
  // 그룹 안의 메모 수만큼 궤도 지름을 확보해 서로 다른 성운이 초기부터 겹치지 않게 합니다.
  const spacing = Math.max(110, ...[...groups.values()].map((members) => Math.sqrt(members.length) * 60));
  [...groups.values()].forEach((members, groupIndex) => {
    const angle = groupIndex * 2.3999632297;
    const distance = Math.sqrt(groupIndex) * spacing;
    members.forEach((index, localIndex) => {
      const localAngle = localIndex * 2.3999632297;
      const radius = Math.sqrt(localIndex) * 28;
      positions.set(index, { x: Math.cos(angle) * distance + Math.cos(localAngle) * radius,
        y: Math.sin(angle) * distance + Math.sin(localAngle) * radius });
    });
  });
  return {
    iteration: 0, edges,
    nodes: ordered.map((memo, index) => ({
      id: memo.id, cluster: ordered[root(index)].id, ...positions.get(index)!, vx: 0, vy: 0,
    })),
  };
};

// 💡 [중력 배치 한 단계]
// 가까운 노드는 충돌을 피하고 높은 유사도는 짧은 스프링처럼 당깁니다. 입력 배열은 복사해 React 원본을 보호합니다.
export const stepOrbitLayout = (layout: OrbitLayout): OrbitLayout => {
  const nodes = layout.nodes.map((node) => ({ ...node }));
  const forces = nodes.map(() => ({ x: 0, y: 0 }));
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      let dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      if (dx === 0 && dy === 0) dx = 0.1;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const repulsion = Math.min(8, 450 / (distance * distance) + Math.max(0, 26 - distance) * 0.2);
      const fx = dx / distance * repulsion;
      const fy = dy / distance * repulsion;
      forces[i].x -= fx; forces[i].y -= fy;
      forces[j].x += fx; forces[j].y += fy;
    }
  }
  layout.edges.forEach(({ source, target, weight }) => {
    const dx = nodes[target].x - nodes[source].x;
    const dy = nodes[target].y - nodes[source].y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const force = weight >= 0.5
      ? (distance - (32 + (1 - weight) * 130)) * weight * 0.025
      : -(1 - weight) * Math.min(3, 120 / distance);
    const fx = dx / distance * force;
    const fy = dy / distance * force;
    forces[source].x += fx; forces[source].y += fy;
    forces[target].x -= fx; forces[target].y -= fy;
  });
  const cooling = Math.max(0.15, 1 - layout.iteration / 200);
  nodes.forEach((node, index) => {
    node.vx = (node.vx + forces[index].x - node.x * 0.0005) * 0.72;
    node.vy = (node.vy + forces[index].y - node.y * 0.0005) * 0.72;
    node.x += Math.max(-8, Math.min(8, node.vx)) * cooling;
    node.y += Math.max(-8, Math.min(8, node.vy)) * cooling;
  });
  return { ...layout, nodes, iteration: layout.iteration + 1 };
};
