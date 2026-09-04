"use client";

import { useState } from "react";
import { ResponsiveDatePicker } from "@/src/components/ResponsiveDatePicker";
import type { MemoFilterOptions } from "@/src/lib/filterMemos";

interface SearchFilterBarProps {
  options: MemoFilterOptions;
  availableTags: string[];
  onOptionsChange: (options: MemoFilterOptions) => void;
  onCreateMemo: () => void;
}

const TIME_PRESETS: Array<{
  value: NonNullable<MemoFilterOptions["timePreset"]>;
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "week", label: "이번 주" },
  { value: "month", label: "이번 달" },
  { value: "3months", label: "최근 3개월" },
  { value: "custom", label: "직접 입력" },
];

const TAG_MATCH_MODES: Array<{
  value: NonNullable<MemoFilterOptions["tagMatchMode"]>;
  label: string;
}> = [
  { value: "AND", label: "모두 포함" },
  { value: "OR", label: "하나라도 포함" },
];

const chipClass = (isActive: boolean): string =>
  `rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
    isActive
      ? "border-[#e5a93c] bg-[#e5a93c] text-[#0f1117]"
      : "border-[#2a2e3d] bg-[#1a1d26] text-[#9ca3af] hover:border-[#ffc86b] hover:text-[#f3f4f6]"
  }`;

