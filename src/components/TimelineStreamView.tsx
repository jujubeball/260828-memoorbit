"use client";

import { useMemo, useState } from "react";
import { ResponsiveDatePicker } from "@/src/components/ResponsiveDatePicker";
import type { Memo } from "@/types/memo";

interface TimelineStreamViewProps {
  memos: Memo[];
}

const toInputDate = (date: Date): string => date.toISOString().slice(0, 10);

export function TimelineStreamView({ memos }: TimelineStreamViewProps): React.JSX.Element {
  const dates = memos.map((memo) => new Date(memo.createdAt).getTime());
  const [startDate, setStartDate] = useState(toInputDate(new Date(Math.min(...dates))));
  const [endDate, setEndDate] = useState(toInputDate(new Date(Math.max(...dates))));
  const report = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const filtered = memos.filter((memo) => {
      const time = new Date(memo.createdAt).getTime();
      return time >= start && time <= end;
    });
    const tagCounts = new Map<string, number>();
    const monthCounts = new Map<string, number>();
    filtered.forEach((memo) => {
      memo.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1));
      const date = new Date(memo.createdAt);
      const month = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    });
    return {
      filtered,
      tags: [...tagCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8),
      months: [...monthCounts.entries()].sort((left, right) => left[0].localeCompare(right[0])),
    };
  }, [endDate, memos, startDate]);
  const maxTag = Math.max(1, ...report.tags.map(([, count]) => count));
  const maxMonth = Math.max(1, ...report.months.map(([, count]) => count));
  const topKeyword = report.tags[0]?.[0] ?? "없음";
  const hasInvalidRange = Boolean(startDate && endDate && startDate > endDate);

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
        <article className="glass-panel p-4"><p className="text-xs text-[#9ca3af]">가장 강한 키워드</p><strong className="mt-2 block text-2xl text-[#ffc86b]">#{topKeyword}</strong></article>
        <article className="glass-panel p-4"><p className="text-xs text-[#9ca3af]">활동한 월</p><strong className="mt-2 block text-2xl text-[#ffc86b]">{report.months.length}개월</strong></article>
      </div>
      <div className="mt-5 grid w-full grid-cols-1 gap-5 overflow-hidden xl:grid-cols-2">
        <article className="glass-panel min-w-0 p-5">
          <h3 className="font-bold">AI 키워드 변화 리포트</h3>
          <p className="mt-1 text-xs text-[#8e8e93]">선택 기간 {report.filtered.length}개 메모의 태그 빈도</p>
          <div className="mt-5 grid gap-3">{report.tags.map(([tag, count]) => <div key={tag}><div className="mb-1 flex justify-between text-xs"><span>#{tag}</span><span>{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e5e5ea]"><div className="h-full rounded-full bg-[#e5a93c]" style={{ width: `${(count / maxTag) * 100}%` }} /></div></div>)}</div>
        </article>
        <article className="glass-panel min-w-0 p-5">
          <h3 className="font-bold">월별 기록 스트림</h3>
          <div className="mt-5 flex min-h-60 items-end gap-2 overflow-x-auto border-b border-[#d1d1d6] pb-2">{report.months.map(([month, count]) => <div key={month} className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-semibold">{count}</span><div className="w-full max-w-12 rounded-t-lg bg-[#b77912]" style={{ height: `${Math.max(12, (count / maxMonth) * 180)}px` }} /><span className="text-[10px] text-[#8e8e93] [writing-mode:vertical-rl]">{month}</span></div>)}</div>
        </article>
      </div>
    </section>
  );
}
