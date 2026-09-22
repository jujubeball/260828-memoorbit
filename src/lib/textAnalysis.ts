// 조사·접속사처럼 문장의 의미보다 문법을 연결하는 낱말은 태그 후보에서 제외합니다.
// 이 목록은 특정 주제를 태그로 바꾸는 규칙이 아니라, 모든 주제에 공통으로 적용되는 불용어 목록입니다.
const STOP_WORDS = new Set([
  "그리고", "그러나", "하지만", "그래서", "또는", "또한", "대한", "위한", "위해",
  "있는", "없는", "하는", "했던", "한다", "했다", "것은", "것을", "것이", "에서",
  "으로", "에게", "보다", "처럼", "정말", "조금", "매우", "다시", "함께", "오늘",
  "이번", "메모", "기록", "생각", "내용", "관련", "통해", "때문", "이렇게", "저렇게",
]);

interface KeywordCandidate {
  label: string;
  count: number;
  firstIndex: number;
  sentenceCount: number;
}

// 💡 [동적 본문 핵심어 추출 엔진]
// 미리 정한 주제별 단어표를 조회하지 않고, 사용자가 실제로 쓴 낱말의 반복 횟수와 등장 위치를 계산합니다.
// 같은 단어가 여러 문장에 반복되거나 글 앞부분에 등장할수록 글 전체를 대표할 가능성이 높다고 판단합니다.
export const extractDynamicKeywords = (text: string, limit = 5): string[] => {
  const normalizedText = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedText) return [];

  const sentences = normalizedText.split(/[.!?。\n]+/).filter(Boolean);
  const candidates = new Map<string, KeywordCandidate>();

  sentences.forEach((sentence, sentenceIndex) => {
    const words = sentence.match(/[#@]?[가-힣A-Za-z][가-힣A-Za-z0-9.+#-]{1,}/g) ?? [];
    const wordsInSentence = new Set<string>();

    words.forEach((rawWord, wordIndex) => {
      const label = rawWord.replace(/^[#@]/, "").replace(/[은는이가을를의와과도만에로께]$/u, "");
      const key = label.toLocaleLowerCase("ko-KR");
      if (label.length < 2 || STOP_WORDS.has(label) || /^\d+$/.test(label)) return;

      const current = candidates.get(key);
      const firstIndex = sentenceIndex * 100 + wordIndex;
      candidates.set(key, {
        label: current?.label ?? label,
        count: (current?.count ?? 0) + 1,
        firstIndex: Math.min(current?.firstIndex ?? firstIndex, firstIndex),
        sentenceCount: (current?.sentenceCount ?? 0) + (wordsInSentence.has(key) ? 0 : 1),
      });
      wordsInSentence.add(key);
    });
  });

  // 반복 빈도, 여러 문장에 걸친 등장, 앞부분 등장, 고유명사·기술명에 흔한 긴 표기를 종합 점수로 사용합니다.
  return [...candidates.values()]
    .sort((left, right) => {
      const leftScore = left.count * 5 + left.sentenceCount * 3 + Math.min(left.label.length, 8) - left.firstIndex * 0.002;
      const rightScore = right.count * 5 + right.sentenceCount * 3 + Math.min(right.label.length, 8) - right.firstIndex * 0.002;
      return rightScore - leftScore || left.firstIndex - right.firstIndex;
    })
    .slice(0, Math.max(3, Math.min(limit, 5)))
    .map((candidate) => candidate.label);
};
