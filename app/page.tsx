"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { MemoCard } from "@/src/components/MemoCard";
import {
  MemoryOrbitView,
  type MemoryCandidate,
} from "@/src/components/MemoryOrbitView";
import { MemoModal, type MemoDraft } from "@/src/components/MemoModal";
import { MainContentHeader } from "@/src/components/MainContentHeader";
import { OrbitGraphView } from "@/src/components/OrbitGraphView";
import { TimelineStreamView } from "@/src/components/TimelineStreamView";
import { initialMemos } from "@/src/data/initialMemos";
import { createMemoImageDataUrl } from "@/src/lib/memoImage";
import type { ImageMood, Memo } from "@/types/memo";

interface MemoGroup {
  label: string;
  memos: Memo[];
}

type NavigationSection = "memos" | "orbit" | "timeline";
type MemoViewMode = "list" | "gallery";

const AI_IMAGE_MOODS: ImageMood[] = ["수채화", "네온", "흑백", "빈티지"];
const MEMO_STORAGE_KEY = "memoorbit-memos";
const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_PANEL_WIDTH = 288;

// 💡 [AI 이미지 무드 자동 선택]
// 사용자가 사진을 직접 첨부하지 않아 새 AI 배경이 필요할 때 네 가지 무드 중 하나의 배열 위치를 무작위로 골라 돌려줍니다.
const getRandomMood = (): ImageMood =>
  AI_IMAGE_MOODS[Math.floor(Math.random() * AI_IMAGE_MOODS.length)];

const NAVIGATION_ITEMS: Array<{
  id: NavigationSection;
  icon: string;
  label: string;
  description: string;
}> = [
  { id: "memos", icon: "📂", label: "메모 목록", description: "All Memos" },
  {
    id: "orbit",
    icon: "🌌",
    label: "태그 궤도 탐색",
    description: "Tag Orbit",
  },
  {
    id: "timeline",
    icon: "📊",
    label: "시간 궤도 분석",
    description: "Timeline Stream",
  },
];

const toTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

