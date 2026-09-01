"use client";

import { useMemo, useState } from "react";
import { ResponsiveDatePicker } from "@/src/components/ResponsiveDatePicker";
import type { Memo } from "@/types/memo";

interface TimelineStreamViewProps {
  memos: Memo[];
}

interface MonthStory {
  month: string;
  memos: Memo[];
  tags: string[];
}

const toInputDate = (date: Date): string => date.toISOString().slice(0, 10);
const tagPairKey = (left: string, right: string): string => [left, right].sort().join("+");

export function TimelineStreamView({ memos }: TimelineStreamViewProps): React.JSX.Element {
  const dates = memos.map((memo) => new Date(memo.createdAt).getTime());
  const [startDate, setStartDate] = useState(toInputDate(new Date(Math.min(...dates))));
  const [endDate, setEndDate] = useState(toInputDate(new Date(Math.max(...dates))));
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [insightVersion, setInsightVersion] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");

  const report = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const filtered = memos.filter((memo) => {
      const time = new Date(memo.createdAt).getTime();
      return time >= start && time <= end;
    });
    const tagCounts = new Map<string, number>();
    const pairCounts = new Map<string, number>();
    const monthGroups = new Map<string, Memo[]>();
    filtered.forEach((memo) => {
      memo.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1));
      memo.tags.forEach((tag, index) => memo.tags.slice(index + 1).forEach((relatedTag) => {
        const pair = tagPairKey(tag, relatedTag);
        pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
      }));
      const date = new Date(memo.createdAt);
      const month = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthGroups.set(month, [...(monthGroups.get(month) ?? []), memo]);
    });
    const topTags = [...tagCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3).map(([tag]) => tag);
    const topPairs = [...pairCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3);
    const months: MonthStory[] = [...monthGroups.entries()].sort((left, right) => left[0].localeCompare(right[0])).map(([month, monthMemos]) => {
      const counts = new Map<string, number>();
      monthMemos.forEach((memo) => memo.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
      return { month, memos: monthMemos, tags: [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 2).map(([tag]) => tag) };
    });
    return { filtered, topTags, topPairs, months };
  }, [endDate, memos, startDate]);

  const activeMonth = hoveredMonth ?? selectedMonth ?? report.months.at(-1)?.month ?? null;
  const activeStory = report.months.find((story) => story.month === activeMonth);
  const hasInvalidRange = Boolean(startDate && endDate && startDate > endDate);
  const prompt = useMemo(() => {
    const memoText = report.filtered.map((memo) => `[${memo.createdAt.slice(0, 10)}] ${memo.title}\n${memo.content}\n태그: ${memo.tags.join(", ")}`).join("\n\n");
    return `당신은 따뜻하고 현실적인 회고 코치입니다. 아래 MemoOrbit 기록을 분석해 주세요.\n\n분석 기간: ${startDate || "전체"} ~ ${endDate || "전체"}\n\n요청사항:\n1. 이 기간의 종합 회고\n2. 반복된 관심사와 감정의 변화\n3. 사용자의 성장 징후\n4. 실천 가능한 개선 조언\n5. 추가로 알아두면 좋은 사안\n\n메모:\n${memoText}`;
  }, [endDate, report.filtered, startDate]);
  const insight = useMemo(() => {
    const interests = report.topTags.length > 0 ? report.topTags.map((tag) => `#${tag}`).join(" · ") : "아직 뚜렷한 관심사가 없습니다";
    const pair = report.topPairs[0]?.[0].split("+").map((tag) => `#${tag}`).join(" + ") ?? "연결 태그 없음";
    const openings = ["기록은 반복되는 관심사를 선명하게 보여 줍니다.", "당신의 시간에는 작지만 꾸준한 방향성이 흐르고 있습니다.", "이번 궤도에서는 관심사의 연결이 특히 또렷합니다."];
    return `${openings[insightVersion % openings.length]} 핵심 관심사는 ${interests}이며, 가장 자주 함께 나타난 조합은 ${pair}입니다. 다음 기록에서는 이 관심사가 실제 행동이나 감정에 어떤 변화를 만들었는지 한 문장 더 남겨 보세요. 시간이 지난 뒤 성장의 원인을 발견하기 훨씬 쉬워집니다.`;
  }, [insightVersion, report.topPairs, report.topTags]);

  const copyPrompt = async (): Promise<void> => {
    await navigator.clipboard.writeText(prompt);
    setCopyStatus("Gemini 분석 프롬프트를 복사했습니다.");
    window.setTimeout(() => setCopyStatus(""), 1800);
  };

  return (
    <section className="text-[#f3f4f6]" aria-labelledby="timeline-title">
      <p className="text-sm font-semibold text-[#ffc86b]">Timeline Stream</p>
      <h2 id="timeline-title" className="mt-1 text-3xl font-bold">시간 궤도 분석</h2>
      <div className="glass-panel mt-5 grid w-full gap-4 overflow-visible p-4 sm:grid-cols-2">
        <ResponsiveDatePicker id="timeline-start" label="시작일" value={startDate} onChange={setStartDate} />
        <ResponsiveDatePicker id="timeline-end" label="종료일" value={endDate} onChange={setEndDate} />
      </div>
      {hasInvalidRange && <p role="alert" className="mt-2 text-sm text-[#ff6961]">시작일은 종료일보다 늦을 수 없습니다.</p>}

      <div className="mt-5 grid w-full grid-cols-1 gap-4 overflow-hidden xl:grid-cols-3">
        <article className="glass-panel p-4"><p className="text-xs text-[#9ca3af]">선택 기간 메모</p><strong className="mt-2 block text-2xl text-[#ffc86b]">{report.filtered.length}개</strong></article>
        <article className="glass-panel p-4"><p className="text-xs text-[#9ca3af]">가장 강한 관심사</p><strong className="mt-2 block text-2xl text-[#ffc86b]">#{report.topTags[0] ?? "없음"}</strong></article>
        <article className="glass-panel p-4"><p className="text-xs text-[#9ca3af]">활동한 시간 궤도</p><strong className="mt-2 block text-2xl text-[#ffc86b]">{report.months.length}개월</strong></article>
      </div>

      <article className="glass-panel mt-5 p-5">
        <p className="text-xs font-semibold text-[#ffc86b]">Orbit Highlight</p>
        <h3 className="mt-1 text-xl font-bold">기간별 핵심 관심사 궤도</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div><p className="mb-3 text-xs text-[#9ca3af]">자주 함께 기록한 태그 조합</p><div className="flex flex-wrap gap-2">{report.topPairs.map(([pair, count]) => <span key={pair} className="rounded-full border border-[#e5a93c]/35 bg-[#e5a93c]/10 px-3 py-2 text-sm text-[#ffc86b]">{pair.split("+").map((tag) => `#${tag}`).join(" + ")} · {count}회</span>)}</div></div>
          <div><p className="mb-3 text-xs text-[#9ca3af]">당시 주된 관심사 3가지</p><div className="flex flex-wrap gap-2">{report.topTags.map((tag, index) => <span key={tag} className="rounded-xl bg-white/5 px-4 py-3"><small className="mr-2 text-[#9ca3af]">0{index + 1}</small><strong>#{tag}</strong></span>)}</div></div>
        </div>
      </article>

      <article className="glass-panel mt-5 overflow-hidden p-5">
        <p className="text-xs font-semibold text-[#ffc86b]">Visual Storyline</p>
        <h3 className="mt-1 text-xl font-bold">인생 궤도 타임라인 스트림</h3>
        <div className="relative mt-8 overflow-x-auto pb-5 pt-4">
          <div className="absolute left-6 right-6 top-[2.15rem] h-0.5 bg-gradient-to-r from-transparent via-[#e5a93c] to-transparent shadow-[0_0_16px_#e5a93c]" />
          <div className="relative flex min-w-max justify-between gap-10 px-6">
            {report.months.map((story) => <button key={story.month} type="button" onClick={() => setSelectedMonth(story.month)} onMouseEnter={() => setHoveredMonth(story.month)} onMouseLeave={() => setHoveredMonth(null)} aria-pressed={activeMonth === story.month} className="group flex w-24 flex-col items-center"><span className={`h-9 w-9 rounded-full border-4 border-[#1a1d26] shadow-[0_0_20px_rgb(229_169_60/0.55)] ${activeMonth === story.month ? "bg-[#ffc86b] scale-110" : "bg-[#e5a93c]"}`} /><span className="mt-3 text-xs text-[#9ca3af]">{story.month}</span></button>)}
          </div>
        </div>
        {activeStory && <div className="mt-3 grid gap-3 rounded-2xl border border-[#2a2e3d] bg-[#0f1117]/60 p-4 sm:grid-cols-[1fr_auto]"><div><strong>{activeStory.month}: {activeStory.tags.map((tag) => `#${tag}`).join(" ")} 중심의 기록이 깊었던 시기</strong><p className="mt-2 text-sm text-[#9ca3af]">{activeStory.memos.length}개의 장면이 이 시기의 궤도를 만들었습니다.</p></div><div className="max-w-xs rounded-xl bg-white/5 p-3"><small className="text-[#9ca3af]">대표 메모</small><p className="mt-1 truncate font-semibold">{activeStory.memos[0]?.title}</p></div></div>}
      </article>

      <article className="glass-panel mt-5 border-[#e5a93c]/30 p-6">
        <p className="text-sm font-semibold text-[#ffc86b]">🌌 Gemini AI 궤도 코멘트 & 인사이트</p>
        <h3 className="mt-2 text-2xl font-bold">기록이 들려주는 다음 궤도</h3>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d1d5db]">{insight}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => void copyPrompt()} className="rounded-xl border border-[#2a2e3d] bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10">📋 Gemini 분석 프롬프트 복사</button>
          <button type="button" onClick={() => setInsightVersion((current) => current + 1)} className="rounded-xl bg-[#e5a93c] px-4 py-3 text-sm font-bold text-[#0f1117] hover:bg-[#bd8428]">✨ AI 코멘트 즉시 재생성</button>
        </div>
        {copyStatus && <p role="status" className="mt-3 text-xs text-[#ffc86b]">{copyStatus}</p>}
        <p className="mt-4 text-xs leading-5 text-[#9ca3af]">복사 전 메모에 개인정보나 민감한 내용이 포함되어 있는지 확인하세요. 복사한 프롬프트는 사용자가 직접 Gemini에 붙여넣을 때만 외부로 전달됩니다.</p>
      </article>
    </section>
  );
}
