"use client";

import { useEffect, useMemo, useState } from "react";
import { MemoCard } from "@/src/components/MemoCard";
import {
  MemoryOrbitView,
  type MemoryCandidate,
} from "@/src/components/MemoryOrbitView";
import { MemoModal, type MemoDraft } from "@/src/components/MemoModal";
import { initialMemos } from "@/src/data/initialMemos";
import { createMemoImageDataUrl } from "@/src/lib/memoImage";
import type { Memo } from "@/types/memo";

interface MemoGroup {
  label: string;
  memos: Memo[];
}

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
      onEdit={(value) => { setEditingMemo(value); setIsEditorOpen(true); }}
      onDelete={setDeleteTarget}
      onTogglePin={(id) => setMemos((current) => current.map((item) => item.id === id ? { ...item, isPinned: !item.isPinned } : item))}
    />
  );

  return (
    <div className="min-h-dvh bg-[#f2f2f7] text-[#1c1c1e]">
      <header className="sticky top-0 z-40 bg-[#f2f2f7]/90 px-5 pb-3 pt-[max(0.8rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-end justify-between">
          <div className="flex h-12 items-center gap-3">
            <h1 className="text-[30px] font-bold leading-10 tracking-tight">
              MemoOrbit
            </h1>
            <span className="text-sm leading-10 text-[#8e8e93]">
              전체 {memos.length}개의 메모
            </span>
          </div>
          <button type="button" onClick={() => setIsEditorOpen(true)} className="ios-tap flex h-11 w-11 items-center justify-center rounded-full text-2xl text-[#b77912]" aria-label="새 메모 작성">
            <span aria-hidden="true">□̸</span>
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-28">
        <MemoryOrbitView
          candidates={memoryCandidates}
          onOpenMemo={(memo) => {
            setEditingMemo(memo);
            setIsEditorOpen(true);
          }}
        />
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
            {isPinnedOpen && <div id="pinned-list" className="overflow-hidden rounded-xl bg-white">{pinned.map(renderMemo)}</div>}
          </section>
        )}
        {groups.map((group) => (
          <section key={group.label} className="mb-7" aria-labelledby={`group-${group.label}`}>
            <h2 id={`group-${group.label}`} className="px-1 pb-2 text-[22px] font-bold">{group.label}</h2>
            <div className="overflow-hidden rounded-xl bg-white">{group.memos.map(renderMemo)}</div>
          </section>
        ))}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#c6c6c8] bg-[#f9f9f9]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-5">
          <span className="w-11" />
          <span className="text-xs text-[#636366]">{memos.length}개의 메모</span>
          <button type="button" onClick={() => setIsEditorOpen(true)} className="ios-tap h-11 w-11 text-2xl text-[#b77912]" aria-label="새 메모 작성"><span aria-hidden="true">□̸</span></button>
        </div>
      </div>
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
