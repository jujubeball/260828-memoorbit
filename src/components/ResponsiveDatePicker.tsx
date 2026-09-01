"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const pickerRef = useRef<HTMLDivElement>(null);
  const desktopPopoverRef = useRef<HTMLDivElement>(null);
  const mobilePopoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => value ? new Date(`${value}T00:00:00`) : new Date());
  const [popoverPosition, setPopoverPosition] = useState({ left: 0, top: 0 });

  // 💡 [달력 위치 계산]
  // 달력은 카드의 z-index에 갇히지 않도록 body에 렌더링하므로, 입력 필드의 화면 좌표를 읽어 바로 아래 위치를 계산합니다.
  const updatePopoverPosition = useCallback((): void => {
    const rect = pickerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPopoverPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
      top: rect.bottom + 8,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    };
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [isOpen, updatePopoverPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (desktopPopoverRef.current?.contains(target)) return;
      if (mobilePopoverRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
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

  const togglePicker = (): void => {
    if (!isOpen) updatePopoverPosition();
    setIsOpen((current) => !current);
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
    <div ref={pickerRef} className="relative z-0 grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-[#f3f4f6]">{label}</label>
      <div className="flex rounded-xl border border-[#2a2e3d] bg-[#1a1d26]/80 focus-within:border-[#e5a93c]">
        <input ref={triggerRef} id={id} value={inputValue} onChange={(event) => setInputValue(event.target.value)} onBlur={commitInput} onKeyDown={(event) => { if (event.key === "Enter") commitInput(); }} placeholder="YYYY-MM-DD" inputMode="numeric" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[#f3f4f6] outline-none" />
        {inputValue && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setInputValue(""); setError(""); onChange(""); }} className="px-3 text-[#9ca3af]" aria-label={`${label} 지우기`}>×</button>}
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={togglePicker} className="border-l border-[#2a2e3d] px-3 text-[#ffc86b]" aria-label={`${label} 달력 열기`} aria-expanded={isOpen}>▦</button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-[#ff6961]">{error}</p>}
      {isOpen && createPortal(
        <>
          <div
            ref={desktopPopoverRef}
            className="pointer-events-auto fixed z-50 hidden w-80 rounded-2xl border border-[#2a2e3d] bg-[#1a1d26]/95 p-4 text-[#f3f4f6] shadow-2xl backdrop-blur-md xl:block"
            style={popoverPosition}
            role="dialog"
            aria-label={`${label} 달력`}
          >
            {calendar}
          </div>
          <div
            ref={mobilePopoverRef}
            className="pointer-events-auto fixed inset-0 z-50 flex items-end bg-black/60 p-4 xl:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={`${label} 달력`}
            onClick={closePicker}
          >
            <div
              className="w-full rounded-3xl border border-[#2a2e3d] bg-[#1a1d26]/95 p-5 text-[#f3f4f6] shadow-2xl backdrop-blur-md"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex justify-between">
                <strong>{label}</strong>
                <button type="button" onClick={closePicker} className="glass-icon-button" aria-label="달력 닫기">
                  ×
                </button>
              </div>
              {calendar}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
