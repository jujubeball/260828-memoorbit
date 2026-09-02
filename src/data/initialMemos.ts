import type { ImageMood, Memo } from "@/types/memo";

interface TagDistribution {
  tag: string;
  count: number;
  subject: string;
  mood: ImageMood;
  imagePath: string;
  imageMemoCount: number;
}

// 💡 [태그 분포 설계]
// #개발 70개 | #기록 44개 | #일상 30개 | #육아 20개 | #여행 12개 | #요리 6개 | #독서 4개
// 위 필수 태그의 합은 186개이므로, 정확히 200개를 만들기 위해 #음악 6개·#운동 4개·#영화 4개를 작은 검증용 위성으로 더합니다.
const TAG_DISTRIBUTIONS: TagDistribution[] = [
  { tag: "개발", count: 70, subject: "프론트엔드 구조와 사용자 경험", mood: "네온", imagePath: "/memo-images/development.png", imageMemoCount: 70 },
  { tag: "기록", count: 44, subject: "생각과 결정의 배경", mood: "빈티지", imagePath: "/memo-images/journal.png", imageMemoCount: 44 },
  { tag: "일상", count: 30, subject: "평범한 하루에서 발견한 변화", mood: "수채화", imagePath: "/memo-images/daily-life.png", imageMemoCount: 30 },
  { tag: "육아", count: 20, subject: "아이와 함께 배우고 웃었던 순간", mood: "수채화", imagePath: "/memo-images/parenting.png", imageMemoCount: 20 },
  { tag: "여행", count: 12, subject: "낯선 장소에서 마주한 풍경", mood: "빈티지", imagePath: "/memo-images/travel.png", imageMemoCount: 12 },
  { tag: "요리", count: 6, subject: "가족 식탁을 위한 조리 과정", mood: "수채화", imagePath: "/memo-images/cooking.png", imageMemoCount: 6 },
  { tag: "독서", count: 4, subject: "책에서 오래 남은 질문", mood: "흑백", imagePath: "/memo-images/reading.png", imageMemoCount: 4 },
  { tag: "음악", count: 6, subject: "오늘의 감정과 닮은 재생 목록", mood: "네온", imagePath: "/memo-images/music.png", imageMemoCount: 6 },
  { tag: "운동", count: 4, subject: "몸의 리듬을 되찾은 짧은 움직임", mood: "흑백", imagePath: "/memo-images/exercise.png", imageMemoCount: 4 },
  { tag: "영화", count: 4, subject: "장면이 남긴 이야기와 여운", mood: "빈티지", imagePath: "/memo-images/movie.png", imageMemoCount: 4 },
];

const TITLE_ENDINGS = ["오늘의 메모", "다시 확인할 것", "작은 실험", "배운 점", "다음 행동"];

const SHORT_CONTENTS = [
  "핵심만 짧게 남겼다.",
  "잊기 전에 한 문장으로 기록했다.",
  "다음에 이어서 생각할 단서를 적었다.",
];

const MEDIUM_CONTENTS = [
  "처음 예상과 실제 결과가 달랐던 지점을 살펴보고, 다음 시도에서 바꿀 기준을 차분히 정리했다.",
  "오늘 경험한 장면과 그때 떠오른 질문을 함께 적었다. 며칠 뒤 다시 읽고 답을 보충할 예정이다.",
  "작은 선택 하나가 전체 흐름에 어떤 영향을 주었는지 돌아보고 바로 실행할 다음 단계를 남겼다.",
];

const LONG_CONTENTS = [
  "서두르지 않고 상황을 처음부터 다시 살펴보았다. 잘된 부분과 막힌 부분을 분리하니 문제의 경계가 조금 더 선명해졌다. 지금 당장 할 수 있는 작은 행동부터 시작하고, 결과를 확인한 뒤 다음 판단을 이어 가기로 했다.",
  "평소에는 지나쳤을 작은 변화를 자세히 관찰했다. 당시의 감정과 선택한 이유, 함께 있던 사람의 말을 순서대로 기록하니 단순한 사건이 아니라 다시 꺼내 볼 수 있는 이야기로 남았다.",
  "여러 가능성을 한꺼번에 해결하려 하지 않고 가장 중요한 질문 하나를 골랐다. 필요한 자료와 확인할 조건을 적고, 실패하더라도 무엇을 배울 수 있는지까지 생각해 다음 시도의 기준을 만들었다.",
];

// 💡 [목업 날짜 만들기]
// 최신 메모는 2026년 9월에 두고 인덱스가 커질수록 3일씩 과거로 이동시켜 200개 모두 2025년 초까지 자연스럽게 퍼지게 합니다.
const createTimestamp = (index: number): string => {
  const latestDate = Date.UTC(2026, 8, 1, 9, 0, 0);
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return new Date(latestDate - index * threeDays).toISOString();
};

// 💡 [본문 길이 선택]
// 카드 높이와 말줄임표를 함께 시험할 수 있도록 메모 순서에 따라 짧은 글·보통 글·긴 글을 반복해서 선택합니다.
const createContent = (subject: string, index: number): string => {
  const collection = index % 3 === 0
    ? SHORT_CONTENTS
    : index % 3 === 1
      ? MEDIUM_CONTENTS
      : LONG_CONTENTS;
  return `${subject}에 관해 ${collection[index % collection.length]}`;
};

// 💡 [태그별 메모 묶음 생성]
// 각 분포의 count만큼 Memo 객체를 만들고, 태그별 imageMemoCount 범위에 든 앞쪽 메모에는 내용과 맞는 로컬 사진 경로를 넣습니다.
let memoIndex = 0;
export const initialMemos: Memo[] = TAG_DISTRIBUTIONS.flatMap((distribution) =>
  Array.from({ length: distribution.count }, (_, tagIndex) => {
    const currentIndex = memoIndex;
    memoIndex += 1;
    const createdAt = createTimestamp(currentIndex);
    const updatedAt = new Date(
      new Date(createdAt).getTime() + (currentIndex % 4) * 60 * 60 * 1000,
    ).toISOString();

    return {
      id: `mock-${distribution.tag}-${String(tagIndex + 1).padStart(2, "0")}`,
      title: `${distribution.tag} ${TITLE_ENDINGS[tagIndex % TITLE_ENDINGS.length]} ${tagIndex + 1}`,
      content: createContent(distribution.subject, currentIndex),
      tags: [distribution.tag],
      createdAt,
      updatedAt,
      isPinned: currentIndex < 3,
      aiImageMood: distribution.mood,
      ...(tagIndex < distribution.imageMemoCount
        ? { imageUrl: distribution.imagePath }
        : {}),
    } satisfies Memo;
  }),
);
