"use client";

import { useEffect, useMemo, useState } from "react";
import { MainContentHeader } from "@/src/components/MainContentHeader";
import { ResponsiveDatePicker } from "@/src/components/ResponsiveDatePicker";
import { requestGeminiAnalysis } from "@/src/lib/geminiClient";
import { extractDynamicKeywords } from "@/src/lib/textAnalysis";
import type { Memo } from "@/types/memo";

interface TimelineStreamViewProps {
  memos: Memo[];
  onOpenMemo: (memo: Memo) => void;
}

interface ResurfacedIdea {
  memo: Memo;
  reason: string;
  preview: string;
}

const toInputDate = (date: Date): string => date.toISOString().slice(0, 10);

// 저장된 리치 텍스트에서 화면 태그를 제거해 분석에 사용할 읽기 쉬운 일반 문장으로 바꿉니다.
const plainText = (value: string): string => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim();

// 체크박스 HTML 중 checked 속성이 없는 행만 골라 아직 끝나지 않은 문장으로 돌려줍니다.
const incompleteChecklistItems = (memo: Memo): string[] => {
  const rows = memo.richContent?.match(/<div class="memo-check-item"[\s\S]*?<\/div>/g) ?? [];
  return rows
    .filter((row) => !/<input[^>]*\schecked(?:="[^"]*")?[^>]*>/i.test(row))
    .map(plainText)
    .filter(Boolean);
};

export function TimelineStreamView({ memos, onOpenMemo }: TimelineStreamViewProps): React.JSX.Element {
  // 💡 [기간 선택 State]
  // 메모가 있으면 가장 오래된 날부터 최신 날짜까지를 처음 분석 범위로 사용합니다.
  const timestamps = memos.map((memo) => new Date(memo.createdAt).getTime()).filter(Number.isFinite);
  const [startDate, setStartDate] = useState(timestamps.length > 0 ? toInputDate(new Date(Math.min(...timestamps))) : "");
  const [endDate, setEndDate] = useState(timestamps.length > 0 ? toInputDate(new Date(Math.max(...timestamps))) : "");
  const [geminiComment, setGeminiComment] = useState<string | null>(null);
  const [isGeminiAnalyzing, setIsGeminiAnalyzing] = useState(false);
  const [isUsingLocalComment, setIsUsingLocalComment] = useState(false);
  const hasInvalidRange = Boolean(startDate && endDate && startDate > endDate);

  // 💡 [선택 기간 AI 분석 리포트]
  // 날짜나 메모가 바뀔 때만 본문 핵심어, 태그 비중, 질문과 미완료 항목을 다시 계산합니다.
  const report = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const filtered = hasInvalidRange ? [] : memos.filter((memo) => {
      const createdAt = new Date(memo.createdAt).getTime();
      return createdAt >= start && createdAt <= end;
    });

    // 메모에 사용자가 붙인 태그가 없더라도 본문에서 동적으로 핵심어를 뽑아 주제를 놓치지 않습니다.
    const themeCounts = new Map<string, number>();
    filtered.forEach((memo) => {
      const themes = memo.tags.length > 0
        ? memo.tags
        : extractDynamicKeywords(`${memo.title} ${memo.content}`, 3);
      themes.forEach((theme) => themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1));
    });
    const topThemes = [...themeCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 2);
    const topThemeTotal = topThemes.reduce((sum, [, count]) => sum + count, 0);
    const themeSummary = topThemes.length > 0
      ? topThemes.map(([theme, count]) => `#${theme}(${Math.round(count / topThemeTotal * 100)}%)`).join("와 ")
      : "아직 뚜렷한 핵심 주제가 없는 기록";

    const questionCount = filtered.reduce((sum, memo) => sum + (memo.content.match(/[?？]/g)?.length ?? 0), 0);
    const incompleteCount = filtered.reduce((sum, memo) => sum + incompleteChecklistItems(memo).length, 0);
    const tone = questionCount > incompleteCount
      ? "질문과 탐색이 활발했던"
      : incompleteCount > 0
        ? "생각을 행동으로 옮기려는 흐름이 강했던"
        : "차분한 성찰과 기록이 깊었던";
    const spectrumComment = filtered.length > 0
      ? `이번 기간은 ${themeSummary}에 대한 ${tone} 궤도입니다.`
      : "선택 기간에 분석할 메모가 없습니다.";

    // 질문 또는 미완료 체크 항목이 있는 메모만 후보로 삼고, 미완료 수·질문 수·오래된 정도로 우선순위를 정합니다.
    const referenceTime = endDate
      ? new Date(`${endDate}T23:59:59`).getTime()
      : Math.max(...filtered.map((memo) => new Date(memo.updatedAt).getTime()), 0);
    const resurfacedIdeas: ResurfacedIdea[] = filtered
      .map((memo) => {
        const incompleteItems = incompleteChecklistItems(memo);
        const questions = memo.content.match(/[^.!\n]*[?？]/g)?.map((question) => question.trim()).filter(Boolean) ?? [];
        const ageInDays = Math.max(0, (referenceTime - new Date(memo.updatedAt).getTime()) / 86400000);
        const score = incompleteItems.length * 100 + questions.length * 70 + Math.min(ageInDays, 365) * 0.2;
        const preview = incompleteItems[0] ?? questions[0] ?? "";
        const reason = incompleteItems.length > 0
          ? `완료를 기다리는 항목 ${incompleteItems.length}개`
          : `다시 답해 볼 질문 ${questions.length}개`;
        return { memo, preview, reason, score };
      })
      .filter((idea) => Boolean(idea.preview))
      .sort((left, right) => right.score - left.score)
      .slice(0, 2)
      .map(({ memo, preview, reason }) => ({ memo, preview, reason }));

    return { filtered, spectrumComment, topThemes, resurfacedIdeas };
  }, [endDate, hasInvalidRange, memos, startDate]);

  // 💡 [기간 메모 Gemini 분석]
  // 날짜 범위에 들어온 메모를 한 묶음의 글로 합쳐 서버에 보내고, 최신 요청이 실패한 경우에만 로컬 총평을 유지합니다.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (report.filtered.length === 0) {
        setGeminiComment(null);
        setIsUsingLocalComment(false);
        setIsGeminiAnalyzing(false);
        return;
      }

      const periodText = report.filtered.map((memo) => [
        `날짜: ${memo.createdAt.slice(0, 10)}`,
        `제목: ${memo.title}`,
        `본문: ${memo.content}`,
        `태그: ${memo.tags.join(", ") || "없음"}`,
      ].join("\n")).join("\n\n");

      setIsGeminiAnalyzing(true);
      try {
        const analysis = await requestGeminiAnalysis(periodText, "timeline", controller.signal);
        setGeminiComment(analysis.comment);
        setIsUsingLocalComment(false);
      } catch {
        if (controller.signal.aborted) return;
        setGeminiComment(report.spectrumComment);
        setIsUsingLocalComment(true);
      } finally {
        if (!controller.signal.aborted) setIsGeminiAnalyzing(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [report.filtered, report.spectrumComment]);

  return (
    <section className="text-[#f3f4f6]" aria-labelledby="timeline-title">
      <MainContentHeader
        id="timeline-title"
        label="TIMELINE STREAM"
        title="시간 궤도 분석"
        description="지정한 기간 동안 쌓인 기록의 성찰과 실행 궤도를 분석합니다."
      />
      <div className="glass-panel relative z-10 grid w-full gap-4 overflow-visible p-4 sm:grid-cols-2">
        <ResponsiveDatePicker id="timeline-start" label="시작일" value={startDate} onChange={setStartDate} />
        <ResponsiveDatePicker id="timeline-end" label="종료일" value={endDate} onChange={setEndDate} />
      </div>
      {hasInvalidRange && (
        <p role="alert" className="mt-2 text-sm text-[#ff6961]">
          시작일은 종료일보다 늦을 수 없습니다.
        </p>
      )}

      <div className="mt-5 grid w-full grid-cols-1 gap-5 overflow-hidden xl:grid-cols-2">
        <article className="glass-panel relative z-10 min-w-0 border-[#e5a93c]/30 p-5">
          <p className="text-xs font-semibold text-[#ffc86b]">Thought Spectrum</p>
          <h3 className="mt-1 text-xl font-bold">🌌 AI 감정 & 생각 궤도 분석</h3>
          <p className="mt-4 text-base leading-8 text-[#f3f4f6]">
            {geminiComment ?? report.spectrumComment}
          </p>
          <p className={`mt-3 text-xs ${isGeminiAnalyzing ? "animate-pulse text-[#ffc86b] motion-reduce:animate-none" : "text-[#9ca3af]"}`}>
            {isGeminiAnalyzing
              ? "Gemini가 선택 기간의 기록을 분석하고 있습니다…"
              : isUsingLocalComment
                ? "Gemini 연결 실패로 로컬 분석 결과를 표시합니다"
                : "Gemini 기간 분석 완료"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {report.topThemes.map(([theme, count]) => (
              <span key={theme} className="rounded-full border border-[#e5a93c]/35 bg-[#e5a93c]/10 px-3 py-2 text-sm text-[#ffc86b]">
                #{theme} · {count}회
              </span>
            ))}
          </div>
        </article>

        <article className="glass-panel relative z-10 min-w-0 p-5">
          <p className="text-xs font-semibold text-[#ffc86b]">Resurfaced Ideas</p>
          <h3 className="mt-1 text-xl font-bold">💡 AI 잊혀진 아이디어 큐레이션</h3>
          <p className="mt-2 text-sm leading-6 text-[#9ca3af]">
            답을 기다리는 질문과 끝나지 않은 생각을 다시 궤도 위로 올렸습니다.
          </p>
          <div className="mt-4 grid gap-3">
            {report.resurfacedIdeas.map((idea) => (
              <button
                key={idea.memo.id}
                type="button"
                onClick={() => onOpenMemo(idea.memo)}
                className="rounded-2xl border border-[#2a2e3d] bg-white/[0.035] p-4 text-left transition-colors hover:border-[#e5a93c]/60 hover:bg-[#e5a93c]/10"
              >
                <span className="text-xs font-semibold text-[#ffc86b]">{idea.reason}</span>
                <strong className="mt-2 block truncate text-sm">{idea.memo.title}</strong>
                <span className="mt-1 block line-clamp-2 text-sm leading-6 text-[#d1d5db]">{idea.preview}</span>
              </button>
            ))}
            {report.resurfacedIdeas.length === 0 && (
              <p className="rounded-2xl border border-dashed border-[#2a2e3d] p-6 text-center text-sm text-[#9ca3af]">
                선택 기간에 다시 꺼내 볼 질문이나 미완료 항목이 없습니다.
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
