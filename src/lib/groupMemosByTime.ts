import type { Memo } from "@/types/memo";

export interface TimeGroupedMemos {
  today: Memo[];
  yesterday: Memo[];
  last7Days: Memo[];
  last30Days: Memo[];
  older: Memo[];
}

const MILLISECONDS_PER_DAY = 86_400_000;

// 현지 시각의 연·월·일만 UTC 일련번호로 바꿔 일광 절약 시간 변경일에도 날짜 차이를 정확히 계산합니다.
const toLocalDayNumber = (date: Date): number =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  / MILLISECONDS_PER_DAY;

const toSortableTime = (memo: Memo): number => {
  const timestamp = new Date(memo.createdAt).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

// 💡 [시간 구간별 메모 그룹핑]
// 호출 시점의 오늘 자정과 각 메모의 생성일을 비교해 다섯 바구니로 나누고, 입력 배열은 건드리지 않은 채 각 바구니만 최신순으로 정렬합니다.
export const groupMemosByTime = (memos: Memo[]): TimeGroupedMemos => {
  const todayNumber = toLocalDayNumber(new Date());
  const groups: TimeGroupedMemos = {
    today: [],
    yesterday: [],
    last7Days: [],
    last30Days: [],
    older: [],
  };

  memos.forEach((memo) => {
    const createdAt = new Date(memo.createdAt);
    const differenceInDays = Number.isNaN(createdAt.getTime())
      ? Number.POSITIVE_INFINITY
      : todayNumber - toLocalDayNumber(createdAt);

    if (differenceInDays <= 0) {
      groups.today.push(memo);
    } else if (differenceInDays === 1) {
      groups.yesterday.push(memo);
    } else if (differenceInDays <= 7) {
      groups.last7Days.push(memo);
    } else if (differenceInDays <= 30) {
      groups.last30Days.push(memo);
    } else {
      groups.older.push(memo);
    }
  });

  const newestFirst = (left: Memo, right: Memo): number =>
    toSortableTime(right) - toSortableTime(left);

  return {
    today: [...groups.today].sort(newestFirst),
    yesterday: [...groups.yesterday].sort(newestFirst),
    last7Days: [...groups.last7Days].sort(newestFirst),
    last30Days: [...groups.last30Days].sort(newestFirst),
    older: [...groups.older].sort(newestFirst),
  };
};
