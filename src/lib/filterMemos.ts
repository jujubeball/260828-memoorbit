import type { Memo } from "@/types/memo";

export interface MemoFilterOptions {
  keyword?: string;
  tags?: string[];
  tagMatchMode?: "AND" | "OR";
  hasImage?: boolean;
  hasTable?: boolean;
  isPinned?: boolean;
  timePreset?: "all" | "week" | "month" | "3months" | "custom";
  customDateRange?: { start?: string; end?: string };
  isSemanticSearch?: boolean;
  semanticScores?: Record<string, number>;
}

interface DateBounds {
  start?: number;
  end?: number;
}

const normalizeText = (value: string): string => value.trim().toLocaleLowerCase();

const toSortableTime = (value: string): number => {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

const parseLocalDate = (value: string, endOfDay = false): number | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) return undefined;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(
    year,
    month,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month
    || date.getDate() !== day
  ) {
    return undefined;
  }

  return date.getTime();
};

const threeMonthsAgo = (now: Date): Date => {
  const result = new Date(now);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - 3);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
};

const getDateBounds = (options: MemoFilterOptions, now: Date): DateBounds => {
  const preset = options.timePreset ?? "all";

  if (preset === "all") return {};

  if (preset === "custom") {
    return {
      start: options.customDateRange?.start
        ? parseLocalDate(options.customDateRange.start)
        : undefined,
      end: options.customDateRange?.end
        ? parseLocalDate(options.customDateRange.end, true)
        : undefined,
    };
  }

  const start = new Date(now);

  if (preset === "week") {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  } else if (preset === "month") {
    start.setDate(1);
  } else {
    start.setTime(threeMonthsAgo(start).getTime());
  }

  start.setHours(0, 0, 0, 0);
  return { start: start.getTime(), end: now.getTime() };
};

const hasMemoImage = (memo: Memo): boolean =>
  Boolean(memo.imageUrl?.trim())
  || Boolean(memo.images?.some((image) => image.url.trim()));

const hasMemoTable = (memo: Memo): boolean =>
  /<table(?:\s|>)/i.test(memo.richContent ?? memo.content);

const getSemanticScore = (
  memo: Memo,
  semanticScores: Record<string, number> | undefined,
): number => {
  const score = semanticScores?.[memo.id];
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
};

// 💡 [다차원 검색 필터]
// 화면에서 모은 검색 조건을 각 메모에 차례로 교차 적용한 뒤 새 배열로 반환하므로, 저장된 원본 메모 순서는 바뀌지 않습니다.
export const filterMemos = (
  memos: Memo[],
  options: MemoFilterOptions,
): Memo[] => {
  const keyword = normalizeText(options.keyword ?? "");
  const selectedTags = (options.tags ?? [])
    .map(normalizeText)
    .filter(Boolean);
  const tagMatchMode = options.tagMatchMode ?? "AND";
  const dateBounds = getDateBounds(options, new Date());
  const hasSemanticScores = Object.keys(options.semanticScores ?? {}).length > 0;

  const filteredMemos = memos.filter((memo) => {
    const searchableText = normalizeText([
      memo.title,
      memo.content,
      memo.richContent ?? "",
      memo.tags.join(" "),
    ].join(" "));
    const matchesKeyword = !keyword || searchableText.includes(keyword);
    const semanticScore = getSemanticScore(memo, options.semanticScores);
    const matchesHybridSearch = options.isSemanticSearch
      ? (!keyword && !hasSemanticScores)
        || (matchesKeyword && Boolean(keyword))
        || semanticScore > 0
      : matchesKeyword;
    const memoTags = new Set(memo.tags.map(normalizeText));
    const matchesTags = selectedTags.length === 0
      || (tagMatchMode === "OR"
        ? selectedTags.some((tag) => memoTags.has(tag))
        : selectedTags.every((tag) => memoTags.has(tag)));
    const matchesImage = options.hasImage === undefined
      || hasMemoImage(memo) === options.hasImage;
    const matchesTable = options.hasTable === undefined
      || hasMemoTable(memo) === options.hasTable;
    const matchesPinned = options.isPinned === undefined
      || memo.isPinned === options.isPinned;
    const createdAt = toSortableTime(memo.createdAt);
    const matchesDate = (dateBounds.start === undefined || createdAt >= dateBounds.start)
      && (dateBounds.end === undefined || createdAt <= dateBounds.end);

    return matchesHybridSearch
      && matchesTags
      && matchesImage
      && matchesTable
      && matchesPinned
      && matchesDate;
  });

  // AI 검색에서는 점수가 높은 메모를 먼저 보여 주고, 일반 검색에서는 고정 여부와 최근 수정일을 우선합니다.
  return [...filteredMemos].sort((left, right) => {
    if (options.isSemanticSearch) {
      const scoreDifference = getSemanticScore(right, options.semanticScores)
        - getSemanticScore(left, options.semanticScores);

      if (scoreDifference !== 0) return scoreDifference;
    }

    return Number(right.isPinned) - Number(left.isPinned)
      || toSortableTime(right.updatedAt) - toSortableTime(left.updatedAt);
  });
};
