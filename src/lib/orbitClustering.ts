import type { Memo } from "@/types/memo";

export interface OrbitNode {
  id: string;
  title: string;
  tags: string[];
  cluster: string;
  radius: number;
  isPinned: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface OrbitEdge {
  source: number;
  target: number;
  weight: number;
  sharedTagCount: number;
  isFallback: boolean;
}

export interface OrbitLayout {
  nodes: OrbitNode[];
  edges: OrbitEdge[];
  iteration: number;
}

export interface OrbitClusterSummary {
  id: string;
  label: string;
  memberIds: string[];
  x: number;
  y: number;
  radius: number;
}

export interface OrbitTransform { x: number; y: number; scale: number }
export interface OrbitPoint { x: number; y: number }

// 클러스터 레이블과 클릭 영역이 같은 중심을 사용하도록 노드 좌표에서 대표 태그·범위를 한 번에 계산합니다.
export const getOrbitClusterSummaries = (layout: OrbitLayout): OrbitClusterSummary[] => {
  const groups = new Map<string, OrbitNode[]>();
  layout.nodes.forEach((node) => groups.set(node.cluster, [...(groups.get(node.cluster) ?? []), node]));
  return [...groups.entries()].map(([id, members]) => {
    const x = members.reduce((sum, node) => sum + node.x, 0) / members.length;
    const y = members.reduce((sum, node) => sum + node.y, 0) / members.length;
    const tagCounts = new Map<string, number>();
    members.forEach((node) => node.tags.forEach((tag) => {
      const normalized = tag.trim();
      if (normalized) tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
    }));
    const label = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
      ?? "기록";
    const radius = Math.max(
      28,
      ...members.map((node) => Math.hypot(node.x - x, node.y - y) + node.radius + 12),
    );
    return { id, label, memberIds: members.map((node) => node.id), x, y, radius };
  });
};

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
  // 유효한 AI 점수를 우선 모으고, 하나도 없을 때에만 아래의 화면용 로컬 관계를 사용합니다.
  ordered.forEach((memo, index) => memo.links?.forEach((link) => {
    const target = indices.get(link.targetId);
    if (target === undefined || target === index || !Number.isFinite(link.weight)
      || link.weight < 0 || link.weight > 1) return;
    const source = Math.min(index, target);
    const end = Math.max(index, target);
    const key = `${source}:${end}`;
    if ((pairs.get(key)?.weight ?? -1) < link.weight) {
      pairs.set(key, {
        source,
        target: end,
        weight: link.weight,
        sharedTagCount: 0,
        isFallback: false,
      });
    }
  }));

  // 💡 [로컬 태그 Fallback 간선]
  // 유효한 AI 간선이 전혀 없을 때만 같은 태그를 공유하는 메모 쌍을 화면용으로 연결하며 Memo.links 원본에는 기록하지 않습니다.
  if (pairs.size === 0) {
    for (let source = 0; source < ordered.length; source += 1) {
      const sourceTags = new Set(
        ordered[source].tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
      );
      if (sourceTags.size === 0) continue;
      for (let target = source + 1; target < ordered.length; target += 1) {
        const targetTags = new Set(
          ordered[target].tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
        );
        const sharedTagCount = [...targetTags].filter((tag) => sourceTags.has(tag)).length;
        if (sharedTagCount === 0) continue;
        pairs.set(`${source}:${target}`, {
          source,
          target,
          weight: Math.min(0.95, 0.75 + (sharedTagCount - 1) * 0.1),
          sharedTagCount,
          isFallback: true,
        });
      }
    }

    // 태그가 없는 메모는 작성 시각 차이가 가장 작은 이웃 하나와 미세 간선으로 연결해 화면 구석의 외딴 점이 되지 않게 합니다.
    ordered.forEach((memo, source) => {
      if (memo.tags.some((tag) => tag.trim())) return;
      const sourceTime = new Date(memo.createdAt).getTime();
      let nearestTarget = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      ordered.forEach((candidate, target) => {
        if (source === target) return;
        const candidateTime = new Date(candidate.createdAt).getTime();
        const timeDistance = Number.isFinite(sourceTime) && Number.isFinite(candidateTime)
          ? Math.abs(sourceTime - candidateTime)
          : Math.abs(source - target);
        if (timeDistance < nearestDistance) {
          nearestDistance = timeDistance;
          nearestTarget = target;
        }
      });
      if (nearestTarget < 0) return;
      const start = Math.min(source, nearestTarget);
      const end = Math.max(source, nearestTarget);
      const key = `${start}:${end}`;
      if (pairs.has(key)) return;
      pairs.set(key, {
        source: start,
        target: end,
        weight: 0.58,
        sharedTagCount: 0,
        isFallback: true,
      });
    });
  }
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
    nodes: ordered.map((memo, index) => {
      const contentLengthStep = memo.content.length >= 400
        ? 4
        : memo.content.length >= 120
          ? 2
          : 0;
      const radius = 7
        + contentLengthStep
        + (memo.isPinned ? 3 : 0)
        + Math.min(3, memo.tags.length);
      return {
        id: memo.id,
        title: memo.title,
        tags: [...memo.tags],
        cluster: ordered[root(index)].id,
        radius,
        isPinned: memo.isPinned,
        ...positions.get(index)!,
        vx: 0,
        vy: 0,
      };
    }),
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
      const firstRadius = Number.isFinite(nodes[i].radius) ? nodes[i].radius : 8;
      const secondRadius = Number.isFinite(nodes[j].radius) ? nodes[j].radius : 8;
      const collisionDistance = firstRadius + secondRadius + 8;
      const repulsion = Math.min(
        8,
        450 / (distance * distance) + Math.max(0, collisionDistance - distance) * 0.2,
      );
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
    const sourceRadius = Number.isFinite(nodes[source].radius) ? nodes[source].radius : 8;
    const targetRadius = Number.isFinite(nodes[target].radius) ? nodes[target].radius : 8;
    const nodeDistance = sourceRadius + targetRadius;
    const force = weight >= 0.5
      ? (distance - (nodeDistance + 16 + (1 - weight) * 130)) * weight * 0.025
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
