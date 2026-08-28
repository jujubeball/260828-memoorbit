"use client";

// 이 컴포넌트는 새 메모를 쓰거나 기존 메모를 고치는 작은 공책이에요.
import { type FormEvent, type MouseEvent, useMemo, useState } from "react";
import type { Memo } from "@/types/memo";

export interface MemoDraft {
  title: string;
  content: string;
  tags: string;
}

interface TagRule {
  tag: string;
  keywords: string[];
}

interface MemoModalProps {
  isOpen: boolean;
  editingMemo: Memo | null;
  onClose: () => void;
  onSubmit: (draft: MemoDraft) => void;
}

const emptyDraft: MemoDraft = { title: "", content: "", tags: "" };

const toDraft = (memo: Memo | null): MemoDraft =>
  memo
    ? { title: memo.title, content: memo.content, tags: memo.tags.join(", ") }
    : emptyDraft;

// AI처럼 보이는 추천 규칙이에요. 지금은 단어 사전을 사용하고, 나중에는 실제 AI API로 바꿀 수 있어요.
const tagRules: TagRule[] = [
  { tag: "\uC77C\uC0C1", keywords: ["daily", "walk", "morning", "\uC0B0\uCC45", "\uC77C\uC0C1"] },
  { tag: "\uC0DD\uAC01", keywords: ["think", "idea", "mind", "\uC0DD\uAC01", "\uAE30\uB85D"] },
  { tag: "\uACF5\uBD80", keywords: ["study", "learn", "book", "\uACF5\uBD80", "\uCC45"] },
  { tag: "\uC77C", keywords: ["work", "project", "team", "\uC77C", "\uD504\uB85C\uC81D\uD2B8"] },
];

const parseTags = (tags: string): string[] =>
  tags
    .split(",")
    .map((tag: string) => tag.trim())
    .filter((tag: string) => tag.length > 0);

const getRecommendedTags = (title: string, content: string): string[] => {
  const text = `${title} ${content}`.toLocaleLowerCase();
  if (!text.trim()) {
    return [];
  }

  const matchedTags = tagRules
    .filter((rule: TagRule) => rule.keywords.some((keyword: string) => text.includes(keyword.toLocaleLowerCase())))
    .map((rule: TagRule) => rule.tag);

  // 입력은 있지만 단어 사전에 맞는 말이 없을 때도, 생각을 기록한다는 기본 추천을 보여 줘요.
  return matchedTags.length > 0 ? matchedTags : ["\uC0DD\uAC01", "\uAE30\uB85D"];
};

export function MemoModal({ isOpen, editingMemo, onClose, onSubmit }: MemoModalProps): React.JSX.Element | null {
  // 모달은 닫힐 때 화면에서 사라지고, 다시 열릴 때 이 초기값으로 새 공책 페이지를 준비해요.
  const [draft, setDraft] = useState<MemoDraft>(() => toDraft(editingMemo));

  // useMemo는 제목이나 내용이 바뀔 때만 추천 목록을 다시 만드는 작은 계산 노트예요.
  const recommendedTags = useMemo<string[]>(
    () => getRecommendedTags(draft.title, draft.content),
    [draft.title, draft.content],
  );

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (): void => onClose();
  const handleContentClick = (event: MouseEvent<HTMLDivElement>): void => event.stopPropagation();

  const handleTagToggle = (tag: string): void => {
    const currentTags = parseTags(draft.tags);
    const hasTag = currentTags.some((currentTag: string) => currentTag.toLocaleLowerCase() === tag.toLocaleLowerCase());
    const nextTags = hasTag
      ? currentTags.filter((currentTag: string) => currentTag.toLocaleLowerCase() !== tag.toLocaleLowerCase())
      : [...currentTags, tag];

    // 기존 배열을 고치지 않고 새 태그 묶음을 만들면 React가 바뀐 이름표를 정확히 다시 그려요.
    setDraft((currentDraft: MemoDraft) => ({ ...currentDraft, tags: nextTags.join(", ") }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.content.trim()) {
      return;
    }

    onSubmit({ title: draft.title.trim(), content: draft.content.trim(), tags: draft.tags.trim() });
  };

  const isEditing = editingMemo !== null;

  return (
    // z-[100]은 팝업 공책을 화면의 다른 종이보다 위에 올려 두는 높은 책장 칸이에요.
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="memo-modal-title" onClick={handleBackdropClick}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6" onClick={handleContentClick}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wide text-violet-600">{isEditing ? "EDIT MEMO" : "NEW MEMO"}</p>
            <h2 id="memo-modal-title" className="mt-1 text-xl font-bold text-slate-900">{isEditing ? "\uBA54\uBAA8 \uC218\uC815" : "\uC0C8 \uBA54\uBAA8 \uC4F0\uAE30"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close modal">X</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            {"\uC81C\uBAA9"}
            <input value={draft.title} onChange={(event) => setDraft((currentDraft: MemoDraft) => ({ ...currentDraft, title: event.target.value }))} required className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Write a short title" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            {"\uB0B4\uC6A9"}
            <textarea value={draft.content} onChange={(event) => setDraft((currentDraft: MemoDraft) => ({ ...currentDraft, content: event.target.value }))} required rows={5} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="What is on your mind?" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            {"\uD0DC\uADF8"}
            <input value={draft.tags} onChange={(event) => setDraft((currentDraft: MemoDraft) => ({ ...currentDraft, tags: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="daily, idea, work" />
            <span className="mt-1.5 block text-xs font-normal text-slate-400">{"\uC26C\uD45C(,)\uB85C \uAD6C\uBD84\uD574 \uC785\uB825\uD574 \uC8FC\uC138\uC694."}</span>
          </label>

          <section className="rounded-xl bg-violet-50 p-3.5" aria-label="AI recommended tags">
            <p className="text-xs font-bold text-violet-700">{"\u2728 AI \uCD94\uCC9C \uD0DC\uADF8"}</p>
            <p className="mt-1 text-xs text-violet-800/70">{"\uC81C\uBAA9\uACFC \uB0B4\uC6A9\uC5D0 \uB9DE\uB294 \uD0DC\uADF8\uB97C \uB20C\uB7EC \uCD94\uAC00\uD558\uAC70\uB098 \uBE7C \uBCF4\uC138\uC694."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {recommendedTags.map((tag: string) => {
                const isSelected = parseTags(draft.tags).some((currentTag: string) => currentTag.toLocaleLowerCase() === tag.toLocaleLowerCase());
                return (
                  <button key={tag} type="button" aria-pressed={isSelected} onClick={() => handleTagToggle(tag)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${isSelected ? "bg-violet-600 text-white" : "bg-white text-violet-700 shadow-sm hover:bg-violet-100"}`}>
                    #{tag}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">{"\uCDE8\uC18C"}</button>
            <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700">{isEditing ? "\uC218\uC815 \uC644\uB8CC" : "\uC800\uC7A5\uD558\uAE30"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
