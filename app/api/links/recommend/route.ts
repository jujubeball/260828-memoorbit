import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import type { GeminiMemoLink } from "@/src/types/gemini";

interface LinkMemoInput {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  tags?: unknown;
}

interface LinkRequestBody {
  memos?: unknown;
}

const GEMINI_MODEL = "gemini-1.5-flash";
const MINIMUM_LINK_WEIGHT = 0.75;
export const runtime = "nodejs";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    links: {
      type: "array",
      maxItems: 300,
      items: {
        type: "object",
        properties: {
          sourceId: { type: "string" },
          targetId: { type: "string" },
          weight: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" },
        },
        required: ["sourceId", "targetId", "weight", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["links"],
  additionalProperties: false,
} as const;

const normalizeLinks = (value: unknown, validIds: Set<string>): GeminiMemoLink[] => {
  if (!value || typeof value !== "object") return [];
  const links = (value as { links?: unknown }).links;
  if (!Array.isArray(links)) return [];
  const seen = new Set<string>();
  return links.flatMap((item): GeminiMemoLink[] => {
    if (!item || typeof item !== "object") return [];
    const link = item as Partial<GeminiMemoLink>;
    if (
      typeof link.sourceId !== "string"
      || typeof link.targetId !== "string"
      || typeof link.weight !== "number"
      || !validIds.has(link.sourceId)
      || !validIds.has(link.targetId)
      || link.sourceId === link.targetId
      || link.weight < MINIMUM_LINK_WEIGHT
      || link.weight > 1
    ) return [];
    const pairKey = [link.sourceId, link.targetId].sort().join(":");
    if (seen.has(pairKey)) return [];
    seen.add(pairKey);
    return [{
      sourceId: link.sourceId,
      targetId: link.targetId,
      weight: link.weight,
      reason: typeof link.reason === "string" ? link.reason.trim().slice(0, 120) : undefined,
    }];
  });
};

// 💡 [Gemini 메모 연결 분석]
// 메모 원문은 로그에 남기지 않고 서버에서만 비교하며, 강한 의미 관계만 ID 쌍과 점수로 반환합니다.
export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Gemini API 키가 없습니다." }, { status: 500 });
  let body: LinkRequestBody;
  try {
    body = await request.json() as LinkRequestBody;
  } catch {
    return NextResponse.json({ error: "요청 본문은 JSON이어야 합니다." }, { status: 400 });
  }
  const rawMemos = Array.isArray(body.memos) ? body.memos as LinkMemoInput[] : [];
  const memos = rawMemos.slice(0, 200).flatMap((memo) => {
    if (typeof memo.id !== "string" || typeof memo.title !== "string") return [];
    return [{
      id: memo.id,
      title: memo.title.slice(0, 160),
      content: typeof memo.content === "string" ? memo.content.slice(0, 500) : "",
      tags: Array.isArray(memo.tags)
        ? memo.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 10)
        : [],
    }];
  });
  if (memos.length < 2) return NextResponse.json({ links: [] });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `다음 메모들의 제목, 본문, 태그를 비교해 의미적으로 강하게 연관된 메모 쌍만 찾으세요. 동일 주제, 후속 생각, 원인과 결과, 같은 프로젝트 관계를 우선하며 단순한 흔한 단어 일치는 제외하세요. weight는 0부터 1 사이이며 ${MINIMUM_LINK_WEIGHT} 이상인 관계만 최대 300개 반환하세요. 같은 쌍과 자기 자신 연결은 금지합니다. reason은 한국어 한 문장으로 간결하게 작성하세요.\n\n${JSON.stringify(memos)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    });
    const validIds = new Set(memos.map((memo) => memo.id));
    return NextResponse.json({
      links: normalizeLinks(JSON.parse(response.text ?? "null"), validIds),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Gemini 메모 연결 분석 실패: 모델=${GEMINI_MODEL}, 원인=${message}`);
    return NextResponse.json({ error: "메모 연결 분석을 완료하지 못했습니다." }, { status: 500 });
  }
}
