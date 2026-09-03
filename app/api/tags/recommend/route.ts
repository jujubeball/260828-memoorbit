import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

interface RecommendTagsRequest {
  text?: unknown;
}

const MAX_TEXT_LENGTH = 30_000;
const GEMINI_MODEL = "gemini-1.5-flash";

export const runtime = "nodejs";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    tags: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
    },
  },
  required: ["tags"],
  additionalProperties: false,
} as const;

// Gemini 응답에서 문자열 태그만 골라 공백과 중복을 제거하고 화면 계약인 최대 다섯 개로 제한합니다.
const normalizeTags = (value: unknown): string[] | null => {
  if (!value || typeof value !== "object") return null;
  const tags = (value as { tags?: unknown }).tags;
  if (!Array.isArray(tags)) return null;
  return [...new Set(
    tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean),
  )].slice(0, 5);
};

// 💡 [Gemini 태그 전용 API]
// API 키와 원문은 서버에만 두고, 모델에는 명사 선별 규칙과 JSON 응답 모양을 함께 강제합니다.
export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API 키가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  let body: RecommendTagsRequest;
  try {
    body = await request.json() as RecommendTagsRequest;
  } catch {
    return NextResponse.json(
      { error: "요청 본문은 JSON이어야 합니다." },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string"
    ? body.text.trim().slice(0, MAX_TEXT_LENGTH)
    : "";
  if (!text) {
    return NextResponse.json(
      { error: "추천할 메모 본문이 비어 있습니다." },
      { status: 400 },
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `제공된 메모 본문에서 가장 핵심이 되는 명사 태그를 최대 5개까지만 추출하라. '까지', '해서', '오늘', '완료'와 같은 조사, 어미, 불필요한 단어는 반드시 제외하라. 결과는 오직 문자열 배열을 tags 속성에 담은 JSON 단일 객체만 반환하라. 태그에는 # 기호를 넣지 마라.\n\n메모 본문:\n${text}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    });
    const tags = normalizeTags(JSON.parse(response.text ?? "null"));
    if (!tags) throw new Error("Gemini 태그 응답 검증 실패");
    return NextResponse.json({ tags });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Gemini 태그 추천 실패: 모델=${GEMINI_MODEL}, 원인=${message}`);
    return NextResponse.json(
      { error: "Gemini 태그 추천을 완료하지 못했습니다." },
      { status: 500 },
    );
  }
}
