"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePageScrollLock } from "@/src/hooks/usePageScrollLock";

interface ResponsiveDatePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// 달력 머리글을 일요일부터 토요일까지 같은 순서로 반복 표시하기 위한 요일 목록입니다.
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 월과 일이 한 자리일 때 앞에 0을 붙여 날짜 입력 규격을 일정하게 만듭니다.
const pad = (value: number): string => String(value).padStart(2, "0");

// Date 객체를 날짜 입력창과 부모 State가 함께 사용하는 YYYY-MM-DD 문자열로 변환합니다.
const formatDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// 사용자가 입력을 마치면 8자리 숫자를 날짜 형식으로 바꾸고 실제 존재하는 날짜인지 검사합니다.
const parseInput = (value: string): string | null => {
  // 하이픈 없이 입력한 숫자 8자리는 연도·월·일 사이에 하이픈을 자동으로 넣습니다.
  const normalized = /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  // 브라우저가 날짜를 자동 보정했는지 다시 비교하기 위한 임시 날짜 객체입니다.
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) || formatDate(date) !== normalized
    ? null
    : normalized;
};

export function ResponsiveDatePicker({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: ResponsiveDatePickerProps): React.JSX.Element {
  // 💡 [달력 DOM 위치 참조]
  // 입력 영역, PC 팝오버, 모바일 팝업, 포커스 복원 대상을 각각 기억해 외부 클릭과 위치 계산에 사용합니다.
  const pickerRef = useRef<HTMLDivElement>(null);
  const desktopPopoverRef = useRef<HTMLDivElement>(null);
  const mobilePopoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLInputElement>(null);

  // 💡 [날짜 선택 화면 State]
  // 사용자가 타이핑한 값, 팝업 열림 여부, 오류, 표시 월과 PC 팝오버 좌표를 화면에 반영합니다.
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() =>
    value ? new Date(`${value}T00:00:00`) : new Date(),
  );
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
    // Escape 키를 누르면 달력을 닫고 날짜 입력창으로 포커스를 돌려보냅니다.
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
    // 팝오버와 입력창 이외의 영역을 누르면 데스크톱 달력도 자연스럽게 닫습니다.
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (desktopPopoverRef.current?.contains(target)) return;
      if (mobilePopoverRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  usePageScrollLock(isOpen);

  // 💡 [현재 월 날짜 배열 메모이제이션]
  // 표시 월이 바뀔 때만 앞쪽 빈칸과 실제 날짜를 다시 만들어 7열 달력 화면에 전달합니다.
  const days = useMemo(() => {
    // 현재 보고 있는 달력의 연도를 꺼냅니다.
    const year = visibleMonth.getFullYear();
    // 현재 보고 있는 달력의 0부터 시작하는 월 번호를 꺼냅니다.
    const month = visibleMonth.getMonth();
    // 첫째 날의 요일만큼 빈칸을 만들기 위한 개수입니다.
    const firstDay = new Date(year, month, 1).getDay();
    // 다음 달 0일을 이용해 현재 달의 마지막 날짜를 계산합니다.
    const lastDate = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from(
        { length: lastDate },
        (_, index) => new Date(year, month, index + 1),
      ),
    ];
  }, [visibleMonth]);

  const commitInput = (): void => {
    // 사용자가 입력창을 벗어나거나 Enter를 누르면 값을 검증해 부모의 시작일·종료일 State로 전달합니다.
    if (!inputValue) {
      setError("");
      onChange("");
      return;
    }
    // 직접 입력한 문자열을 검증하고 정규화한 최종 날짜입니다.
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
    // 닫기 전에 팝업 내부 포커스를 해제하고 원래 날짜 입력창으로 포커스를 복원합니다.
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const togglePicker = (): void => {
    // 달력을 열기 직전에 입력 영역 위치를 측정해 PC 팝오버가 바로 아래에 나타나게 합니다.
    if (!isOpen) updatePopoverPosition();
    setIsOpen((current) => !current);
  };

  // PC 팝오버와 모바일 모달이 똑같이 사용하는 달력 본체 JSX입니다.
  const calendar = (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setVisibleMonth(
              (current) =>
                new Date(current.getFullYear(), current.getMonth() - 1, 1),
            )
          }
          className="glass-icon-button"
          aria-label="이전 달"
        >
          ‹
        </button>
        <strong>
          {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
        </strong>
        <button
          type="button"
          onClick={() =>
            setVisibleMonth(
              (current) =>
                new Date(current.getFullYear(), current.getMonth() + 1, 1),
            )
          }
          className="glass-icon-button"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="py-1 text-xs text-[#9ca3af]">
            {weekday}
          </span>
        ))}
        {days.map((date, index) =>
          date ? (
            <button
              key={formatDate(date)}
              type="button"
              onClick={() => {
                const nextValue = formatDate(date);
                onChange(nextValue);
                setInputValue(nextValue);
                setError("");
                closePicker();
              }}
              aria-pressed={value === formatDate(date)}
              className={`aspect-square rounded-lg text-sm ${value === formatDate(date) ? "bg-[#e5a93c] font-bold text-[#0f1117]" : "hover:bg-white/10"}`}
            >
              {date.getDate()}
            </button>
          ) : (
            <span key={`empty-${index}`} />
          ),
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={pickerRef}
      className={`relative z-0 grid gap-2 ${disabled ? "cursor-not-allowed" : ""}`}
      aria-disabled={disabled}
    >
      <label htmlFor={id} className="text-xs font-semibold text-[#f3f4f6] sm:text-sm">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-[#2a2e3d] bg-[#1a1d26]/80 focus-within:border-[#e5a93c]">
        <input
          ref={triggerRef}
          id={id}
          disabled={disabled}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onBlur={commitInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitInput();
          }}
          placeholder="YYYY-MM-DD"
          inputMode="numeric"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-[#f3f4f6] outline-none disabled:cursor-not-allowed sm:px-4 sm:text-base"
        />
        {inputValue && (
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setInputValue("");
              setError("");
              onChange("");
            }}
            className="px-3 text-[#9ca3af]"
            aria-label={`${label} 지우기`}
          >
            ×
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={togglePicker}
          className="flex h-full items-center justify-center border-l border-[#2a2e3d] px-2 text-[#ffc86b] disabled:cursor-not-allowed sm:px-3"
          aria-label={`${label} 달력 열기`}
          aria-expanded={isOpen}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 2v4M16 2v4M3 9h18" />
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
          </svg>
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-[#ff6961]">
          {error}
        </p>
      )}
      {isOpen &&
        createPortal(
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
                  <button
                    type="button"
                    onClick={closePicker}
                    className="glass-icon-button"
                    aria-label="달력 닫기"
                  >
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
