import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import type { GeminiAnalysis, GeminiAnalysisPurpose } from "@/src/types/gemini";

interface GeminiRequestBody {
  text?: unknown;
  purpose?: unknown;
}

const MAX_TEXT_LENGTH = 30_000;
const GEMINI_MODEL = "gemini-2.5-flash";

// 💡 [네트워크 하위 원인 안전 문자열화]
// fetch failed 안에 숨은 DNS·시간 초과 정보를 찾되, API 키나 요청 객체가 섞일 수 있는 전체 cause는 복사하지 않고 허용한 필드만 골라냅니다.
const stringifyNetworkCause = (cause: unknown): string | undefined => {
  if (!cause) return undefined;
  if (typeof cause !== "object") return String(cause);

  const causeRecord = cause as Record<string, unknown>;
  const safeFields = [
    "name",
    "message",
    "code",
    "errno",
    "syscall",
    "hostname",
    "address",
    "port",
  ] as const;
  const safeCause = Object.fromEntries(
    safeFields
      .filter((field) => causeRecord[field] !== undefined)
      .map((field) => [field, String(causeRecord[field])]),
  );
  return Object.keys(safeCause).length > 0
    ? JSON.stringify(safeCause)
    : Object.prototype.toString.call(cause);
};

// 💡 [안전한 Gemini 오류 정보 만들기]
// 서버 로그에는 오류 이름·메시지와 위에서 선별한 네트워크 원인만 남기고 API 키나 사용자의 메모 본문은 절대 포함하지 않습니다.
const getSafeErrorDetails = (error: unknown): {
  name: string;
  message: string;
  cause?: string;
} => {
  if (error instanceof Error) {
    const cause = stringifyNetworkCause(error.cause);
    return { name: error.name, message: error.message, cause };
  }
  return { name: "알 수 없는 오류", message: String(error) };
};

// Google SDK가 브라우저가 아닌 Next.js 서버의 Node.js 환경에서만 실행되도록 고정합니다.
export const runtime = "nodejs";

// Gemini가 자유로운 글 대신 항상 같은 JSON 모양으로 답하도록 출력 설계도를 제공합니다.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    tags: {
      type: "array",
      description: "본문을 대표하는 중복 없는 짧은 한국어 핵심 태그",
      minItems: 3,
      maxItems: 5,
      items: { type: "string" },
    },
    comment: {
      type: "string",
      description: "본문의 감정과 주제를 근거로 작성한 자연스러운 한국어 한 줄 분석",
    },
  },
  required: ["tags", "comment"],
  additionalProperties: false,
} as const;

// 값의 실제 모양을 검사해 모델이나 잘못된 요청이 예상 밖의 데이터를 화면에 전달하지 못하게 막습니다.
const isPurpose = (value: unknown): value is GeminiAnalysisPurpose =>
  value === "tags" || value === "timeline";

const normalizeAnalysis = (value: unknown): GeminiAnalysis | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<GeminiAnalysis>;
  if (!Array.isArray(candidate.tags) || typeof candidate.comment !== "string") return null;
  const tags = [...new Set(
    candidate.tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean),
  )].slice(0, 5);
  if (tags.length < 3 || !candidate.comment.trim()) return null;
  return { tags, comment: candidate.comment.trim() };
};

// 💡 [Gemini 분석 서버 엔드포인트]
// API 키는 이 서버 파일에서만 읽으며, 브라우저에는 키 대신 분석 결과 JSON만 돌려줍니다.
export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Gemini 설정 오류: GEMINI_API_KEY 환경 변수가 없습니다.");
    return NextResponse.json(
      {
        error: "Gemini API 키가 설정되지 않았습니다.",
        details: "배포 환경의 GEMINI_API_KEY 설정을 확인하세요.",
      },
      { status: 500 },
    );
  }

  let body: GeminiRequestBody;
  try {
    body = await request.json() as GeminiRequestBody;
  } catch (error) {
    const details = getSafeErrorDetails(error);
    console.error(
      `Gemini 요청 JSON 해석 오류: ${details.name} - ${details.message}`,
    );
    return NextResponse.json({ error: "요청 본문은 JSON이어야 합니다." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT_LENGTH) : "";
  const purpose = isPurpose(body.purpose) ? body.purpose : "tags";
  if (!text) {
    return NextResponse.json({ error: "분석할 메모 본문이 비어 있습니다." }, { status: 400 });
  }

  const task = purpose === "timeline"
    ? "여러 메모를 하나의 기간 기록으로 보고, 반복되는 관심사와 감정 흐름을 성찰하는 한 줄 총평을 작성하세요."
    : "한 메모의 문맥을 읽고, 작성자가 다시 찾기 좋은 핵심 태그와 감정·주제 한 줄 코멘트를 작성하세요.";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const contents = `${task}\n\n규칙:\n- 태그는 본문에 근거한 명사·기술명·주제어 3~5개만 작성합니다.\n- 태그에는 # 기호를 넣지 않습니다.\n- 코멘트는 과장하지 말고 한국어 한 문장으로 작성합니다.\n\n분석할 기록:\n${text}`;
    // 공식 Gemini 2.5 Flash 모델 하나만 명시해 환경마다 다른 모델로 전환되는 혼선을 방지합니다.
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    });
    const analysis = normalizeAnalysis(JSON.parse(response.text ?? "null"));
    if (!analysis) throw new Error("Gemini 응답 검증 실패");
    return NextResponse.json(analysis);
  } catch (error) {
    // 서버 로그에는 원인만 남기고 API 키나 전체 메모 본문은 절대 출력하지 않습니다.
    const details = getSafeErrorDetails(error);
    console.error(
      `Gemini 메모 분석 실패: 모델=${GEMINI_MODEL}, 오류=${details.name}, 원인=${details.message}${details.cause ? `, 하위 원인=${details.cause}` : ""}`,
    );
    return NextResponse.json(
      {
        error: "Gemini 분석을 완료하지 못했습니다.",
        details: details.cause
          ? `${details.message} (${details.cause})`
          : details.message,
      },
      { status: 500 },
    );
  }
}
