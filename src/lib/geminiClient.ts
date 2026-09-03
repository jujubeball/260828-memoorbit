import type { GeminiAnalysis, GeminiAnalysisPurpose } from "@/src/types/gemini";
import type { GeminiMemoLink } from "@/src/types/gemini";
import type { Memo } from "@/types/memo";
import type { MemoLink } from "@/types/memo";

// 💡 [Gemini 서버 오류 전달 상자]
// 일반 Error에 서버가 보낸 details를 별도 칸으로 보존해, 시간 궤도 화면이 fetch failed의 실제 하위 원인을 그대로 읽을 수 있게 합니다.
export class GeminiApiError extends Error {
  readonly details: string;

  constructor(message: string, details: string) {
    super(message);
    this.name = "GeminiApiError";
    this.details = details;
  }
}

interface RecommendedTagsResponse {
  tags: string[];
}

// 💡 [태그 전용 Gemini 요청]
// 에디터 본문만 태그 전용 서버 Route로 보내고, 화면에는 검증을 통과한 최대 다섯 개의 문자열만 돌려줍니다.
export const requestRecommendedTags = async (
  text: string,
  signal?: AbortSignal,
): Promise<string[]> => {
  const response = await fetch("/api/tags/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });

  if (!response.ok) {
    throw new Error("Gemini 태그 추천 요청에 실패했습니다.");
  }

  const result = await response.json() as RecommendedTagsResponse;
  if (!Array.isArray(result.tags)) {
    throw new Error("Gemini 태그 추천 응답 형식이 올바르지 않습니다.");
  }

  return result.tags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);
};

// 💡 [메모 연관성 분석 요청]
// 이미지 같은 큰 데이터는 제외하고 제목·본문·태그만 서버로 보내 의미적으로 가까운 메모 ID 쌍을 받습니다.
export const requestMemoLinks = async (
  memos: Memo[],
  signal?: AbortSignal,
): Promise<GeminiMemoLink[]> => {
  const response = await fetch("/api/links/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memos: memos.map(({ id, title, content, tags }) => ({
        id,
        title,
        content: content.slice(0, 500),
        tags,
      })),
    }),
    signal,
  });
  if (!response.ok) throw new Error("Gemini 메모 연관 분석에 실패했습니다.");
  const result = await response.json() as { links?: unknown };
  if (!Array.isArray(result.links)) throw new Error("메모 연관 응답 형식이 올바르지 않습니다.");
  return result.links as GeminiMemoLink[];
};

// 💡 [저장 직후 메모 연결 요청]
// 방금 저장한 메모와 나머지 메모의 작은 텍스트 정보만 보내고, 새 메모에서 출발하는 링크 배열을 받습니다.
export const requestLinksForMemo = async (
  memo: Memo,
  existingMemos: Memo[],
): Promise<MemoLink[]> => {
  const response = await fetch("/api/memos/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memo: {
        id: memo.id,
        title: memo.title,
        content: memo.content.slice(0, 600),
        tags: memo.tags,
      },
      existingMemos: existingMemos.map(({ id, title, content, tags }) => ({
        id,
        title,
        content: content.slice(0, 600),
        tags,
      })),
    }),
  });
  if (!response.ok) throw new Error("Gemini 메모 연관 분석에 실패했습니다.");
  const result: unknown = await response.json();
  if (!Array.isArray(result)) throw new Error("메모 연관 응답 형식이 올바르지 않습니다.");
  return result.filter((item): item is MemoLink => {
    if (!item || typeof item !== "object") return false;
    const link = item as Partial<MemoLink>;
    return typeof link.targetId === "string"
      && typeof link.weight === "number"
      && link.weight >= 0.75
      && link.weight <= 1;
  });
};

// 💡 [Gemini 서버 요청 함수]
// 브라우저는 API 키를 알지 못한 채 본문만 우리 서버에 전달하고, 서버가 돌려준 태그와 한 줄 분석을 받습니다.
export const requestGeminiAnalysis = async (
  text: string,
  purpose: GeminiAnalysisPurpose,
  signal?: AbortSignal,
): Promise<GeminiAnalysis> => {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, purpose }),
    signal,
  });

  if (!response.ok) {
    // 서버가 보내 준 안전한 세부 원인을 읽어 시간 궤도 화면의 개발자 콘솔까지 전달합니다.
    const failure = await response.json().catch(() => null) as {
      error?: string;
      details?: string;
    } | null;
    const reason = failure?.details ?? failure?.error ?? `응답 상태 ${response.status}`;
    throw new GeminiApiError("Gemini 분석 요청에 실패했습니다.", reason);
  }

  const result = await response.json() as GeminiAnalysis;
  if (!Array.isArray(result.tags) || typeof result.comment !== "string") {
    throw new Error("Gemini 분석 응답 형식이 올바르지 않습니다.");
  }
  return result;
};
