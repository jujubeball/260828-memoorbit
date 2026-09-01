"use client";

import { useEffect, useMemo, useState } from "react";
import { MemoCard } from "@/src/components/MemoCard";
import {
  MemoryOrbitView,
  type MemoryCandidate,
} from "@/src/components/MemoryOrbitView";
import { MemoModal, type MemoDraft } from "@/src/components/MemoModal";
import { OrbitGraphView } from "@/src/components/OrbitGraphView";
import { TimelineStreamView } from "@/src/components/TimelineStreamView";
import { initialMemos } from "@/src/data/initialMemos";
import { createMemoImageDataUrl } from "@/src/lib/memoImage";
import type { Memo } from "@/types/memo";

interface MemoGroup {
  label: string;
  memos: Memo[];
}

type NavigationSection = "memos" | "orbit" | "timeline";
type MemoViewMode = "list" | "gallery";

const NAVIGATION_ITEMS: Array<{
  id: NavigationSection;
  icon: string;
  label: string;
  description: string;
}> = [
  { id: "memos", icon: "📂", label: "메모 목록", description: "All Memos" },
  { id: "orbit", icon: "🌌", label: "생각 궤적 탐색", description: "Orbit Graph" },
  { id: "timeline", icon: "📊", label: "시간 궤도 분석", description: "Timeline Stream" },
];

const toTags = (value: string): string[] =>
  value.split(",").map((tag) => tag.trim()).filter(Boolean);
const groupLabel = (iso: string): string => {
  const date = new Date(iso);
  const today = new Date();
  const day = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
  if (date.getFullYear() < today.getFullYear()) return `${date.getFullYear()}년`;
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
    ...(oneYearMemo ? [{ memo: oneYearMemo, intervalLabel: "1년 전" as const }] : []),
    ...(oneHundredDayMemo ? [{ memo: oneHundredDayMemo, intervalLabel: "100일 전" as const }] : []),
  ];
};

