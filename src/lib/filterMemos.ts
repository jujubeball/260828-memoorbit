import type { Memo } from "@/types/memo";

// SearchFilterBar가 모은 조건과 Home이 계산한 AI 점수를 함께 받습니다. 값이 undefined인 조건은 적용하지 않습니다.
// 이 파일에는 React State나 이펙트가 없으며, Home의 filterOptions State가 함수의 입력으로 전달됩니다.
export interface MemoFilterOptions {
  keyword?: string;
  tags?: string[];
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

// 검색창·메모·태그를 같은 비교 규칙으로 맞춥니다. 양끝 공백과 대소문자 차이만 줄이며 띄어쓰기 전체를 제거하지는 않습니다.
const normalizeText = (value: string): string => value.trim().toLocaleLowerCase();

// 날짜 문자열을 비교 가능한 숫자로 바꿉니다. 잘못된 날짜는 가장 오래된 값으로 취급해 유효한 날짜 뒤로 정렬합니다.
const toSortableTime = (value: string): number => {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

// 날짜 입력의 연·월·일을 로컬 시간으로 구성하여 UTC 해석에 따른 하루 차이를 피합니다.
// 종료일은 23:59:59.999까지 포함하고, 2월 31일처럼 자동 보정되는 잘못된 날짜는 undefined로 돌려 해당 경계를 적용하지 않습니다.
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

// 오늘의 복사본에서 세 달을 뺍니다. 먼저 1일로 옮긴 뒤 대상 월의 마지막 날 안으로 일자를 제한해 월말 넘침을 막습니다.
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

// 기간 칩을 숫자 범위로 번역합니다. 이번 주는 월요일, 이번 달은 1일, 최근 3개월은 대응 날짜의 자정부터 현재 시각까지입니다.
// 직접 입력은 시작·종료 중 있는 쪽만 적용하며, 시작이 종료보다 늦으면 이후 교차 비교에서 결과가 비게 됩니다.
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

// 대표 이미지나 첨부 배열에 실제 URL이 있는지 검사합니다. 화면용 기본 커버는 메모 데이터에 없으므로 사진 포함으로 세지 않습니다.
const hasMemoImage = (memo: Memo): boolean =>
  Boolean(memo.imageUrl?.trim())
  || Boolean(memo.images?.some((image) => image.url.trim()));

// 리치 본문에 표 시작 태그가 있는지 검사합니다. richContent가 null 또는 undefined일 때만 일반 본문으로 대체합니다.
const hasMemoTable = (memo: Memo): boolean =>
  /<table(?:\s|>)/i.test(memo.richContent ?? memo.content);

// Home에서 메모 ID별로 계산한 AI 확장어 일치 점수를 읽습니다. 누락·무한대·NaN은 0으로 취급합니다.
const getSemanticScore = (
  memo: Memo,
  semanticScores: Record<string, number> | undefined,
): number => {
  const score = semanticScores?.[memo.id];
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
};

// 💡 [다차원 검색 필터]
// 화면에서 모은 검색 조건을 각 메모에 차례로 교차 적용한 뒤 새 배열로 반환하므로, 저장된 원본 메모 순서는 바뀌지 않습니다.
// API나 저장소에 접근하지 않습니다. 다만 기간 프리셋 계산은 호출 시점의 현재 날짜에 의존하므로 시간이 바뀌면 결과도 달라질 수 있습니다.
export const filterMemos = (
  memos: Memo[],
  options: MemoFilterOptions,
): Memo[] => {
  const keyword = normalizeText(options.keyword ?? "");
  // 선택 태그를 한 번 정리한 뒤 모든 메모 검사에서 재사용합니다. 빈 태그는 조건에서 제외합니다.
  const selectedTags = (options.tags ?? [])
    .map(normalizeText)
    .filter(Boolean);
  const dateBounds = getDateBounds(options, new Date());
  const hasSemanticScores = Object.keys(options.semanticScores ?? {}).length > 0;

  // 각 메모를 검색·태그·사진·표·고정·기간이라는 여섯 관문에 통과시킵니다. 한 조건이라도 불일치하면 제외합니다.
  const filteredMemos = memos.filter((memo) => {
    // 현재 구현은 HTML 태그를 제거하지 않고 richContent도 검색 문자열에 포함합니다. 검색 범위를 바꿀 때 이 지점을 확인합니다.
    const searchableText = normalizeText([
      memo.title,
      memo.content,
      memo.richContent ?? "",
      memo.tags.join(" "),
    ].join(" "));
    const matchesKeyword = !keyword || searchableText.includes(keyword);
    const semanticScore = getSemanticScore(memo, options.semanticScores);
    // AI 모드도 문자열 일치 결과를 유지합니다. AI 점수가 양수인 메모를 추가하며 다른 필터를 우회시키지는 않습니다.
    const matchesHybridSearch = options.isSemanticSearch
      ? (!keyword && !hasSemanticScores)
        || (matchesKeyword && Boolean(keyword))
        || semanticScore > 0
      : matchesKeyword;
    // 태그끼리는 OR 규칙입니다. 예를 들어 여행·독서를 고르면 둘 중 하나만 있어도 통과하고, 미선택이면 모두 통과합니다.
    const memoTags = new Set(memo.tags.map(normalizeText));
    const matchesTags = selectedTags.length === 0
      || selectedTags.some((tag) => memoTags.has(tag));
    // undefined는 조건 해제, true는 포함, false는 미포함입니다. false와 조건 해제를 같은 값으로 처리하면 안 됩니다.
    const matchesImage = options.hasImage === undefined
      || hasMemoImage(memo) === options.hasImage;
    const matchesTable = options.hasTable === undefined
      || hasMemoTable(memo) === options.hasTable;
    const matchesPinned = options.isPinned === undefined
      || memo.isPinned === options.isPinned;
    // 기간은 작성일 createdAt으로 검사합니다. 아래 결과 정렬의 수정일 updatedAt과 서로 다른 기준입니다.
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
  // 점수가 같으면 고정 메모 우선, 그다음 updatedAt 내림차순입니다. sort는 배열을 바꾸므로 복사본에만 적용합니다.
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
