"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ListSearchDock } from "@/src/components/ListSearchDock";
import { DateInputBox } from "@/src/components/DateInputBox";
import { usePageScrollLock } from "@/src/hooks/usePageScrollLock";
import type { MemoFilterOptions } from "@/src/lib/filterMemos";

interface SearchFilterBarProps {
  options: MemoFilterOptions;
  availableTags: string[];
  onOptionsChange: (options: MemoFilterOptions) => void;
  onCreateMemo: () => void;
  hideMobileDock?: boolean;
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
  hideMobileDock = false,
}: SearchFilterBarProps): React.JSX.Element {
  // 검색 입력은 로컬 상태에서 즉시 표시하고 부모에는 타이핑이 멈춘 뒤 전달합니다.
  const [keyword, setKeyword] = useState(options.keyword ?? "");
  const [isExpanded, setIsExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // 태그 검색어와 날짜 교정 안내를 화면 상태로 보관합니다.
  const [tagQuery, setTagQuery] = useState("");
  const [dateNotice, setDateNotice] = useState("");
  const selectedTags = options.tags ?? [];
  const areAllTagsSelected = selectedTags.length === 0;
  const areAllMediaFiltersSelected = options.hasImage === true
    && options.hasTable === true
    && options.isPinned === true;
  const activeFilterCount = selectedTags.length
    + ((options.timePreset ?? "all") !== "all" ? 1 : 0)
    + (options.hasImage === true ? 1 : 0)
    + (options.hasTable === true ? 1 : 0)
    + (options.isPinned === true ? 1 : 0);

  // 💡 [검색 입력 디바운스]
  // 새 글자가 들어오면 이전 예약을 취소하며, 로고 초기화로 컴포넌트가 교체될 때도 예약을 정리합니다.
  const commitKeyword = useEffectEvent(() => {
    if (keyword === (options.keyword ?? "")) return;
    onOptionsChange({ ...options, keyword, isSemanticSearch: true, semanticScores: undefined });
  });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      commitKeyword();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  usePageScrollLock(isExpanded);

  // 💡 [통합 검색 레이어 진입]
  // 하단 검색창과 데스크톱 진입점은 같은 레이어를 열고, 음성 결과가 있으면 검색어에 먼저 반영합니다.
  const openSearchLayer = (nextKeyword?: string): void => {
    if (nextKeyword !== undefined) setKeyword(nextKeyword);
    setIsExpanded(true);
    queueMicrotask(() => searchInputRef.current?.focus({ preventScroll: true }));
  };

  // 부모에서 사용 빈도순으로 받은 태그를 검색하고 기본 화면에는 상위 다섯 개만 표시합니다.
  const matchingTags = availableTags.filter((tag) => tag.toLocaleLowerCase().includes(tagQuery.trim().toLocaleLowerCase()));
  const visibleTags = tagQuery.trim() ? matchingTags : availableTags.slice(0, 5);
  const filterSummary = [
    selectedTags.length ? `태그 ${selectedTags.length}개` : "",
    options.hasImage ? "사진 포함" : "",
    options.hasTable ? "표 포함" : "",
    options.isPinned ? "고정됨" : "",
    (options.timePreset ?? "all") !== "all" ? "기간 지정" : "",
  ].filter(Boolean).join(", ") || "선택한 조건 없음";

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

  const clearSelectedTags = (): void => {
    updateOptions({ tags: [] });
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
    // 역전된 날짜 범위는 시작일과 같은 날 끝나도록 교정하고 이유를 알려 줍니다.
    const range = { ...options.customDateRange, [key]: value || undefined };
    const reversed = !!(range.start && range.end && range.start > range.end);
    if (reversed) range.end = range.start;
    setDateNotice(reversed ? "종료일을 시작일과 같은 날짜로 맞췄습니다." : "");
    updateOptions({ timePreset: "custom", customDateRange: range });
  };

  // 검색어는 그대로 두고 상세 필터에서 선택한 태그·기간·미디어·상태 조건만 처음 상태로 되돌립니다.
  const resetDetailedFilters = (): void => {
    setTagQuery("");
    setDateNotice("");
    updateOptions({
      tags: [],
      timePreset: "all",
      customDateRange: undefined,
      hasImage: undefined,
      hasTable: undefined,
      isPinned: undefined,
    });
  };

  return (
    <section
      className="relative md:mb-6 md:rounded-2xl md:border md:border-[#2a2e3d] md:bg-[#1a1d26]/80 md:p-4 md:shadow-[0_14px_34px_rgb(0_0_0/0.16)] md:backdrop-blur-md"
      aria-label="메모 검색 필터"
    >
      {selectedTags.length > 0 && (
        <div
          className="scrollbar-hidden flex w-full items-center gap-2 overflow-x-auto py-2 md:hidden"
          aria-label="선택한 태그 필터"
        >
          <span className="shrink-0 text-xs font-semibold text-[#9ca3af]">
            선택 태그
          </span>
          {selectedTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="shrink-0 rounded-full border border-[#e5a93c] bg-[#e5a93c]/15 px-3 py-1.5 text-sm font-semibold text-[#ffc86b]"
              aria-label={`${tag} 태그 필터 해제`}
            >
              #{tag} ✕
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => openSearchLayer()}
        aria-haspopup="dialog"
        aria-controls="advanced-search-filters"
        className="hidden h-11 w-full items-center rounded-xl border border-[#2a2e3d] bg-[#0f1117] px-4 text-left text-sm text-[#9ca3af] md:flex"
      >
        🔍 {keyword || "제목, 내용, 태그 또는 의미 검색..."}
      </button>

      {!hideMobileDock && !isExpanded && (
        <ListSearchDock keyword={keyword} onOpenSearch={openSearchLayer} onCreate={onCreateMemo} />
      )}

      {isExpanded && (
          <div
            id="advanced-search-filters"
            role="dialog"
            aria-modal="true"
            aria-label="통합 검색 및 필터"
            onClick={(event) => event.stopPropagation()}
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
          >
            <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-2 border-b border-slate-800 bg-slate-950/95 px-4 pb-3 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="flex h-11 shrink-0 items-center text-sm font-semibold text-amber-400"
                aria-label="검색 닫기"
              >
                ＜ 취소
              </button>
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">메모 검색어</span>
                <input
                  ref={searchInputRef}
                  type="search"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="제목, 내용, 태그 또는 의미 검색..."
                  className="h-11 w-full rounded-xl bg-slate-800 px-3 text-base text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500"
                />
              </label>
            </div>
            <div className="mx-auto grid w-full max-w-3xl content-start gap-5">
            <section aria-label="선택한 필터" className="flex items-start justify-between gap-3 border-b border-[#2a2e3d] pb-3">
              <div className="min-w-0" aria-live="polite">
                <h3 className="inline-block rounded-full bg-white/5 px-2 py-1 text-xs font-bold text-[#f3f4f6]">
                  선택된 필터 ({activeFilterCount}개)
                </h3>
                <p className="mt-1 text-xs text-[#9ca3af]">{filterSummary}</p>
              </div>
              <button
                type="button"
                onClick={resetDetailedFilters}
                disabled={activeFilterCount === 0}
                className="shrink-0 text-xs font-semibold text-[#ffc86b] disabled:text-[#6b7280]"
              >
                전체 초기화
              </button>
            </section>
            <p className="rounded-lg border border-[#2a2e3d] bg-[#1a1d26]/50 p-2 text-xs leading-relaxed text-[#9ca3af]">
              ✨ 단어가 정확히 일치하지 않아도 문맥과 의미를 분석하여 메모를 찾습니다.
            </p>
            <fieldset>
              <legend className="sr-only">
                다중 태그
              </legend>
              <span className="block text-xs font-bold text-[#f3f4f6]">
                태그 선택
              </span>
              <label className="mt-3 block">
                <span className="sr-only">태그 검색</span>
                <input
                  type="search"
                  value={tagQuery}
                  onChange={(event) => setTagQuery(event.target.value)}
                  placeholder="태그 검색"
                  aria-controls="filter-tag-results"
                  className="h-11 w-full rounded-xl border border-[#2a2e3d] bg-[#0f1117] px-3 text-base outline-none focus:ring-1 focus:ring-[#e5a93c]"
                />
              </label>
              <p className="mt-2 text-xs text-[#9ca3af]" aria-live="polite">
                {tagQuery.trim() ? `검색 결과 ${matchingTags.length}개 · 다시 누르면 선택 해제` : "자주 사용하는 태그 Top 5"}
              </p>
              <div id="filter-tag-results" className={`mt-2 max-h-48 overflow-y-auto overscroll-contain ${tagQuery.trim() ? "grid gap-1 rounded-xl border border-[#2a2e3d] bg-[#1a1d26] p-2" : "flex flex-wrap gap-2"}`}>
                <button
                  type="button"
                  onClick={clearSelectedTags}
                  aria-pressed={areAllTagsSelected}
                  className={chipClass(areAllTagsSelected)}
                >
                  전체
                </button>
                {visibleTags.map((tag) => (
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
                {options.timePreset === "custom" && (
                  <div className="filter-range-enter flex w-full min-w-0 flex-wrap items-center gap-2 border-t border-[#2a2e3d]/60 pt-2">
                    <DateInputBox
                      expanded
                      id="search-filter-start-date"
                      label="시작일"
                      value={options.customDateRange?.start ?? ""}
                      onChange={(value) => updateCustomDateRange("start", value)}
                      popoverAlign="left"
                    />
                    <span
                      className="text-xs font-semibold text-[#6b7280]"
                      aria-hidden="true"
                    >
                      ~
                    </span>
                    <DateInputBox
                      expanded
                      id="search-filter-end-date"
                      label="종료일"
                      value={options.customDateRange?.end ?? ""}
                      onChange={(value) => updateCustomDateRange("end", value)}
                      popoverAlign="right"
                    />
                  </div>
                )}
              </div>
              {options.timePreset === "custom" && dateNotice && (
                <p role="status" className="mt-2 text-xs text-[#ffc86b]">{dateNotice}</p>
              )}
            </fieldset>
            </div>
          </div>
      )}
    </section>
  );
}
