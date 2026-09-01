"use client";

import { useMemo, useState } from "react";
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
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T23:59:59`).getTime();
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

  return (
    <section aria-labelledby="timeline-title">
      <p className="text-sm font-semibold text-[#b77912]">Timeline Stream</p>
      <h2 id="timeline-title" className="mt-1 text-3xl font-bold">시간 궤도 분석</h2>
      <div className="mt-5 grid gap-4 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">시작일<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-xl border border-[#d1d1d6] px-4 py-3 font-normal outline-none focus:border-[#b77912]" /></label>
        <label className="grid gap-2 text-sm font-semibold">종료일<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-xl border border-[#d1d1d6] px-4 py-3 font-normal outline-none focus:border-[#b77912]" /></label>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-bold">AI 키워드 변화 리포트</h3>
          <p className="mt-1 text-xs text-[#8e8e93]">선택 기간 {report.filtered.length}개 메모의 태그 빈도</p>
          <div className="mt-5 grid gap-3">{report.tags.map(([tag, count]) => <div key={tag}><div className="mb-1 flex justify-between text-xs"><span>#{tag}</span><span>{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e5e5ea]"><div className="h-full rounded-full bg-[#e5a93c]" style={{ width: `${(count / maxTag) * 100}%` }} /></div></div>)}</div>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-bold">월별 기록 스트림</h3>
          <div className="mt-5 flex min-h-60 items-end gap-2 overflow-x-auto border-b border-[#d1d1d6] pb-2">{report.months.map(([month, count]) => <div key={month} className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-semibold">{count}</span><div className="w-full max-w-12 rounded-t-lg bg-[#b77912]" style={{ height: `${Math.max(12, (count / maxMonth) * 180)}px` }} /><span className="text-[10px] text-[#8e8e93] [writing-mode:vertical-rl]">{month}</span></div>)}</div>
        </article>
      </div>
    </section>
  );
}
