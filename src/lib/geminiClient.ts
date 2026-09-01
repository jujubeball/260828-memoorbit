import type { GeminiAnalysis, GeminiAnalysisPurpose } from "@/src/types/gemini";

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

  if (!response.ok) throw new Error("Gemini 분석 요청에 실패했습니다.");

  const result = await response.json() as GeminiAnalysis;
  if (!Array.isArray(result.tags) || typeof result.comment !== "string") {
    throw new Error("Gemini 분석 응답 형식이 올바르지 않습니다.");
  }
  return result;
};
