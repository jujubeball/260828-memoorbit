import type { Memo } from "@/types/memo";

export interface MemoDateGroup {
  title: string;
  memos: Memo[];
}

const GROUP_TITLES = [
  "오늘",
  "어제",
  "지난 7일",
  "이전 30일",
  "이전 기록",
] as const;

type MemoDateGroupTitle = (typeof GROUP_TITLES)[number];

const toLocalDayNumber = (date: Date): number =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;

// 💡 [날짜별 메모 그룹핑]
// 메모가 만들어진 createdAt을 오늘과 비교해 시간 바구니에 나누며, 화면은 이 결과를 받아 비어 있지 않은 섹션만 순서대로 그립니다.
export function groupMemosByDate(memos: Memo[]): MemoDateGroup[] {
  const todayNumber = toLocalDayNumber(new Date());
  const groups: Record<MemoDateGroupTitle, Memo[]> = {
    오늘: [],
    어제: [],
    "지난 7일": [],
    "이전 30일": [],
    "이전 기록": [],
  };

  memos.forEach((memo) => {
    const createdAt = new Date(memo.createdAt);
    const differenceInDays = Number.isNaN(createdAt.getTime())
      ? Number.POSITIVE_INFINITY
      : todayNumber - toLocalDayNumber(createdAt);
    let groupTitle: MemoDateGroupTitle = "이전 기록";

    if (differenceInDays <= 0) {
      groupTitle = "오늘";
    } else if (differenceInDays === 1) {
      groupTitle = "어제";
    } else if (differenceInDays <= 7) {
      groupTitle = "지난 7일";
    } else if (differenceInDays <= 30) {
      groupTitle = "이전 30일";
    }

    groups[groupTitle].push(memo);
  });

  return GROUP_TITLES.map((title) => ({
    title,
    memos: [...groups[title]].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
  })).filter((group) => group.memos.length > 0);
}
