"use client";

// 이 컴포넌트는 부모가 열어 달라고 할 때만 펼쳐지는 작은 메모 공책이에요.
import { type FormEvent, useEffect, useState } from "react";

// MemoDraft는 아직 저장 전인 메모 초안이에요. 공책에 연필로 적는 내용이라고 생각하면 돼요.
export interface MemoDraft {
  title: string;
  content: string;
  tags: string;
}

// Props는 부모 컴포넌트가 이 공책에 건네주는 약속이에요.
// 열지, 닫을 때 무엇을 할지, 저장한 초안을 어디로 보낼지 모두 타입으로 정해 둬요.
interface MemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (draft: MemoDraft) => void;
}

const emptyDraft: MemoDraft = { title: "", content: "", tags: "" };

export function MemoModal({ isOpen, onClose, onSubmit }: MemoModalProps) {
  // draft 상자는 사용자가 입력 중인 글자를 잠시 보관해 두는 연습장 역할을 해요.
  const [draft, setDraft] = useState<MemoDraft>(emptyDraft);

  // 공책을 새로 펼칠 때마다 빈 페이지에서 시작하도록 입력 칸을 깨끗하게 비워요.
  useEffect(() => {
    if (isOpen) {
      setDraft(emptyDraft);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    // 폼의 기본 새로고침을 막아야, 공책에 적은 내용이 화면 전환으로 사라지지 않아요.
    event.preventDefault();
    if (!draft.title.trim() || !draft.content.trim()) {
      return;
    }

    onSubmit({
      title: draft.title.trim(),
      content: draft.content.trim(),
      tags: draft.tags.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="memo-modal-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wide text-violet-600">NEW MEMO</p>
            <h2 id="memo-modal-title" className="mt-1 text-xl font-bold text-slate-900">{ "\uC0C8 \uBA54\uBAA8 \uC4F0\uAE30" }</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close modal">X</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            { "\uC81C\uBAA9" }
            <input value={draft.title} onChange={(event) => setDraft((current: MemoDraft) => ({ ...current, title: event.target.value }))} required className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Write a short title" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            { "\uB0B4\uC6A9" }
            <textarea value={draft.content} onChange={(event) => setDraft((current: MemoDraft) => ({ ...current, content: event.target.value }))} required rows={5} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="What is on your mind?" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            { "\uD0DC\uADF8" }
            <input value={draft.tags} onChange={(event) => setDraft((current: MemoDraft) => ({ ...current, tags: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="daily, idea, work" />
            <span className="mt-1.5 block text-xs font-normal text-slate-400">{ "\uC26C\uD45C(,)\uB85C \uAD6C\uBD84\uD574 \uC785\uB825\uD574 \uC8FC\uC138\uC694." }</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">{ "\uCDE8\uC18C" }</button>
            <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700">{ "\uC800\uC7A5\uD558\uAE30" }</button>
          </div>
        </form>
      </div>
    </div>
  );
}
