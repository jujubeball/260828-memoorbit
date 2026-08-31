"use client";
import { type FormEvent, useMemo, useState } from "react";
import type { Memo } from "@/types/memo";

export interface MemoDraft { text: string; tags: string; }
interface MemoModalProps { isOpen: boolean; editingMemo: Memo | null; onClose: () => void; onSubmit: (draft: MemoDraft) => void; }
const parseTags = (value: string): string[] => value.split(",").map((tag) => tag.trim()).filter(Boolean);

export function MemoModal({ isOpen, editingMemo, onClose, onSubmit }: MemoModalProps): React.JSX.Element | null {
  const [draft, setDraft] = useState<MemoDraft>(() => ({ text: editingMemo ? [editingMemo.title, editingMemo.content].filter(Boolean).join("\n") : "", tags: editingMemo?.tags.join(", ") ?? "" }));
  const recommendedTags = useMemo(() => {
    const tags: string[] = [];
    if (/[가-힣]/.test(draft.text)) tags.push("생각", "기록");
    if (/react/i.test(draft.text)) tags.push("React");
    if (/next(?:\.js)?/i.test(draft.text)) tags.push("Next.js");
    return [...new Set(tags)];
  }, [draft.text]);
  if (!isOpen) return null;
  const toggleTag = (tag: string): void => { const current = parseTags(draft.tags); const next = current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]; setDraft((value) => ({ ...value, tags: next.join(", ") })); };
  const submit = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); if (draft.text.trim()) onSubmit({ ...draft, text: draft.text.trim() }); };
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="memo-modal-title">
    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
      <header className="flex items-center justify-between"><h2 id="memo-modal-title" className="text-xl font-bold">{editingMemo ? "메모 수정" : "새 메모"}</h2><button type="button" onClick={onClose} aria-label="닫기" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">닫기</button></header>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block"><span className="sr-only">메모 내용</span><textarea autoFocus rows={10} value={draft.text} onChange={(event) => setDraft((value) => ({ ...value, text: event.target.value }))} className="w-full resize-none rounded-xl border border-slate-200 p-4 text-base leading-7 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder={"첫 줄에 제목을 쓰고\n다음 줄부터 생각을 자유롭게 적어 보세요."} /></label>
        <label className="block text-sm font-semibold">태그<input value={draft.tags} onChange={(event) => setDraft((value) => ({ ...value, tags: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="일상, 생각 (쉼표로 구분)" /></label>
        {recommendedTags.length > 0 && <div className="flex flex-wrap gap-2 rounded-xl bg-violet-50 p-3">{recommendedTags.map((tag) => <button key={tag} type="button" onClick={() => toggleTag(tag)} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-700">#{tag}</button>)}</div>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-slate-600">취소</button><button type="submit" disabled={!draft.text.trim()} className="rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-40">저장</button></div>
      </form>
    </div>
  </div>;
}
