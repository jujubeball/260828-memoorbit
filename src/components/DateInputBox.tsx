"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CustomDatePickerPopover } from "@/src/components/CustomDatePickerPopover";

interface DateInputBoxProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  popoverAlign?: "left" | "right";
}

export function DateInputBox({
  id,
  label,
  value,
  onChange,
  disabled = false,
  placeholder = "년-월-일",
  popoverAlign = "left",
}: DateInputBoxProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // 달력 버튼은 같은 입력 박스에 연결된 커스텀 팝업만 열어 브라우저별 기본 피커 디자인 차이를 없앱니다.
  const openCalendar = (): void => {
    if (disabled) return;
    setIsOpen((current) => !current);
  };

  useEffect(() => {
    if (!isOpen) return;
    const closeCalendar = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeCalendar);
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeCalendar);
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [isOpen]);

  const clearDate = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onChange("");
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex h-9 w-[8.5rem] min-w-0 shrink items-center overflow-visible rounded-xl border border-[#2a2e3d] bg-[#161922] text-xs transition-colors sm:w-36 ${disabled ? "pointer-events-none cursor-not-allowed opacity-40" : "cursor-pointer hover:border-[#3b4054]"}`}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
      <button
        type="button"
        onClick={openCalendar}
        disabled={disabled}
        className="min-w-0 flex-1 truncate px-2 text-left disabled:cursor-not-allowed sm:px-3"
        aria-label={`${label} 달력 열기`}
      >
        <span className={value ? "font-medium text-white" : "text-[#6b7280]"}>
          {value || placeholder}
        </span>
      </button>
      <div className="z-10 flex h-full shrink-0 items-center border-l border-[#2a2e3d] bg-[#121318] px-1">
        {value && !disabled && (
          <button
            type="button"
            onClick={clearDate}
            className="flex h-full w-6 items-center justify-center text-xs text-[#9ca3af] hover:text-white"
            aria-label={`${label} 지우기`}
            title="날짜 초기화"
          >
            ✕
          </button>
        )}
        <button
          type="button"
          onClick={openCalendar}
          disabled={disabled}
          className="flex h-full w-7 items-center justify-center text-sm text-[#e5a93c] disabled:cursor-not-allowed"
          aria-label={`${label} 달력 열기`}
        >
        📅
      </button>
      </div>
      {isOpen && (
        <CustomDatePickerPopover
          value={value}
          align={popoverAlign}
          onSelect={(nextValue) => {
            onChange(nextValue);
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}
