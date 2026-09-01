"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface ResponsiveDatePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (value: number): string => String(value).padStart(2, "0");
const formatDate = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseInput = (value: string): string | null => {
  const normalized = /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) || formatDate(date) !== normalized ? null : normalized;
};

export function ResponsiveDatePicker({ id, label, value, onChange }: ResponsiveDatePickerProps): React.JSX.Element {
  const triggerRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => value ? new Date(`${value}T00:00:00`) : new Date());

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: lastDate }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [visibleMonth]);

  const commitInput = (): void => {
    if (!inputValue) {
      setError("");
      onChange("");
      return;
    }
    const parsed = parseInput(inputValue);
    if (!parsed) {
      setError("YYYY-MM-DD 또는 숫자 8자리로 입력하세요.");
      return;
    }
    setError("");
    setInputValue(parsed);
    onChange(parsed);
    setVisibleMonth(new Date(`${parsed}T00:00:00`));
  };

  const closePicker = (): void => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const calendar = (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="glass-icon-button" aria-label="이전 달">‹</button>
        <strong>{visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월</strong>
        <button type="button" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="glass-icon-button" aria-label="다음 달">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((weekday) => <span key={weekday} className="py-1 text-xs text-[#9ca3af]">{weekday}</span>)}
        {days.map((date, index) => date ? (
          <button key={formatDate(date)} type="button" onClick={() => { const nextValue = formatDate(date); onChange(nextValue); setInputValue(nextValue); setError(""); closePicker(); }} aria-pressed={value === formatDate(date)} className={`aspect-square rounded-lg text-sm ${value === formatDate(date) ? "bg-[#e5a93c] font-bold text-[#0f1117]" : "hover:bg-white/10"}`}>{date.getDate()}</button>
        ) : <span key={`empty-${index}`} />)}
      </div>
    </div>
  );

  return (
    <div className={`relative grid gap-2 ${isOpen ? "z-[100]" : "z-0"}`}>
      <label htmlFor={id} className="text-sm font-semibold text-[#f3f4f6]">{label}</label>
      <div className="flex rounded-xl border border-[#2a2e3d] bg-[#1a1d26]/80 focus-within:border-[#e5a93c]">
        <input ref={triggerRef} id={id} value={inputValue} onChange={(event) => setInputValue(event.target.value)} onBlur={commitInput} onKeyDown={(event) => { if (event.key === "Enter") commitInput(); }} placeholder="YYYY-MM-DD" inputMode="numeric" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[#f3f4f6] outline-none" />
        {inputValue && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setInputValue(""); setError(""); onChange(""); }} className="px-3 text-[#9ca3af]" aria-label={`${label} 지우기`}>×</button>}
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setIsOpen((current) => !current)} className="border-l border-[#2a2e3d] px-3 text-[#ffc86b]" aria-label={`${label} 달력 열기`} aria-expanded={isOpen}>▦</button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-[#ff6961]">{error}</p>}
      {isOpen && (
        <>
          <div className="pointer-events-auto absolute left-0 top-full z-[100] mt-2 hidden w-80 rounded-2xl border border-[#2a2e3d] bg-[#1a1d26]/95 p-4 text-[#f3f4f6] shadow-2xl backdrop-blur-md xl:block" role="dialog" aria-label={`${label} 달력`}>{calendar}</div>
          <div className="pointer-events-auto fixed inset-0 z-[200] flex items-end bg-black/60 p-4 xl:hidden" role="dialog" aria-modal="true" aria-label={`${label} 달력`}><div className="w-full rounded-3xl border border-[#2a2e3d] bg-[#1a1d26]/95 p-5 text-[#f3f4f6] shadow-2xl backdrop-blur-md"><div className="mb-4 flex justify-between"><strong>{label}</strong><button type="button" onClick={closePicker} className="glass-icon-button" aria-label="달력 닫기">×</button></div>{calendar}</div></div>
        </>
      )}
    </div>
  );
}
