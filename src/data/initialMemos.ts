import type { ImageMood, Memo } from "@/types/memo";

interface MemoTheme {
  tag: string;
  secondaryTag: string;
  mood: ImageMood;
  titles: string[];
  detail: string;
}

const themes: MemoTheme[] = [
  {
    tag: "개발",
    secondaryTag: "공부",
    mood: "네온",
    titles: [
      "선택 영역 편집기 회고", "컴포넌트 경계 다시 보기", "타입 안전성 점검", "접근성 검사 기록", "API 응답 설계",
      "상태 관리 공부", "코드 리뷰 메모", "배포 전 확인 목록", "성능 개선 아이디어", "새 기술 실험 결과",
    ],
    detail: "작은 단위로 구현하고 타입 검사와 사용자 흐름을 함께 확인했다. 다음 작업에서는 경계 조건을 테스트에 먼저 적어 두기로 했다.",
  },
  {
    tag: "육아",
    secondaryTag: "가족",
    mood: "수채화",
    titles: [
      "아이의 첫 자전거", "어린이집 상담 날", "함께 만든 종이비행기", "비 오는 날 그림 놀이", "처음 읽은 긴 그림책",
      "가족 소풍 준비", "아이와 구운 쿠키", "스스로 신발 신은 날", "잠들기 전 작은 질문", "주말 동물원 나들이",
    ],
    detail: "서두르지 않고 아이가 스스로 선택할 시간을 주었더니 예상하지 못한 이야기와 웃음이 이어졌다. 오래 기억하고 싶은 하루였다.",
  },
  {
    tag: "여행",
    secondaryTag: "추억",
    mood: "빈티지",
    titles: [
      "제주 바닷길의 오후", "부산 골목 산책", "경주에서 본 노을", "강릉 첫 기차 여행", "서울 야경 산책",
      "전주 한옥마을 아침", "여수 바다의 밤", "속초 시장에서의 점심", "남해 작은 숙소", "춘천 호숫가 피크닉",
    ],
    detail: "계획표에서 잠시 벗어나 천천히 걸었다. 낯선 풍경과 그날의 공기, 함께 나눈 대화를 사진처럼 다시 떠올릴 수 있었다.",
  },
  {
    tag: "운동",
    secondaryTag: "건강",
    mood: "흑백",
    titles: [
      "아침 5킬로미터 달리기", "수영 호흡 연습", "첫 플랭크 2분", "공원 계단 운동", "비 오는 날 홈 트레이닝",
      "주말 자전거 기록", "저녁 요가 루틴", "한 달 걷기 회고", "러닝 자세 교정", "가벼운 회복 스트레칭",
    ],
    detail: "기록 경쟁보다 호흡과 자세에 집중했다. 무리하지 않고 꾸준히 이어 가는 것이 몸의 변화를 만드는 가장 좋은 방법임을 느꼈다.",
  },
  {
    tag: "재테크",
    secondaryTag: "경제",
    mood: "빈티지",
    titles: [
      "이번 달 예산 점검", "비상금 목표 세우기", "자동이체 정리", "소비 습관 돌아보기", "장기 투자 원칙",
      "보험 항목 확인", "연말정산 준비", "구독 서비스 정리", "아이 교육비 계획", "여행 적금 시작",
    ],
    detail: "숫자를 단순히 줄이기보다 지출의 목적을 살폈다. 생활의 안정과 미래의 선택지를 넓히는 방향으로 기준을 다시 정리했다.",
  },
  {
    tag: "요리",
    secondaryTag: "생활",
    mood: "수채화",
    titles: [
      "된장찌개 비율 기록", "아이와 만든 주먹밥", "주말 브런치 메뉴", "냉장고 재료 정리", "여름 토마토 파스타",
      "겨울 수프 레시피", "김치볶음밥 실험", "도시락 반찬 계획", "가족 생일 케이크", "비 오는 날 부침개",
    ],
    detail: "집에 있는 재료를 먼저 확인하고 간을 조금씩 맞췄다. 완성된 음식보다 함께 준비하고 식탁에 앉은 시간이 더 따뜻하게 남았다.",
  },
  {
    tag: "독서",
    secondaryTag: "성장",
    mood: "흑백",
    titles: [
      "오래 품고 싶은 문장", "질문하는 태도", "소설 속 낯선 선택", "일의 감각 독서 노트", "아이와 읽은 그림책",
      "여행 에세이의 한 장면", "습관에 관한 책", "경제 입문서 정리", "디자인 원칙 메모", "한 해 독서 회고",
    ],
    detail: "빠르게 결론을 내리기보다 문장이 건넨 질문을 오래 생각했다. 지금의 생활과 일에 연결되는 생각을 짧게 기록해 두었다.",
  },
  {
    tag: "일상",
    secondaryTag: "기록",
    mood: "수채화",
    titles: [
      "창문을 연 아침", "동네 카페의 오후", "비가 그친 골목", "작은 화분의 새잎", "퇴근길에 본 달",
      "주말 빨래와 음악", "오랜 친구의 전화", "따뜻한 차 한 잔", "조용한 새벽 시간", "오늘 고마웠던 일",
    ],
    detail: "평범해서 지나칠 뻔한 순간을 잠시 멈춰 바라보았다. 작은 변화와 고마움을 적어 두니 하루의 표정이 조금 더 선명해졌다.",
  },
  {
    tag: "업무",
    secondaryTag: "계획",
    mood: "네온",
    titles: [
      "주간 우선순위", "회의 결정 사항", "사용자 피드백 정리", "기획안 수정 방향", "프로젝트 중간 회고",
      "동료와 나눈 아이디어", "발표 준비 목록", "집중 시간 기록", "다음 분기 목표", "업무 자동화 후보",
    ],
    detail: "해야 할 일을 나열한 뒤 사용자에게 가장 큰 영향을 주는 순서로 다시 배치했다. 결정한 이유와 다음 행동을 함께 남겼다.",
  },
  {
    tag: "취미",
    secondaryTag: "창작",
    mood: "네온",
    titles: [
      "필름 카메라 첫 롤", "수채화 색 조합", "기타 코드 연습", "텃밭 토마토 기록", "도자기 수업의 컵",
      "밤하늘 사진 연습", "손글씨 한 문장", "작은 목공 선반", "봄꽃 스케치", "나만의 재생 목록",
    ],
    detail: "완성도를 걱정하기보다 손을 움직이며 과정 자체를 즐겼다. 다음번에 바꾸고 싶은 점과 우연히 발견한 재미를 기록했다.",
  },
];

