// 서버와 화면이 같은 응답 모양을 사용하도록 Gemini 분석 결과를 한 곳에서 정의합니다.
export interface GeminiAnalysis {
  tags: string[];
  comment: string;
}

export type GeminiAnalysisPurpose = "tags" | "timeline";

export interface GeminiMemoLink {
  sourceId: string;
  targetId: string;
  weight: number;
  reason?: string;
}
