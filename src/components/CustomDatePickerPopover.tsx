"use client";

import { useMemo, useState } from "react";

interface CustomDatePickerPopoverProps {
  value: string;
  align?: "left" | "right";
  onSelect: (value: string) => void;
}

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

const padDatePart = (value: number): string => String(value).padStart(2, "0");

const formatDate = (date: Date): string =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const parseDate = (value: string): Date => {
  const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export function CustomDatePickerPopover({
  value,
  align = "left",
  onSelect,
}: CustomDatePickerPopoverProps): React.JSX.Element {
  const [visibleMonth, setVisibleMonth] = useState(() => parseDate(value));

  // 표시 중인 달의 첫 요일을 월요일 기준으로 바꾸고 앞쪽 빈칸과 실제 날짜를 7열 달력용 배열로 만듭니다.
  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const leadingEmptyCount = (new Date(year, month, 1).getDay() + 6) % 7;
    const lastDate = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: leadingEmptyCount }, () => null),
      ...Array.from(
        { length: lastDate },
        (_, index) => new Date(year, month, index + 1),
      ),
    ];
  }, [visibleMonth]);

  const moveMonth = (offset: number): void => {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  };

  return (
    <div
      className={`absolute top-full z-50 mt-2 w-[280px] rounded-2xl border border-[#2a2e3d] bg-[#1e2029] p-4 text-[#f3f4f6] shadow-2xl ${align === "right" ? "right-0" : "left-0"}`}
      role="dialog"
      aria-label="날짜 선택 달력"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2a2e3d] text-[#d1d5db] hover:text-white"
          aria-label="이전 달"
        >
          ‹
        </button>
        <strong className="text-sm font-bold text-white">
          {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
        </strong>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2a2e3d] text-[#d1d5db] hover:text-white"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 place-items-center gap-y-1">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="py-1 text-center text-xs text-[#9ca3af]">
            {weekday}
          </span>
        ))}
        {days.map((date, index) =>
          date ? (
            <button
              key={formatDate(date)}
              type="button"
              onClick={() => onSelect(formatDate(date))}
              aria-pressed={value === formatDate(date)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${value === formatDate(date) ? "bg-[#e5a93c] font-bold text-[#121318] shadow-md" : "text-[#e5e7eb] hover:bg-[#2a2e3d]"}`}
            >
              {date.getDate()}
            </button>
          ) : (
            <span key={`empty-${index}`} className="h-8 w-8" />
          ),
        )}
      </div>
    </div>
  );
}