const pad = (value: number): string => String(value).padStart(2, "0");

const createDate = (index: number): string => {
  if (index === 0) return "2026-09-01T09:10:00+09:00";
  if (index === 1) return "2026-08-31T18:20:00+09:00";
  if (index === 2) return "2026-08-28T07:40:00+09:00";
  if (index === 3) return "2026-08-15T21:00:00+09:00";

  if (index < 50) {
    const month = 7 - ((index - 4) % 7);
    const day = 27 - Math.floor((index - 4) / 7) * 3;
    return `2026-${pad(month)}-${pad(day)}T${pad(8 + (index % 12))}:15:00+09:00`;
  }

  const year = index < 70 ? 2025 : index < 80 ? 2024 : index < 90 ? 2023 : 2022;
  const month = 12 - (index % 12);
  const day = 5 + (index % 20);
  return `${year}-${pad(month)}-${pad(day)}T${pad(8 + (index % 12))}:30:00+09:00`;
};

export const initialMemos: Memo[] = themes.flatMap((theme, themeIndex) =>
  theme.titles.map((title, titleIndex) => {
    const index = themeIndex * 10 + titleIndex;
    const timestamp = createDate(index);

    return {
      id: `memo-${pad(index + 1)}`,
      title,
      content: theme.detail,
      createdAt: timestamp,
      updatedAt: timestamp,
      isPinned: index < 3,
      tags: [theme.tag, theme.secondaryTag],
      aiImageMood: theme.mood,
    };
  }),
);
