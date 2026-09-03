"use client";

import { useState } from "react";
import type { MemoFilterOptions } from "@/src/lib/filterMemos";

interface SearchFilterBarProps {
  options: MemoFilterOptions;
  availableTags: string[];
  onOptionsChange: (options: MemoFilterOptions) => void;
}

const TIME_PRESETS: Array<{
  value: NonNullable<MemoFilterOptions["timePreset"]>;
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "week", label: "이번 주" },
  { value: "month", label: "이번 달" },
  { value: "3months", label: "최근 3개월" },
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
}: SearchFilterBarProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedTags = options.tags ?? [];

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

  const toggleBooleanFilter = (
    key: "hasImage" | "hasTable" | "isPinned",
  ): void => {
    updateOptions({ [key]: options[key] === true ? undefined : true });
  };

  return (
    <section
      className="mb-6 rounded-2xl border border-[#2a2e3d] bg-[#1a1d26]/80 p-3 shadow-[0_14px_34px_rgb(0_0_0/0.16)] backdrop-blur-md sm:p-4"
      aria-label="메모 검색 필터"
    >
      <div className="flex items-center gap-2">
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
            onChange={(event) => updateOptions({ keyword: event.target.value })}
            placeholder="제목, 내용, 태그 검색"
            className="h-11 w-full rounded-xl border border-[#2a2e3d] bg-[#0f1117] pl-10 pr-3 text-base text-[#f3f4f6] outline-none placeholder:text-[#6b7280] focus:border-[#e5a93c] sm:text-sm"
          />
        </label>

        <button
          type="button"
          role="switch"
          aria-checked={Boolean(options.isSemanticSearch)}
          onClick={() => updateOptions({
            isSemanticSearch: !options.isSemanticSearch,
          })}
          className={`flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors ${
            options.isSemanticSearch
              ? "border-[#e5a93c] bg-[#e5a93c]/15 text-[#ffc86b] shadow-[0_0_18px_rgb(229_169_60/0.16)]"
              : "border-[#2a2e3d] bg-[#0f1117] text-[#9ca3af]"
          }`}
        >
          {options.isSemanticSearch && (
            <span aria-hidden="true">✨</span>
          )}
          AI 검색
        </button>

        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-controls="advanced-search-filters"
          className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-[#2a2e3d] bg-[#0f1117] px-3 text-xs font-bold text-[#f3f4f6] hover:border-[#ffc86b]"
        >
          필터
          <span aria-hidden="true">{isExpanded ? "⌃" : "⌄"}</span>
        </button>
      </div>

      {isExpanded && (
        <div
          id="advanced-search-filters"
          className="mt-4 grid gap-5 border-t border-[#2a2e3d] pt-4"
        >
          <fieldset>
            <div className="flex items-center justify-between gap-3">
              <legend className="text-xs font-bold text-[#f3f4f6]">
                다중 태그
              </legend>
              <div
                className="inline-flex rounded-lg border border-[#2a2e3d] bg-[#0f1117] p-1"
                aria-label="태그 일치 방식"
              >
                {(["AND", "OR"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateOptions({ tagMatchMode: mode })}
                    aria-pressed={(options.tagMatchMode ?? "AND") === mode}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-bold ${
                      (options.tagMatchMode ?? "AND") === mode
                        ? "bg-[#e5a93c] text-[#0f1117]"
                        : "text-[#9ca3af]"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
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
          </fieldset>
        </div>
      )}
    </section>
  );
}
