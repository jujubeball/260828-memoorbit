"use client";

import { useMemo, useState } from "react";
import { ResponsiveDatePicker } from "@/src/components/ResponsiveDatePicker";
import { MainContentHeader } from "@/src/components/MainContentHeader";
import type { Memo } from "@/types/memo";

interface TimelineStreamViewProps {
  memos: Memo[];
  onOpenMemo: (memo: Memo) => void;
}

interface PendingOrbitItem {
  id: string;
  kind: "미완료 항목" | "핵심 아이디어";
  memo: Memo;
  text: string;
}

const toInputDate = (date: Date): string => date.toISOString().slice(0, 10);
const plainText = (value: string): string => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim();

const incompleteChecklistItems = (memo: Memo): string[] => {
  const rows = memo.richContent?.match(/<div class="memo-check-item"[\s\S]*?<\/div>/g) ?? [];
  return rows
    .filter((row) => !/<input[^>]*\schecked(?:="[^"]*")?[^>]*>/i.test(row))
    .map(plainText)
    .filter(Boolean);
};

const memoDensity = (memo: Memo): number => {
  const textLength = plainText(memo.richContent ?? memo.content).length;
  return textLength + memo.tags.length * 60 + (memo.isPinned ? 80 : 0);
};

export function TimelineStreamView({ memos, onOpenMemo }: TimelineStreamViewProps): React.JSX.Element {
  const timestamps = memos.map((memo) => new Date(memo.createdAt).getTime()).filter(Number.isFinite);
  const [startDate, setStartDate] = useState(timestamps.length > 0 ? toInputDate(new Date(Math.min(...timestamps))) : "");
  const [endDate, setEndDate] = useState(timestamps.length > 0 ? toInputDate(new Date(Math.max(...timestamps))) : "");
  const hasInvalidRange = Boolean(startDate && endDate && startDate > endDate);

  const report = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const filtered = hasInvalidRange ? [] : memos.filter((memo) => {
      const createdAt = new Date(memo.createdAt).getTime();
      return createdAt >= start && createdAt <= end;
    });
    const checklistItems = filtered.flatMap((memo) => incompleteChecklistItems(memo).map((text, index) => ({
      id: `${memo.id}-체크-${index}`,
      kind: "미완료 항목" as const,
      memo,
      text,
    })));
    const checklistMemoIds = new Set(checklistItems.map((item) => item.memo.id));
    const ideaItems = filtered
      .filter((memo) => !checklistMemoIds.has(memo.id) && plainText(memo.content).length >= 60)
      .sort((left, right) => memoDensity(right) - memoDensity(left))
      .slice(0, 3)
      .map((memo) => ({
        id: `${memo.id}-아이디어`,
        kind: "핵심 아이디어" as const,
        memo,
        text: plainText(memo.content).slice(0, 120),
      }));
    const pendingItems: PendingOrbitItem[] = [...checklistItems, ...ideaItems];
    const revisitMemos = [...filtered].sort((left, right) => memoDensity(right) - memoDensity(left)).slice(0, 3);
    return { pendingItems, revisitMemos };
  }, [endDate, hasInvalidRange, memos, startDate]);

  return (
    <section className="text-[#f3f4f6]" aria-labelledby="timeline-title">
      <MainContentHeader
        id="timeline-title"
        label="TIMELINE STREAM"
        title="시간 궤도 분석"
        description="지정한 기간 동안 쌓인 기록의 성찰과 실행 궤도를 분석합니다."
      />
      <div className="glass-panel relative z-40 grid w-full gap-4 overflow-visible p-4 sm:grid-cols-2">
        <ResponsiveDatePicker id="timeline-start" label="시작일" value={startDate} onChange={setStartDate} />
        <ResponsiveDatePicker id="timeline-end" label="종료일" value={endDate} onChange={setEndDate} />
      </div>
      {hasInvalidRange && (
        <p role="alert" className="mt-2 text-sm text-[#ff6961]">
          시작일은 종료일보다 늦을 수 없습니다.
        </p>
      )}

      <div className="mt-5 grid w-full grid-cols-1 gap-5 overflow-hidden xl:grid-cols-2">
        <article className="glass-panel min-w-0 p-5">
          <p className="text-xs font-semibold text-[#ffc86b]">Pending Tasks Orbit</p>
          <h3 className="mt-1 text-xl font-bold">미완성 궤도 추적</h3>
          <p className="mt-2 text-sm leading-6 text-[#9ca3af]">
            아직 끝내지 못한 체크 항목과 실행으로 옮길 만한 생각을 모았습니다.
          </p>
          <div className="mt-4 grid max-h-[420px] gap-2 overflow-y-auto pr-1">
            {report.pendingItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenMemo(item.memo)}
                className="rounded-2xl border border-[#2a2e3d] bg-white/[0.035] p-4 text-left transition-colors hover:border-[#e5a93c]/60 hover:bg-[#e5a93c]/10"
              >
                <span className="rounded-full bg-[#e5a93c]/15 px-2 py-1 text-[11px] font-semibold text-[#ffc86b]">
                  {item.kind}
                </span>
                <strong className="mt-3 block truncate text-sm">{item.memo.title}</strong>
                <span className="mt-1 block line-clamp-2 text-sm leading-6 text-[#d1d5db]">{item.text}</span>
              </button>
            ))}
            {report.pendingItems.length === 0 && (
              <p className="rounded-2xl border border-dashed border-[#2a2e3d] p-6 text-center text-sm text-[#9ca3af]">
                선택 기간에 추적할 미완료 항목이 없습니다.
              </p>
            )}
          </div>
        </article>

        <article className="glass-panel min-w-0 p-5">
          <p className="text-xs font-semibold text-[#ffc86b]">Re-visit Memos</p>
          <h3 className="mt-1 text-xl font-bold">다시 볼 만한 주요 생각</h3>
          <p className="mt-2 text-sm leading-6 text-[#9ca3af]">
            기록의 밀도와 태그 집중도를 기준으로 대표 메모 세 개를 골랐습니다.
          </p>
          <div className="mt-4 grid gap-3">
            {report.revisitMemos.map((memo, index) => (
              <button
                key={memo.id}
                type="button"
                onClick={() => onOpenMemo(memo)}
                className="group flex min-w-0 items-start gap-3 rounded-2xl border border-[#2a2e3d] bg-white/[0.035] p-4 text-left transition-colors hover:border-[#e5a93c]/60 hover:bg-[#e5a93c]/10"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e5a93c] text-sm font-bold text-[#0f1117]">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm group-hover:text-[#ffc86b]">{memo.title}</strong>
                  <span className="mt-1 block line-clamp-2 text-sm leading-6 text-[#9ca3af]">
                    {plainText(memo.content) || "추가 텍스트 없음"}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {memo.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-[#ffc86b]">
                        #{tag}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            ))}
            {report.revisitMemos.length === 0 && (
              <p className="rounded-2xl border border-dashed border-[#2a2e3d] p-6 text-center text-sm text-[#9ca3af]">
                선택 기간에 다시 볼 메모가 없습니다.
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
