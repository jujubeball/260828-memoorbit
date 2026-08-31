"use client";
import { useMemo, useState } from "react";
import { MemoCard } from "@/src/components/MemoCard";
import { MemoModal, type MemoDraft } from "@/src/components/MemoModal";
import type { Memo } from "@/types/memo";

const initialMemos: Memo[] = [
  { id: "memo-1", title: "오랜만에 찾은 나만의 리듬", content: "아침 산책을 하며 좋아하는 팟캐스트를 들었다.", updatedAt: "2026-08-28T08:42:12+09:00", isPinned: true, tags: ["일상", "마음"] },
  { id: "memo-2", title: "프로젝트의 첫 번째 이정표", content: "팀과 함께 정리한 기획안이 방향을 잡았다.", updatedAt: "2026-08-27T16:18:35+09:00", isPinned: false, tags: ["일", "성장"] },
  { id: "memo-3", title: "비 오는 날의 책갈피", content: "", updatedAt: "2026-08-25T14:06:48+09:00", isPinned: false, tags: ["독서", "기록"] },
];
interface MemoGroup { label: string; memos: Memo[]; }
const toTags = (value: string): string[] => value.split(",").map((tag) => tag.trim()).filter(Boolean);
const splitText = (text: string): Pick<Memo, "title" | "content"> => { const [title, ...content] = text.split("\n"); return { title: title.trim(), content: content.join("\n").trim() }; };
const groupLabel = (iso: string): string => { const date = new Date(iso); const today = new Date(); const day = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000); if (day === 0) return "오늘"; if (day <= 7) return "이전 7일"; if (day <= 30) return "이전 30일"; return `${date.getMonth() + 1}월`; };

export default function Home(): React.JSX.Element {
  const [memos, setMemos] = useState<Memo[]>(initialMemos);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Memo | null>(null);
  const sorted = useMemo(() => [...memos].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [memos]);
  const pinned = sorted.filter((memo) => memo.isPinned);
  const groups = sorted.filter((memo) => !memo.isPinned).reduce<MemoGroup[]>((result, memo) => { const label = groupLabel(memo.updatedAt); const group = result.find((item) => item.label === label); return group ? result.map((item) => item.label === label ? { ...item, memos: [...item.memos, memo] } : item) : [...result, { label, memos: [memo] }]; }, []);
  const closeEditor = (): void => { setIsEditorOpen(false); setEditingMemo(null); };
  const submitMemo = (draft: MemoDraft): void => { const value = splitText(draft.text); const now = new Date().toISOString(); if (editingMemo) setMemos((current) => [{ ...editingMemo, ...value, tags: toTags(draft.tags), updatedAt: now }, ...current.filter((memo) => memo.id !== editingMemo.id)]); else setMemos((current) => [{ id: crypto.randomUUID(), ...value, tags: toTags(draft.tags), updatedAt: now, isPinned: false }, ...current]); closeEditor(); };
  const renderCard = (memo: Memo): React.JSX.Element => <MemoCard key={memo.id} memo={memo} onEdit={(value) => { setEditingMemo(value); setIsEditorOpen(true); }} onDelete={setDeleteTarget} onTogglePin={(id) => setMemos((current) => current.map((item) => item.id === id ? { ...item, isPinned: !item.isPinned } : item))} />;
  return <div className="min-h-screen bg-[#f8f8fb] text-slate-800">
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><div><span className="text-xl font-bold">MemoOrbit</span><span className="ml-3 text-sm text-slate-500">전체 {memos.length}개의 메모</span></div><button type="button" onClick={() => setIsEditorOpen(true)} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white">+ 새 메모 쓰기</button></div></header>
    <main className="mx-auto max-w-3xl px-4 py-8"><h1 className="mb-7 text-3xl font-bold">나의 모든 메모</h1>
      {pinned.length > 0 && <section className="mb-9 space-y-4"><h2 className="text-sm font-bold uppercase tracking-wider text-amber-600">고정된 메모</h2>{pinned.map(renderCard)}</section>}
      {groups.map((group) => <section key={group.label} className="mb-9 space-y-4"><h2 className="text-sm font-bold text-slate-500">{group.label}</h2>{group.memos.map(renderCard)}</section>)}
    </main>
    {isEditorOpen && <MemoModal key={editingMemo?.id ?? "new"} isOpen editingMemo={editingMemo} onClose={closeEditor} onSubmit={submitMemo} />}
    {deleteTarget && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h2 id="delete-title" className="text-lg font-bold">메모를 삭제할까요?</h2><p className="mt-2 text-sm text-slate-500">“{deleteTarget.title}” 메모는 삭제 후 되돌릴 수 없습니다.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl px-4 py-2">취소</button><button type="button" onClick={() => { setMemos((current) => current.filter((memo) => memo.id !== deleteTarget.id)); setDeleteTarget(null); }} className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white">삭제</button></div></div></div>}
  </div>;
}
