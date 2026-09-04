"use client";

import { useRef, useState } from "react";

export type DatePreset =
  | "week"
  | "month"
  | "3months"
  | "year"
  | "all"
  | "custom";

interface TimeOrbitDateRangePickerProps {
  startDate: string;
  endDate: string;
  onRangeChange: (
    startDate: string,
    endDate: string,
    preset: DatePreset,
  ) => void;
}

const PRESET_OPTIONS: Array<{ id: DatePreset; label: string }> = [
  { id: "week", label: "최근 1주일" },
  { id: "month", label: "최근 1개월" },
  { id: "3months", label: "최근 3개월" },
  { id: "year", label: "최근 1년" },
  { id: "all", label: "전체" },
  { id: "custom", label: "직접 입력" },
];

const padDatePart = (value: number): string => String(value).padStart(2, "0");

// UTC 변환으로 날짜가 하루 바뀌지 않도록 현재 지역의 연·월·일을 직접 조합합니다.
const formatLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

// 월말에서 한 달을 뺄 때 3월 31일이 3월로 되돌아오는 문제를 막고 대상 월의 마지막 날에 맞춥니다.
const subtractMonths = (date: Date, monthCount: number): Date => {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - monthCount);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
};

export function TimeOrbitDateRangePicker({
  startDate,
  endDate,
  onRangeChange,
}: TimeOrbitDateRangePickerProps): React.JSX.Element {
  // 처음 전달된 전체 데이터 기간은 사용자가 다른 프리셋을 거친 뒤에도 `전체` 버튼으로 복원할 수 있게 보관합니다.
  const initialRange = useRef({ startDate, endDate });
  const [activePreset, setActivePreset] = useState<DatePreset>("all");

  // 사용자가 고른 기간을 오늘 기준으로 계산하고 부모의 분석 날짜 State에 한 번에 전달합니다.
  const selectPreset = (preset: DatePreset): void => {
    setActivePreset(preset);
    if (preset === "custom") return;
    if (preset === "all") {
      onRangeChange(
        initialRange.current.startDate,
        initialRange.current.endDate,
        preset,
      );
      return;
    }

    const today = new Date();
    const start = new Date(today);
    if (preset === "week") start.setDate(today.getDate() - 7);
    if (preset === "month") start.setTime(subtractMonths(today, 1).getTime());
    if (preset === "3months") start.setTime(subtractMonths(today, 3).getTime());
    if (preset === "year") start.setTime(subtractMonths(today, 12).getTime());
    onRangeChange(formatLocalDate(start), formatLocalDate(today), preset);
  };

  const updateManualDate = (
    boundary: "start" | "end",
    value: string,
  ): void => {
    setActivePreset("custom");
    onRangeChange(
      boundary === "start" ? value : startDate,
      boundary === "end" ? value : endDate,
      "custom",
    );
  };

  return (
    <section
      className="flex w-full flex-col gap-2.5 rounded-2xl border border-[#2a2e3d] bg-[#1a1d26]/90 p-3.5 shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4"
      aria-label="분석 기간 선택"
    >
      <div className="scrollbar-hidden flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
        {PRESET_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => selectPreset(option.id)}
            aria-pressed={activePreset === option.id}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${activePreset === option.id ? "bg-[#e5a93c] font-bold text-white shadow-sm" : "bg-[#0f1117] text-[#9ca3af] hover:bg-white/10 hover:text-white"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div
        className={`flex shrink-0 items-center justify-center gap-2 rounded-xl border bg-[#0f1117] px-3.5 py-2 text-xs text-[#d1d5db] transition-colors sm:text-sm ${activePreset === "custom" ? "border-[#e5a93c] shadow-[0_0_0_1px_rgb(229_169_60/0.2)]" : "border-[#2a2e3d]"}`}
      >
        <span className="text-base text-[#e5a93c]" aria-hidden="true">
          📅
        </span>
        <label className="min-w-0">
          <span className="sr-only">시작일</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => updateManualDate("start", event.target.value)}
            className="native-date-input w-[6.8rem] cursor-pointer bg-transparent text-xs text-white outline-none sm:w-[8.6rem] sm:text-sm"
          />
        </label>
        <span className="font-semibold text-[#6b7280]" aria-hidden="true">
          ~
        </span>
        <label className="min-w-0">
          <span className="sr-only">종료일</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => updateManualDate("end", event.target.value)}
            className="native-date-input w-[6.8rem] cursor-pointer bg-transparent text-xs text-white outline-none sm:w-[8.6rem] sm:text-sm"
          />
        </label>
      </div>
    </section>
  );
}
