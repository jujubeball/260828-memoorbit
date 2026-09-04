"use client";

import { useRef, type MouseEvent } from "react";

interface DateInputBoxProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DateInputBox({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: DateInputBoxProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  // 달력 버튼은 별도 모달을 만들지 않고 브라우저의 네이티브 피커를 직접 열어 페이지 스크롤 상태에 영향을 주지 않습니다.
  const openCalendar = (): void => {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  };

  const clearDate = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onChange("");
  };

  return (
    <div
      className={`inline-flex h-9 w-[8.5rem] min-w-0 shrink items-center rounded-lg border border-[#2a2e3d] bg-[#0f1117] pl-2 text-xs sm:w-36 ${disabled ? "cursor-not-allowed" : "cursor-pointer focus-within:border-[#e5a93c]"}`}
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
        className="native-date-input min-w-0 flex-1 cursor-inherit bg-transparent text-xs text-[#f3f4f6] outline-none disabled:cursor-not-allowed"
      />
      {value && (
        <button
          type="button"
          onClick={clearDate}
          disabled={disabled}
          className="flex h-full w-7 shrink-0 items-center justify-center text-[#9ca3af] hover:text-white disabled:cursor-not-allowed"
          aria-label={`${label} 지우기`}
        >
          ✕
        </button>
      )}
      <button
        type="button"
        onClick={openCalendar}
        disabled={disabled}
        className="flex h-full w-8 shrink-0 items-center justify-center border-l border-[#2a2e3d] text-sm text-[#ffc86b] disabled:cursor-not-allowed"
        aria-label={`${label} 달력 열기`}
      >
        📅
      </button>
    </div>
  );
}
