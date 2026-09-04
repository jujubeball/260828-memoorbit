"use client";

import { useRef, useState } from "react";
import { DateInputBox } from "@/src/components/DateInputBox";

export type DatePreset =
  | "week"
  | "month"
  | "3months"
  | "year"
  | "all"
  | "custom";

interface TimeOrbitDateSelectorProps {
  startDate: string;
  endDate: string;
  onRangeChange: (
    startDate: string,
    endDate: string,
    preset: DatePreset,
  ) => void;
}

const PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "week", label: "1주일" },
  { id: "month", label: "1개월" },
  { id: "3months", label: "3개월" },
  { id: "year", label: "1년" },
  { id: "all", label: "전체" },
  { id: "custom", label: "직접 입력" },
];

const padDatePart = (value: number): string => String(value).padStart(2, "0");

const formatLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

// 월말과 윤년에서도 기간 프리셋이 다음 달로 밀리지 않도록 대상 월의 마지막 날짜에 맞춥니다.
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

export function TimeOrbitDateSelector({
  startDate,
  endDate,
  onRangeChange,
}: TimeOrbitDateSelectorProps): React.JSX.Element {
  // 처음 받은 전체 메모 기간과 현재 프리셋을 보관해 `전체` 복원과 날짜 입력 잠금을 함께 제어합니다.
  const initialRange = useRef({ startDate, endDate });
  const [activePreset, setActivePreset] = useState<DatePreset>("all");
  const isCustomMode = activePreset === "custom";

  // 프리셋을 누르면 오늘과 계산된 시작일을 부모 State로 전달하고, 직접 입력은 값 변경 없이 입력만 활성화합니다.
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

  return (
    <section
      className="scrollbar-hidden flex w-full items-center gap-2 overflow-x-auto rounded-2xl border border-[#2a2e3d] bg-[#1a1d26]/90 p-3 shadow-lg lg:p-4"
      aria-label="분석 기간 선택"
    >
      <div className="grid w-[17rem] shrink-0 grid-cols-6 gap-1 sm:w-auto sm:flex sm:items-center">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => selectPreset(preset.id)}
            aria-pressed={activePreset === preset.id}
            className={`min-w-0 rounded-lg px-1 py-1.5 text-center text-[10px] font-medium whitespace-nowrap transition-colors sm:text-xs lg:px-3 ${activePreset === preset.id ? "bg-[#e5a93c] font-bold text-white shadow-sm" : "bg-[#0f1117] text-[#9ca3af] hover:bg-white/10 hover:text-white"}`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div
        className={`ml-2 inline-flex shrink-0 items-center gap-1.5 transition-opacity ${isCustomMode ? "cursor-pointer opacity-100" : "pointer-events-none cursor-not-allowed select-none opacity-40"}`}
      >
        <DateInputBox
          id="timeline-start"
          label="시작일"
          value={startDate}
          onChange={(value) => onRangeChange(value, endDate, "custom")}
          disabled={!isCustomMode}
        />
        <span className="shrink-0 text-xs font-semibold text-[#6b7280]" aria-hidden="true">
          ~
        </span>
        <DateInputBox
          id="timeline-end"
          label="종료일"
          value={endDate}
          onChange={(value) => onRangeChange(startDate, value, "custom")}
          disabled={!isCustomMode}
        />
      </div>
    </section>
  );
}