// 메모의 수정 날짜와 오늘을 비교해 목록에 표시할 날짜 그룹 이름을 결정합니다.
const groupLabel = (iso: string): string => {
  const date = new Date(iso);
  const today = new Date();
  const day = Math.floor(
    (new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86400000,
  );
  if (date.getFullYear() < today.getFullYear())
    return `${date.getFullYear()}년`;
  if (day === 0) return "오늘";
  if (day === 1) return "어제";
  if (day <= 7) return "이전 7일";
  if (day <= 30) return "이전 30일";
  return `${date.getMonth() + 1}월`;
};

const isSameDate = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const selectMemoryCandidate = (memos: Memo[], target: Date): Memo | undefined =>
  memos
    .filter((memo) => isSameDate(new Date(memo.createdAt), target))
    .sort(
      (left, right) =>
        Number(Boolean(right.imageUrl || right.aiImageUrl)) -
          Number(Boolean(left.imageUrl || left.aiImageUrl)) ||
        Number(right.isPinned) - Number(left.isPinned) ||
        right.content.length - left.content.length,
    )[0];

const findMemoryCandidates = (memos: Memo[]): MemoryCandidate[] => {
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const oneHundredDaysAgo = new Date(today);
  oneHundredDaysAgo.setDate(today.getDate() - 100);
  const oneYearMemo = selectMemoryCandidate(memos, oneYearAgo);
  const oneHundredDayMemo = selectMemoryCandidate(memos, oneHundredDaysAgo);

  return [
    ...(oneYearMemo
      ? [{ memo: oneYearMemo, intervalLabel: "1년 전" as const }]
      : []),
    ...(oneHundredDayMemo
      ? [{ memo: oneHundredDayMemo, intervalLabel: "100일 전" as const }]
      : []),
  ];
};

export default function Home(): React.JSX.Element {
  // 💡 [앱의 중심 데이터 State]
  // memos가 실제 메모 원본이고, 나머지 State는 현재 열린 화면·편집 대상·보기 방식을 기억하는 UI 상태입니다.
  const [memos, setMemos] = useState<Memo[]>(initialMemos);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Memo | null>(null);
  const [isPinnedOpen, setIsPinnedOpen] = useState(true);
  const [activeSection, setActiveSection] =
    useState<NavigationSection>("memos");
  const [memoViewMode, setMemoViewMode] = useState<MemoViewMode>("list");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMemoToolbarStuck, setIsMemoToolbarStuck] = useState(false);
  // 💡 [PC 왼쪽 패널 너비 State]
  // panelWidth는 현재 LNB의 실제 너비를 기억하고, isPanelResizing은 사용자가 구분선을 잡고 있는 동안만 마우스 이동을 너비 변경으로 연결합니다.
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isPanelResizing, setIsPanelResizing] = useState(false);
  // 페이지별 콘텐츠 제목이 화면에 들어왔는지는 공통 헤더 관찰기가 갱신하며, 화면 전환 시 관찰 상태를 초기화합니다.
  const [, setIsContentHeaderVisible] = useState(true);

  // 💡 [브라우저 저장소 불러오기]
  // 첫 화면이 열린 뒤 이전 방문에서 저장한 메모를 읽습니다.
  // 저장된 메모 수가 최신 기본 데이터보다 적으면 구버전으로 판단해 200개 기본 데이터로 즉시 교체합니다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedMemos = window.localStorage.getItem(MEMO_STORAGE_KEY);

        if (!storedMemos) {
          window.localStorage.setItem(
            MEMO_STORAGE_KEY,
            JSON.stringify(initialMemos),
          );
          setMemos(initialMemos);
          return;
        }

        const parsedMemos: unknown = JSON.parse(storedMemos);

        // 💡 [구버전 LocalStorage 자동 동기화]
        // 저장된 값이 배열이고 최신 기본 메모보다 적으면 예전 목업 데이터로 보고, 화면과 저장소를 함께 최신 데이터로 맞춥니다.
        if (
          Array.isArray(parsedMemos) &&
          parsedMemos.length >= initialMemos.length
        ) {
          setMemos(parsedMemos as Memo[]);
          return;
        }

        window.localStorage.setItem(
          MEMO_STORAGE_KEY,
          JSON.stringify(initialMemos),
        );
        setMemos(initialMemos);
      } catch {
        // JSON이 깨진 경우에도 잘못된 값을 남겨 두지 않고 최신 기본 데이터로 복구합니다.
        window.localStorage.setItem(
          MEMO_STORAGE_KEY,
          JSON.stringify(initialMemos),
        );
        setMemos(initialMemos);
      } finally {
        setHasHydratedStorage(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // 화면이 1px 이상 움직였는지 기억해 PC 메모 도구 헤더의 테두리와 그림자를 전환합니다.
  useEffect(() => {
    const trackScroll = (): void => setIsMemoToolbarStuck(window.scrollY > 0);
    window.addEventListener("scroll", trackScroll, { passive: true });
    return () => window.removeEventListener("scroll", trackScroll);
  }, []);

  // 💡 [PC 패널 드래그 너비 제한]
  // 화면 왼쪽부터 마우스까지의 거리를 새 너비로 계산하되, 280px보다 작거나 600px보다 커지지 않도록 두 경계 사이에 끼워 넣습니다.
  useEffect(() => {
    if (!isPanelResizing) return;

    const handleMouseMove = (event: MouseEvent): void => {
      const clampedWidth = Math.max(
        MIN_PANEL_WIDTH,
        Math.min(MAX_PANEL_WIDTH, event.clientX),
      );
      setPanelWidth(clampedWidth);
    };
    const handleMouseUp = (): void => setIsPanelResizing(false);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isPanelResizing]);

  // 키보드 사용자는 구분선에 초점을 둔 뒤 방향키로 16px씩 패널 너비를 조절할 수 있으며, 같은 최소·최대 경계를 적용받습니다.
  const handlePanelResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    setPanelWidth((current) =>
      Math.max(
        MIN_PANEL_WIDTH,
        Math.min(MAX_PANEL_WIDTH, current + direction * 16),
      ),
    );
  };

  // memos 배열이 바뀔 때마다 브라우저 저장소에도 같은 배열을 기록해 새로고침 후에도 유지합니다.
  useEffect(() => {
    if (!hasHydratedStorage) return;
    window.localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memos));
  }, [hasHydratedStorage, memos]);

  // 💡 [삭제 확인창 바디 스크롤 잠금]
  // 삭제 확인창이 열려 있을 때만 목록 배경을 고정합니다. 편집기의 잠금은 MemoModal이 직접 관리해 중복 복원을 방지합니다.
  useEffect(() => {
    if (!deleteTarget) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow || "unset";
    };
  }, [deleteTarget]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "n")
        return;
      event.preventDefault();
      setEditingMemo(null);
      setIsEditorOpen(true);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  // 💡 [메모 목록 가공]
  // 원본 배열은 건드리지 않고 복사한 뒤 고정 여부와 최신 수정 시각으로 정렬하고, 화면에 필요한 날짜 그룹을 만듭니다.
  const sorted = useMemo(
    () =>
      [...memos].sort(
        (a, b) =>
          Number(b.isPinned) - Number(a.isPinned) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [memos],
  );
  const pinned = sorted.filter((memo) => memo.isPinned);
  const groups = sorted
    .filter((memo) => !memo.isPinned)
    .reduce<MemoGroup[]>((result, memo) => {
      const label = groupLabel(memo.updatedAt);
      const group = result.find((item) => item.label === label);
      if (!group) return [...result, { label, memos: [memo] }];
      return result.map((item) =>
        item.label === label ? { ...item, memos: [...item.memos, memo] } : item,
      );
    }, []);
  const memoryCandidates = useMemo(() => findMemoryCandidates(memos), [memos]);

  // 편집기를 닫을 때 선택 메모도 비워 다음 새 메모가 이전 내용을 이어받지 않게 합니다.
  const closeEditor = (): void => {
    setIsEditorOpen(false);
    setEditingMemo(null);
  };
  const openMemo = (memo: Memo): void => {
    setEditingMemo(memo);
    setIsEditorOpen(true);
  };
  const selectNavigation = (section: NavigationSection): void => {
    setActiveSection(section);
    setIsContentHeaderVisible(true);
    setIsDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  // 💡 [메모 저장과 자동 저장의 공통 입구]
  // 완료 버튼과 뒤로가기 자동 저장이 모두 이 함수를 사용하며, 기존 메모는 교체하고 새 메모는 목록 맨 앞에 추가합니다.
  const submitMemo = (draft: MemoDraft): void => {
    const now = new Date().toISOString();
    const sourceText = [draft.title, draft.content].filter(Boolean).join("\n");
    const canReuseAiImage =
      !draft.imageUrl &&
      editingMemo?.aiImageSourceText === sourceText &&
      Boolean(editingMemo.aiImageUrl);
    // 본문이 그대로인 기존 AI 이미지는 원래 무드를 유지하고, 새로 생성할 때만 사용자가 보지 않아도 무드를 자동 선택합니다.
    const generatedImageMood = canReuseAiImage
      ? editingMemo?.aiImageMood ?? getRandomMood()
      : getRandomMood();
    const aiImageMood = draft.imageUrl ? undefined : generatedImageMood;
    const aiImageUrl = draft.imageUrl
      ? undefined
      : canReuseAiImage
        ? editingMemo?.aiImageUrl
        : createMemoImageDataUrl(sourceText, generatedImageMood);
    const values = {
      title: draft.title,
      content: draft.content,
      richContent: draft.richContent,
      tags: toTags(draft.tags),
      imageUrl: draft.imageUrl,
      images: draft.images,
      aiImageMood,
      aiImageUrl,
      aiImageSourceText: draft.imageUrl ? undefined : sourceText,
      updatedAt: now,
    };
    // map 대신 새 객체와 filter를 사용해 기존 State를 직접 변경하지 않고 새로운 배열을 만듭니다.
    if (editingMemo) {
      setMemos((current) => [
        { ...editingMemo, ...values },
        ...current.filter((memo) => memo.id !== editingMemo.id),
      ]);
    } else {
      setMemos((current) => [
        { id: crypto.randomUUID(), ...values, createdAt: now, isPinned: false },
        ...current,
      ]);
    }
    closeEditor();
  };
  // 각 Memo 객체를 화면의 MemoCard와 수정·삭제·고정 이벤트에 연결합니다.
  const renderMemo = (memo: Memo): React.JSX.Element => (
    <MemoCard
      key={memo.id}
      memo={memo}
      viewMode={memoViewMode}
      onEdit={openMemo}
      onDelete={setDeleteTarget}
      onTogglePin={(id) =>
        setMemos((current) =>
          current.map((item) =>
            item.id === id ? { ...item, isPinned: !item.isPinned } : item,
          ),
        )
      }
    />
  );

  return (
    <div
      style={{ "--panel-width": `${panelWidth}px` } as CSSProperties}
      className={`min-h-dvh bg-[#0f1117] text-[#f3f4f6] xl:pl-[var(--panel-width)] ${activeSection === "orbit" ? "xl:h-screen xl:overflow-hidden" : ""}`}
    >
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--panel-width)] min-w-[280px] max-w-[600px] border-r border-[#2a2e3d] bg-[#1a1d26]/80 p-5 backdrop-blur-md xl:flex xl:flex-col">
        <button
          type="button"
          onClick={() => selectNavigation("memos")}
          className="rounded-xl px-3 py-4 text-left text-2xl font-bold transition-colors hover:text-[#ffc86b]"
          aria-label="MemoOrbit 메모 목록 홈"
        >
          MemoOrbit
        </button>
        <div className="group/new relative px-2">
          <button
            type="button"
            onClick={() => {
              setEditingMemo(null);
              setIsEditorOpen(true);
            }}
            className="w-full rounded-xl bg-[#e5a93c] px-4 py-3 text-sm font-bold text-[#0f1117] shadow-lg transition-colors hover:bg-[#bd8428] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc86b]"
          >
            + 새 메모 작성
          </button>
          <span
            className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[#2a2e3d] bg-[#0f1117] px-3 py-2 text-xs text-[#9ca3af] opacity-0 shadow-xl transition-opacity group-hover/new:opacity-100 group-focus-within/new:opacity-100"
            role="tooltip"
          >
            단축키 Ctrl/⌘ + N
          </span>
        </div>
        <nav className="mt-5 grid gap-2" aria-label="주요 메뉴">
          {NAVIGATION_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectNavigation(item.id)}
              aria-current={activeSection === item.id ? "page" : undefined}
              className={`flex items-center gap-4 rounded-xl px-4 py-3 text-left transition ${activeSection === item.id ? "bg-[#e5a93c] text-[#0f1117]" : "hover:bg-white/5"}`}
            >
              <span className="text-xl" aria-hidden="true">
                {item.icon}
              </span>
              <span>
                <strong className="block text-sm">{item.label}</strong>
                <small className="mt-0.5 block text-xs opacity-60">
                  {item.description}
                </small>
              </span>
            </button>
          ))}
        </nav>
        <p className="mt-auto px-3 text-xs text-[#8e8e93]">
          생각의 궤도를 기록하고 다시 발견하세요.
        </p>
        {/* 마우스와 키보드가 함께 사용할 수 있는 PC LNB 너비 조절 구분선입니다. */}
        <div
          role="separator"
          tabIndex={0}
          aria-label="왼쪽 메뉴 너비 조절"
          aria-orientation="vertical"
          aria-valuemin={MIN_PANEL_WIDTH}
          aria-valuemax={MAX_PANEL_WIDTH}
          aria-valuenow={panelWidth}
          onMouseDown={() => setIsPanelResizing(true)}
          onKeyDown={handlePanelResizeKeyDown}
          className="absolute inset-y-0 right-0 w-2 translate-x-1/2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-[#2a2e3d] hover:after:bg-[#e5a93c] focus-visible:after:w-0.5 focus-visible:after:bg-[#e5a93c]"
        />
      </aside>

      <header className="sticky top-0 z-30 flex h-12 w-full items-center border-b border-[#2a2e3d] bg-[#0f1117] px-2 xl:hidden">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-[44px_minmax(0,1fr)_44px] items-center">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="ios-tap flex h-11 w-11 items-center justify-center text-2xl"
            aria-label="메뉴 열기"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={() => selectNavigation("memos")}
            className="min-w-0 truncate px-2 text-center text-[17px] font-semibold"
            aria-label="MemoOrbit 메모 목록 홈"
          >
            MemoOrbit
          </button>
          <span className="h-11 w-11" aria-hidden="true" />
        </div>
      </header>
      <main
        className={`mx-auto w-full max-w-full overflow-x-hidden px-4 pb-28 xl:max-w-5xl ${activeSection === "orbit" ? "xl:h-dvh xl:overflow-hidden xl:pb-0" : ""}`}
      >
        {activeSection === "memos" && (
          <>
            <div
              className={`border-b border-transparent bg-[#0f1117] transition-all duration-200 xl:sticky xl:top-0 xl:z-20 xl:py-4 ${isMemoToolbarStuck ? "xl:border-[#2a2e3d] xl:shadow-[0_10px_24px_rgb(0_0_0/0.18)]" : ""}`}
            >
              <MainContentHeader
                id="all-memos-title"
                label="ALL MEMOS"
                title="모든 메모"
                badgeCount={memos.length}
                description="수집된 생각과 기록을 한눈에 탐색하고 관리합니다."
                onVisibilityChange={setIsContentHeaderVisible}
                action={
                  <div
                    className="inline-flex w-fit gap-1 rounded-lg border border-[#2a2e3d] bg-[#1a1d26] p-1 backdrop-blur-md"
                    aria-label="메모 보기 방식"
                  >
                    <button
                      type="button"
                      onClick={() => setMemoViewMode("list")}
                      aria-pressed={memoViewMode === "list"}
                      className={`rounded-md p-1.5 text-xs font-bold transition-colors ${memoViewMode === "list" ? "bg-[#e5a93c] text-[#0f1117] shadow-sm" : "text-[#9ca3af] hover:text-[#f3f4f6]"}`}
                    >
                      📋 <span className="hidden sm:inline">텍스트 리스트</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemoViewMode("gallery")}
                      aria-pressed={memoViewMode === "gallery"}
                      className={`rounded-md p-1.5 text-xs font-bold transition-colors ${memoViewMode === "gallery" ? "bg-[#e5a93c] text-[#0f1117] shadow-sm" : "text-[#9ca3af] hover:text-[#f3f4f6]"}`}
                    >
                      🖼️ <span className="hidden sm:inline">사진 카드</span>
                    </button>
                  </div>
                }
              />
            </div>
            {memoViewMode === "gallery" && (
              <MemoryOrbitView
                candidates={memoryCandidates}
                onOpenMemo={openMemo}
              />
            )}
            {pinned.length > 0 && (
              <section className="mb-7" aria-labelledby="pinned-heading">
                <button
                  type="button"
                  onClick={() => setIsPinnedOpen((current) => !current)}
                  className="ios-tap flex h-11 w-full items-center justify-between px-1 text-left"
                  aria-expanded={isPinnedOpen}
                  aria-controls="pinned-list"
                >
                  <h2
                    id="pinned-heading"
                    className="text-[22px] font-bold leading-7"
                  >
                    고정됨
                  </h2>
                  <span
                    className="flex h-7 w-7 items-center justify-center text-lg leading-7 text-[#8e8e93]"
                    aria-hidden="true"
                  >
                    {isPinnedOpen ? "⌃" : "⌄"}
                  </span>
                </button>
                {isPinnedOpen && (
                  <div
                    id="pinned-list"
                    className={
                      memoViewMode === "gallery"
                        ? "grid grid-cols-2 gap-3 lg:grid-cols-3"
                        : "overflow-hidden rounded-xl border border-[#2a2e3d] bg-[#1a1d26]/80 backdrop-blur-md"
                    }
                  >
                    {pinned.map(renderMemo)}
                  </div>
                )}
              </section>
            )}
            {groups.map((group) => (
              <section
                key={group.label}
                className="mb-7"
                aria-labelledby={`group-${group.label}`}
              >
                <h2
                  id={`group-${group.label}`}
                  className="px-1 pb-2 text-[22px] font-bold"
                >
                  {group.label}
                </h2>
                <div
                  className={
                    memoViewMode === "gallery"
                      ? "grid grid-cols-2 gap-3 lg:grid-cols-3"
                      : "overflow-hidden rounded-xl border border-[#2a2e3d] bg-[#1a1d26]/80 backdrop-blur-md"
                  }
                >
                  {group.memos.map(renderMemo)}
                </div>
              </section>
            ))}
          </>
        )}
        {activeSection === "orbit" && (
          <OrbitGraphView
            memos={memos}
            onOpenMemo={openMemo}
            onHeaderVisibilityChange={setIsContentHeaderVisible}
          />
        )}
        {activeSection === "timeline" && (
          <TimelineStreamView
            memos={memos}
            onOpenMemo={openMemo}
            onHeaderVisibilityChange={setIsContentHeaderVisible}
          />
        )}
      </main>
      {activeSection === "memos" && (
        <button
          type="button"
          onClick={() => {
            setEditingMemo(null);
            setIsEditorOpen(true);
          }}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-[#e5a93c] text-4xl font-light text-[#0f1117] shadow-[0_14px_35px_rgb(0_0_0/0.5)] active:scale-95 xl:hidden"
          aria-label="새 메모 작성"
        >
          +
        </button>
      )}
      {isDrawerOpen && (
        <div role="dialog" aria-modal="true" aria-label="메뉴">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 xl:hidden"
            aria-label="메뉴 닫기"
          />
          <aside className="fixed inset-y-0 left-0 z-40 flex w-[min(84vw,320px)] flex-col border-r border-[#2a2e3d] bg-[#1a1d26]/95 p-5 text-[#f3f4f6] shadow-2xl backdrop-blur-md xl:hidden">
            <div className="flex items-center justify-between">
              <strong className="text-2xl">MemoOrbit</strong>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="ios-tap h-11 w-11 text-2xl"
                aria-label="메뉴 닫기"
              >
                ×
              </button>
            </div>
            <nav className="mt-7 grid gap-2" aria-label="모바일 주요 메뉴">
              {NAVIGATION_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectNavigation(item.id)}
                  aria-current={activeSection === item.id ? "page" : undefined}
                  className={`flex items-center gap-4 rounded-xl px-4 py-3 text-left ${activeSection === item.id ? "bg-[#e5a93c]" : ""}`}
                >
                  <span className="text-xl" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>
                    <strong className="block text-sm">{item.label}</strong>
                    <small className="text-xs opacity-60">
                      {item.description}
                    </small>
                  </span>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}
      {isEditorOpen && (
        <MemoModal
          key={editingMemo?.id ?? "new"}
          isOpen
          editingMemo={editingMemo}
          onClose={closeEditor}
          onSubmit={submitMemo}
        />
      )}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-[300px] overflow-hidden rounded-2xl bg-[#f2f2f7]/95 text-center backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-5">
              <h2 id="delete-title" className="font-semibold">
                이 메모를 삭제하겠습니까?
              </h2>
              <p className="mt-1 text-[13px] text-[#636366]">
                최근 삭제된 항목으로 이동합니다.
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-[#c6c6c8]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="ios-tap h-12 border-r border-[#c6c6c8] text-[#b77912]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setMemos((current) =>
                    current.filter((memo) => memo.id !== deleteTarget.id),
                  );
                  setDeleteTarget(null);
                }}
                className="ios-tap h-12 font-semibold text-[#ff3b30]"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
