import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import type { MemoLink } from "@/types/memo";

interface LinkCandidate {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  tags?: unknown;
}

interface LinkRequestBody {
  memo?: LinkCandidate;
  existingMemos?: unknown;
}

const GEMINI_MODEL = "gemini-1.5-flash";
const MINIMUM_LINK_WEIGHT = 0.75;
export const runtime = "nodejs";

const RESPONSE_SCHEMA = {
  type: "array",
  maxItems: 8,
  items: {
    type: "object",
    properties: {
      targetId: { type: "string" },
      weight: { type: "number", minimum: 0, maximum: 1 },
      reason: { type: "string" },
    },
    required: ["targetId", "weight", "reason"],
    additionalProperties: false,
  },
} as const;

const normalizeLinks = (value: unknown, validIds: Set<string>): MemoLink[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item): MemoLink[] => {
    if (!item || typeof item !== "object") return [];
    const link = item as Partial<MemoLink>;
    if (
      typeof link.targetId !== "string"
      || typeof link.weight !== "number"
      || link.weight < MINIMUM_LINK_WEIGHT
      || link.weight > 1
      || !validIds.has(link.targetId)
      || seen.has(link.targetId)
    ) return [];
    seen.add(link.targetId);
    return [{
      targetId: link.targetId,
      weight: link.weight,
      reason: typeof link.reason === "string"
        ? link.reason.trim().slice(0, 120)
        : undefined,
    }];
  }).sort((left, right) => right.weight - left.weight).slice(0, 8);
};

// 💡 [새 메모 연관성 분석]
// 브라우저가 보낸 새 메모 하나를 기존 후보들과 비교하고, 실제 후보 ID만 포함된 순수 JSON 배열을 돌려줍니다.
export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API 키가 없습니다." }, { status: 500 });
  }
  let body: LinkRequestBody;
  try {
    body = await request.json() as LinkRequestBody;
  } catch {
    return NextResponse.json({ error: "요청 본문은 JSON이어야 합니다." }, { status: 400 });
  }
  const memo = body.memo;
  const existingMemos = Array.isArray(body.existingMemos)
    ? body.existingMemos as LinkCandidate[]
    : [];
  if (!memo || typeof memo.id !== "string" || typeof memo.content !== "string") {
    return NextResponse.json({ error: "분석할 메모가 올바르지 않습니다." }, { status: 400 });
  }
  const candidates = existingMemos.slice(0, 200).flatMap((candidate) => {
    if (
      typeof candidate.id !== "string"
      || candidate.id === memo.id
      || typeof candidate.content !== "string"
    ) return [];
    return [{
      id: candidate.id,
      title: typeof candidate.title === "string" ? candidate.title.slice(0, 160) : "",
      content: candidate.content.slice(0, 600),
      tags: Array.isArray(candidate.tags)
        ? candidate.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 10)
        : [],
    }];
  });
  if (candidates.length === 0) return NextResponse.json([]);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `신규 또는 수정 메모와 기존 메모의 제목, 본문, 태그 맥락을 비교하세요. 의미적 유사도가 ${MINIMUM_LINK_WEIGHT} 이상인 메모를 높은 순서로 최대 8개만 선택하고, 단순한 흔한 단어 일치는 제외하세요. 반드시 마크다운 없이 [{"targetId":"string","weight":0.0,"reason":"한국어 한 문장"}] 형태의 순수 JSON 배열만 반환하세요.\n\n분석 메모:\n${JSON.stringify(memo)}\n\n기존 메모:\n${JSON.stringify(candidates)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    });
    return NextResponse.json(normalizeLinks(
      JSON.parse(response.text ?? "[]"),
      new Set(candidates.map((candidate) => candidate.id)),
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Gemini 메모 연결 분석 실패: 모델=${GEMINI_MODEL}, 원인=${message}`);
    return NextResponse.json({ error: "메모 연결 분석을 완료하지 못했습니다." }, { status: 500 });
  }
}