export default function Home(): React.JSX.Element {
  const [memos, setMemos] = useState<Memo[]>(initialMemos);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Memo | null>(null);
  const [isPinnedOpen, setIsPinnedOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<NavigationSection>("memos");
  const [memoViewMode, setMemoViewMode] = useState<MemoViewMode>("list");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedMemos = window.localStorage.getItem("memoorbit-memos");
        if (storedMemos) setMemos(JSON.parse(storedMemos) as Memo[]);
      } catch {
        window.localStorage.removeItem("memoorbit-memos");
      } finally {
        setHasHydratedStorage(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    window.localStorage.setItem("memoorbit-memos", JSON.stringify(memos));
  }, [hasHydratedStorage, memos]);

  useEffect(() => {
    if (!isEditorOpen && !deleteTarget) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [deleteTarget, isEditorOpen]);

  const sorted = useMemo(() => [...memos].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [memos]);
  const pinned = sorted.filter((memo) => memo.isPinned);
  const groups = sorted.filter((memo) => !memo.isPinned).reduce<MemoGroup[]>((result, memo) => {
    const label = groupLabel(memo.updatedAt);
    const group = result.find((item) => item.label === label);
    if (!group) return [...result, { label, memos: [memo] }];
    return result.map((item) => item.label === label ? { ...item, memos: [...item.memos, memo] } : item);
  }, []);
  const memoryCandidates = useMemo(() => findMemoryCandidates(memos), [memos]);

  const closeEditor = (): void => { setIsEditorOpen(false); setEditingMemo(null); };
  const openMemo = (memo: Memo): void => {
    setEditingMemo(memo);
    setIsEditorOpen(true);
  };
  const selectNavigation = (section: NavigationSection): void => {
    setActiveSection(section);
    setIsDrawerOpen(false);
  };
  const submitMemo = (draft: MemoDraft): void => {
    const now = new Date().toISOString();
    const sourceText = [draft.title, draft.content].filter(Boolean).join("\n");
    const canReuseAiImage =
      !draft.imageUrl &&
      editingMemo?.aiImageSourceText === sourceText &&
      editingMemo.aiImageMood === draft.aiImageMood &&
      Boolean(editingMemo.aiImageUrl);
    const aiImageUrl = draft.imageUrl
      ? undefined
      : canReuseAiImage
        ? editingMemo?.aiImageUrl
        : createMemoImageDataUrl(sourceText, draft.aiImageMood);
    const values = {
      title: draft.title,
      content: draft.content,
      richContent: draft.richContent,
      tags: toTags(draft.tags),
      imageUrl: draft.imageUrl,
      aiImageMood: draft.aiImageMood,
      aiImageUrl,
      aiImageSourceText: draft.imageUrl ? undefined : sourceText,
      updatedAt: now,
    };
    if (editingMemo) {
      setMemos((current) => [{ ...editingMemo, ...values }, ...current.filter((memo) => memo.id !== editingMemo.id)]);
    } else {
      setMemos((current) => [{ id: crypto.randomUUID(), ...values, createdAt: now, isPinned: false }, ...current]);
    }
    closeEditor();
  };
  const renderMemo = (memo: Memo): React.JSX.Element => (
    <MemoCard
      key={memo.id}
      memo={memo}
      viewMode={memoViewMode}
      onEdit={openMemo}
      onDelete={setDeleteTarget}
      onTogglePin={(id) => setMemos((current) => current.map((item) => item.id === id ? { ...item, isPinned: !item.isPinned } : item))}
    />
  );

  return (
    <div className="min-h-dvh bg-[#f2f2f7] text-[#1c1c1e] xl:pl-72">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 border-r border-[#d1d1d6] bg-[#f9f9fb] p-5 xl:flex xl:flex-col">
        <h1 className="px-3 py-4 text-2xl font-bold">MemoOrbit</h1>
        <nav className="mt-5 grid gap-2" aria-label="주요 메뉴">
          {NAVIGATION_ITEMS.map((item) => (
            <button key={item.id} type="button" onClick={() => selectNavigation(item.id)} aria-current={activeSection === item.id ? "page" : undefined} className={`flex items-center gap-4 rounded-xl px-4 py-3 text-left transition ${activeSection === item.id ? "bg-[#e5a93c] text-black" : "hover:bg-[#e5e5ea]"}`}>
              <span className="text-xl" aria-hidden="true">{item.icon}</span>
              <span><strong className="block text-sm">{item.label}</strong><small className="mt-0.5 block text-xs opacity-60">{item.description}</small></span>
            </button>
          ))}
        </nav>
        <p className="mt-auto px-3 text-xs text-[#8e8e93]">생각의 궤도를 기록하고 다시 발견하세요.</p>
      </aside>

      <header className="sticky top-0 z-40 bg-[#f2f2f7]/90 px-4 pb-3 pt-[max(0.8rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-end justify-between">
          <div className="flex h-12 items-center gap-3">
            <button type="button" onClick={() => setIsDrawerOpen(true)} className="ios-tap flex h-11 w-11 items-center justify-center text-2xl xl:hidden" aria-label="메뉴 열기">☰</button>
            <h1 className="text-[26px] font-bold leading-10 tracking-tight xl:hidden">
              MemoOrbit
            </h1>
            <span className="text-sm leading-10 text-[#8e8e93]">
              {NAVIGATION_ITEMS.find((item) => item.id === activeSection)?.label}
            </span>
          </div>
          <button type="button" onClick={() => setIsEditorOpen(true)} className={`ios-tap h-11 w-11 items-center justify-center rounded-full text-2xl text-[#b77912] ${activeSection === "memos" ? "flex" : "hidden"}`} aria-label="새 메모 작성">
            <span aria-hidden="true">□̸</span>
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-28">
        {activeSection === "memos" && (
          <>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div><h2 className="text-3xl font-bold">모든 메모</h2><p className="mt-1 text-sm text-[#8e8e93]">전체 {memos.length}개의 기록</p></div>
              <div className="flex rounded-xl bg-[#e5e5ea] p-1" aria-label="메모 보기 방식">
                <button type="button" onClick={() => setMemoViewMode("list")} aria-pressed={memoViewMode === "list"} className={`rounded-lg px-3 py-2 text-sm ${memoViewMode === "list" ? "bg-white shadow-sm" : "text-[#636366]"}`}>📋 <span className="hidden sm:inline">텍스트 리스트</span></button>
                <button type="button" onClick={() => setMemoViewMode("gallery")} aria-pressed={memoViewMode === "gallery"} className={`rounded-lg px-3 py-2 text-sm ${memoViewMode === "gallery" ? "bg-white shadow-sm" : "text-[#636366]"}`}>🖼️ <span className="hidden sm:inline">사진 카드</span></button>
              </div>
            </div>
            <MemoryOrbitView candidates={memoryCandidates} onOpenMemo={openMemo} />
        {pinned.length > 0 && (
          <section className="mb-7" aria-labelledby="pinned-heading">
            <button
              type="button"
              onClick={() => setIsPinnedOpen((current) => !current)}
              className="ios-tap flex h-11 w-full items-center justify-between px-1 text-left"
              aria-expanded={isPinnedOpen}
              aria-controls="pinned-list"
            >
              <h2 id="pinned-heading" className="text-[22px] font-bold leading-7">
                고정됨
              </h2>
              <span className="flex h-7 w-7 items-center justify-center text-lg leading-7 text-[#8e8e93]" aria-hidden="true">
                {isPinnedOpen ? "⌃" : "⌄"}
              </span>
            </button>
            {isPinnedOpen && <div id="pinned-list" className={memoViewMode === "gallery" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "overflow-hidden rounded-xl bg-white"}>{pinned.map(renderMemo)}</div>}
          </section>
        )}
        {groups.map((group) => (
          <section key={group.label} className="mb-7" aria-labelledby={`group-${group.label}`}>
            <h2 id={`group-${group.label}`} className="px-1 pb-2 text-[22px] font-bold">{group.label}</h2>
            <div className={memoViewMode === "gallery" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "overflow-hidden rounded-xl bg-white"}>{group.memos.map(renderMemo)}</div>
          </section>
        ))}
          </>
        )}
        {activeSection === "orbit" && <OrbitGraphView memos={memos} onOpenMemo={openMemo} />}
        {activeSection === "timeline" && <TimelineStreamView memos={memos} />}
      </main>
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-[#c6c6c8] bg-[#f9f9f9]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl xl:left-72 ${activeSection === "memos" ? "block" : "hidden"}`}>
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-5">
          <span className="w-11" />
          <span className="text-xs text-[#636366]">{memos.length}개의 메모</span>
          <button type="button" onClick={() => setIsEditorOpen(true)} className="ios-tap h-11 w-11 text-2xl text-[#b77912]" aria-label="새 메모 작성"><span aria-hidden="true">□̸</span></button>
        </div>
      </div>
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[90] xl:hidden" role="dialog" aria-modal="true" aria-label="메뉴">
          <button type="button" onClick={() => setIsDrawerOpen(false)} className="absolute inset-0 bg-black/40" aria-label="메뉴 닫기" />
          <aside className="relative flex h-full w-[min(84vw,320px)] flex-col bg-[#f9f9fb] p-5 shadow-2xl">
            <div className="flex items-center justify-between"><strong className="text-2xl">MemoOrbit</strong><button type="button" onClick={() => setIsDrawerOpen(false)} className="ios-tap h-11 w-11 text-2xl" aria-label="메뉴 닫기">×</button></div>
            <nav className="mt-7 grid gap-2" aria-label="모바일 주요 메뉴">{NAVIGATION_ITEMS.map((item) => <button key={item.id} type="button" onClick={() => selectNavigation(item.id)} aria-current={activeSection === item.id ? "page" : undefined} className={`flex items-center gap-4 rounded-xl px-4 py-3 text-left ${activeSection === item.id ? "bg-[#e5a93c]" : ""}`}><span className="text-xl" aria-hidden="true">{item.icon}</span><span><strong className="block text-sm">{item.label}</strong><small className="text-xs opacity-60">{item.description}</small></span></button>)}</nav>
          </aside>
        </div>
      )}
      {isEditorOpen && <MemoModal key={editingMemo?.id ?? "new"} isOpen editingMemo={editingMemo} onClose={closeEditor} onSubmit={submitMemo} />}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-6" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-[300px] overflow-hidden rounded-2xl bg-[#f2f2f7]/95 text-center backdrop-blur-xl">
            <div className="px-5 py-5">
              <h2 id="delete-title" className="font-semibold">이 메모를 삭제하겠습니까?</h2>
              <p className="mt-1 text-[13px] text-[#636366]">최근 삭제된 항목으로 이동합니다.</p>
            </div>
            <div className="grid grid-cols-2 border-t border-[#c6c6c8]">
              <button type="button" onClick={() => setDeleteTarget(null)} className="ios-tap h-12 border-r border-[#c6c6c8] text-[#b77912]">취소</button>
              <button type="button" onClick={() => { setMemos((current) => current.filter((memo) => memo.id !== deleteTarget.id)); setDeleteTarget(null); }} className="ios-tap h-12 font-semibold text-[#ff3b30]">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