export function SearchFilterBar({
  options,
  availableTags,
  onOptionsChange,
  onCreateMemo,
}: SearchFilterBarProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedTags = options.tags ?? [];
  const areAllTagsSelected = availableTags.length > 0
    && availableTags.every((tag) => selectedTags.includes(tag));
  const areAllMediaFiltersSelected = options.hasImage === true
    && options.hasTable === true
    && options.isPinned === true;
  const activeFilterCount = selectedTags.length
    + ((options.timePreset ?? "all") !== "all" ? 1 : 0)
    + (options.hasImage === true ? 1 : 0)
    + (options.hasTable === true ? 1 : 0)
    + (options.isPinned === true ? 1 : 0);

  // 사용자가 입력하거나 칩을 누를 때 기존 조건을 복사하고 바뀐 값만 덮어써서 부모의 filterOptions State로 돌려보냅니다.
  const updateOptions = (changes: Partial<MemoFilterOptions>): void => {
    onOptionsChange({ ...options, ...changes });
  };

  const toggleTag = (tag: string): void => {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((selectedTag) => selectedTag !== tag)
      : [...selectedTags, tag];
    updateOptions({ tags: nextTags });
  };

  const toggleAllTags = (): void => {
    updateOptions({ tags: areAllTagsSelected ? [] : [...availableTags] });
  };

  const toggleBooleanFilter = (
    key: "hasImage" | "hasTable" | "isPinned",
  ): void => {
    updateOptions({ [key]: options[key] === true ? undefined : true });
  };

  const toggleAllMediaFilters = (): void => {
    const nextValue = areAllMediaFiltersSelected ? undefined : true;
    updateOptions({
      hasImage: nextValue,
      hasTable: nextValue,
      isPinned: nextValue,
    });
  };

  const updateCustomDateRange = (
    key: "start" | "end",
    value: string,
  ): void => {
    updateOptions({
      timePreset: "custom",
      customDateRange: {
        ...options.customDateRange,
        [key]: value || undefined,
      },
    });
  };

  return (
    <section
      className="sm:mb-6 sm:rounded-2xl sm:border sm:border-[#2a2e3d] sm:bg-[#1a1d26]/80 sm:p-4 sm:shadow-[0_14px_34px_rgb(0_0_0/0.16)] sm:backdrop-blur-md"
      aria-label="메모 검색 필터"
    >
      <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#2a2e3d] bg-[#1a1d26]/95 p-1.5 shadow-2xl backdrop-blur-lg sm:static sm:w-auto sm:max-w-none sm:translate-x-0 sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">메모 검색어</span>
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[#9ca3af]"
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="search"
            value={options.keyword ?? ""}
            onChange={(event) => updateOptions({
              keyword: event.target.value,
              isSemanticSearch: true,
            })}
            placeholder="제목, 내용, 태그 또는 의미 검색..."
            className="h-9 w-full rounded-full border-0 bg-transparent pl-9 pr-2 text-base text-[#f3f4f6] outline-none placeholder:text-[#6b7280] focus:ring-1 focus:ring-[#e5a93c] sm:h-11 sm:rounded-xl sm:border sm:border-[#2a2e3d] sm:bg-[#0f1117] sm:pl-10 sm:pr-3 sm:text-sm"
          />
        </label>

        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-controls="advanced-search-filters"
          className={`flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors sm:h-11 sm:rounded-xl sm:px-3 ${isExpanded || activeFilterCount > 0 ? "border-[#ffc86b] bg-[#e5a93c] text-white" : "border-[#2a2e3d] bg-[#0f1117] text-[#d1d5db]"}`}
        >
          <span aria-hidden="true">⚙️</span>
          필터
          {activeFilterCount > 0 && (
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-[#b77912]">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onCreateMemo}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e5a93c] text-xl font-bold leading-none text-white shadow-lg transition-colors hover:bg-[#ffc86b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc86b] sm:hidden"
          aria-label="새 메모 작성"
        >
          +
        </button>
      </div>

      {isExpanded && (
        <div
          id="advanced-search-filters"
          className="fixed inset-x-4 bottom-20 z-40 mx-auto grid max-h-[65dvh] max-w-md gap-3 overflow-y-auto rounded-2xl border border-[#2a2e3d] bg-[#1a1d26] p-3.5 shadow-2xl sm:static sm:mt-4 sm:max-h-none sm:max-w-none sm:gap-5 sm:overflow-visible sm:rounded-none sm:border-x-0 sm:border-b-0 sm:bg-transparent sm:p-0 sm:pt-4 sm:shadow-none"
        >
          <div className="flex items-center justify-between border-b border-[#2a2e3d] pb-2 sm:hidden">
            <span className="text-xs font-bold text-[#e5a93c]">상세 필터</span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-xs text-[#9ca3af] hover:text-white"
            >
              닫기 ✕
            </button>
          </div>
          <p className="rounded-lg border border-[#2a2e3d] bg-[#0f1117]/50 p-2 text-[11px] leading-relaxed text-[#9ca3af]">
            ✨ 단어가 정확히 일치하지 않아도 문맥과 의미를 분석하여 메모를 찾습니다.
          </p>
          <fieldset>
            <legend className="sr-only">
              다중 태그
            </legend>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[#f3f4f6]">
                다중 태그
              </span>
              <div
                className="inline-flex rounded-lg border border-[#2a2e3d] bg-[#0f1117] p-1"
                aria-label="태그 일치 방식"
              >
                {TAG_MATCH_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => updateOptions({
                      tagMatchMode: mode.value,
                    })}
                    aria-pressed={
                      (options.tagMatchMode ?? "AND") === mode.value
                    }
                    className={`rounded-md px-3 py-1.5 text-[11px] font-bold ${
                      (options.tagMatchMode ?? "AND") === mode.value
                        ? "bg-[#e5a93c] text-[#0f1117]"
                        : "text-[#9ca3af]"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              <button
                type="button"
                onClick={toggleAllTags}
                aria-pressed={areAllTagsSelected}
                disabled={availableTags.length === 0}
                className={`${chipClass(areAllTagsSelected)} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                전체
              </button>
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={selectedTags.includes(tag)}
                  className={chipClass(selectedTags.includes(tag))}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-[#f3f4f6]">
              미디어 및 상태
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAllMediaFilters}
                aria-pressed={areAllMediaFiltersSelected}
                className={chipClass(areAllMediaFiltersSelected)}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => toggleBooleanFilter("hasImage")}
                aria-pressed={options.hasImage === true}
                className={chipClass(options.hasImage === true)}
              >
                📷 사진 포함
              </button>
              <button
                type="button"
                onClick={() => toggleBooleanFilter("hasTable")}
                aria-pressed={options.hasTable === true}
                className={chipClass(options.hasTable === true)}
              >
                📊 표 포함
              </button>
              <button
                type="button"
                onClick={() => toggleBooleanFilter("isPinned")}
                aria-pressed={options.isPinned === true}
                className={chipClass(options.isPinned === true)}
              >
                📌 고정됨
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-[#f3f4f6]">
              시간 범위
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => updateOptions({ timePreset: preset.value })}
                  aria-pressed={(options.timePreset ?? "all") === preset.value}
                  className={chipClass(
                    (options.timePreset ?? "all") === preset.value,
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {options.timePreset === "custom" && (
              <div className="filter-range-enter mt-4 grid gap-3 rounded-xl border border-[#2a2e3d] bg-[#0f1117]/70 p-3 sm:grid-cols-2">
                <ResponsiveDatePicker
                  id="search-filter-start-date"
                  label="시작일"
                  value={options.customDateRange?.start ?? ""}
                  onChange={(value) => updateCustomDateRange("start", value)}
                />
                <ResponsiveDatePicker
                  id="search-filter-end-date"
                  label="종료일"
                  value={options.customDateRange?.end ?? ""}
                  onChange={(value) => updateCustomDateRange("end", value)}
                />
              </div>
            )}
          </fieldset>
        </div>
      )}
    </section>
  );
}
