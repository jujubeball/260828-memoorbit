"use client";

import { useEffect, useMemo, useState } from "react";
import { MemoCard } from "@/src/components/MemoCard";
import { MemoModal, type MemoDraft } from "@/src/components/MemoModal";
import { initialMemos } from "@/src/data/initialMemos";
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
  const day = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86400000,
  );

  if (day === 0) return "오늘";
  if (day <= 7) return "이전 7일";
  if (day <= 30) return "이전 30일";
  return `${date.getMonth() + 1}월`;
};

export default function Home(): React.JSX.Element {
  const [memos, setMemos] = useState<Memo[]>(initialMemos);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Memo | null>(null);

  useEffect(() => {
    if (!isEditorOpen && !deleteTarget) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [deleteTarget, isEditorOpen]);

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
      const existingGroup = result.find((group) => group.label === label);

      if (!existingGroup) return [...result, { label, memos: [memo] }];
      return result.map((group) =>
        group.label === label
          ? { ...group, memos: [...group.memos, memo] }
          : group,
      );
    }, []);

  const closeEditor = (): void => {
    setIsEditorOpen(false);
    setEditingMemo(null);
  };

  const submitMemo = (draft: MemoDraft): void => {
    const now = new Date().toISOString();
    const sharedValues = {
      title: draft.title,
      content: draft.content,
      richContent: draft.richContent,
      tags: toTags(draft.tags),
      updatedAt: now,
    };

    if (editingMemo) {
      setMemos((current) => [
        { ...editingMemo, ...sharedValues },
        ...current.filter((memo) => memo.id !== editingMemo.id),
      ]);
    } else {
      setMemos((current) => [
        {
          id: crypto.randomUUID(),
          ...sharedValues,
          createdAt: now,
          isPinned: false,
        },
        ...current,
      ]);
    }
    closeEditor();
  };

  const renderCard = (memo: Memo): React.JSX.Element => (
    <MemoCard
      key={memo.id}
      memo={memo}
      onEdit={(value) => {
        setEditingMemo(value);
        setIsEditorOpen(true);
      }}
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
    <div className="min-h-screen w-full min-w-full overflow-x-hidden bg-[#f4f1eb] text-stone-800">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#faf9f6]/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <span className="text-lg font-bold text-stone-900 sm:text-xl">MemoOrbit</span>
            <span className="ml-2 text-xs text-stone-600 sm:ml-3 sm:text-sm">
              전체 {memos.length}개의 메모
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            aria-label="새 메모 작성"
            className="interactive-control shrink-0 rounded-xl bg-stone-800 px-3 py-2 text-sm font-semibold text-white active:scale-95 sm:px-4"
          >
            + 새 메모
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-7 sm:py-10">
        <h1 className="mb-7 text-2xl font-bold text-stone-900 sm:text-3xl">
          나의 모든 메모
        </h1>

        {pinned.length > 0 && (
          <section className="mb-9 space-y-4" aria-labelledby="pinned-heading">
            <h2 id="pinned-heading" className="text-sm font-bold text-stone-700">
              고정된 메모
            </h2>
            {pinned.map(renderCard)}
          </section>
        )}

        {groups.map((group) => (
          <section key={group.label} className="mb-9 space-y-4" aria-labelledby={`group-${group.label}`}>
            <h2 id={`group-${group.label}`} className="text-sm font-bold text-stone-700">
              {group.label}
            </h2>
            {group.memos.map(renderCard)}
          </section>
        ))}
      </main>

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
          className="fixed inset-0 z-[110] flex w-full min-w-full items-center justify-center bg-stone-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          aria-describedby="delete-description"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#faf9f6] p-6 shadow-2xl">
            <h2 id="delete-title" className="text-lg font-bold text-stone-900">
              메모를 삭제할까요?
            </h2>
            <p id="delete-description" className="mt-2 text-sm text-stone-700">
              “{deleteTarget.title}” 메모는 삭제 후 되돌릴 수 없습니다.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="interactive-control rounded-xl px-4 py-2 text-stone-700 active:scale-95"
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
                className="interactive-control rounded-xl bg-stone-800 px-4 py-2 font-semibold text-white active:scale-95"
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
