"use client";

// 이 컴포넌트는 메모 공책이에요. 입력 원문의 언어를 바꾸지 않고 어울리는 태그만 추천해요.
import { type FormEvent, useMemo, useState } from "react";
import type { Memo } from "@/types/memo";

export interface MemoDraft {
  title: string;
  content: string;
  tags: string;
}

interface TechTagRule {
  tag: string;
  pattern: RegExp;
}

interface MemoModalProps {
  isOpen: boolean;
  editingMemo: Memo | null;
  onClose: () => void;
  onSubmit: (draft: MemoDraft) => void;
}

const emptyDraft: MemoDraft = { title: "", content: "", tags: "" };

const toDraft = (memo: Memo | null): MemoDraft =>
  memo ? { title: memo.title, content: memo.content, tags: memo.tags.join(", ") } : emptyDraft;

// 기술 단어가 보이면 해당 기술 이름을 그대로 태그로 쓰는 작은 사전이에요.
const techTagRules: TechTagRule[] = [
  { tag: "React", pattern: /\breact\b/i },
  { tag: "Next.js", pattern: /\bnext(?:\.js)?\b/i },
  { tag: "TypeScript", pattern: /\btypescript\b|\bts\b/i },
  { tag: "JavaScript", pattern: /\bjavascript\b|\bjs\b/i },
  { tag: "CSS", pattern: /\bcss\b|tailwind/i },
];

const parseTags = (tags: string): string[] =>
  tags.split(",").map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);

const getRecommendedTags = (title: string, content: string): string[] => {
  const text = `${title} ${content}`;
  if (!text.trim()) return [];

  const hasHangul = /[\uAC00-\uD7A3]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  const languageTags: string[] = [
    ...(hasHangul ? ["\uC0DD\uAC01", "\uC131\uC7A5"] : []),
    ...(hasLatin ? ["Ideas", "Growth"] : []),
  ];
  const techTags = techTagRules
    .filter((rule: TechTagRule) => rule.pattern.test(text))
    .map((rule: TechTagRule) => rule.tag);

  // Set은 같은 이름표가 여러 번 추천되어도 한 장만 남기는 정리 상자예요.
  return [...new Set([...languageTags, ...techTags])];
};

export function MemoModal({ isOpen, editingMemo, onClose, onSubmit }: MemoModalProps): React.JSX.Element | null {
  const [draft, setDraft] = useState<MemoDraft>(() => toDraft(editingMemo));
  const recommendedTags = useMemo<string[]>(() => getRecommendedTags(draft.title, draft.content), [draft.title, draft.content]);

  if (!isOpen) return null;

  const handleTagToggle = (tag: string): void => {
    const currentTags = parseTags(draft.tags);
    const hasTag = currentTags.some((currentTag: string) => currentTag.toLocaleLowerCase() === tag.toLocaleLowerCase());
    const nextTags = hasTag
      ? currentTags.filter((currentTag: string) => currentTag.toLocaleLowerCase() !== tag.toLocaleLowerCase())
      : [...currentTags, tag];

    setDraft((currentDraft: MemoDraft) => ({ ...currentDraft, tags: nextTags.join(", ") }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.content.trim()) return;
    onSubmit({ title: draft.title.trim(), content: draft.content.trim(), tags: draft.tags.trim() });
  };

  const isEditing = editingMemo !== null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="memo-modal-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wide text-violet-600">{isEditing ? "\uC218\uC815 \uBAA8\uB4DC" : "\uC0C8 \uBA54\uBAA8"}</p>
            <h2 id="memo-modal-title" className="mt-1 text-xl font-bold text-slate-900">{isEditing ? "\uBA54\uBAA8 \uC218\uC815" : "\uC0C8 \uBA54\uBAA8 \uC4F0\uAE30"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="\uBAA8\uB2EC \uB2EB\uAE30">X</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            {"\uC81C\uBAA9"}
            <input value={draft.title} onChange={(event) => setDraft((currentDraft: MemoDraft) => ({ ...currentDraft, title: event.target.value }))} required className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="\uC81C\uBAA9\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694." />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            {"\uB0B4\uC6A9"}
            <textarea value={draft.content} onChange={(event) => setDraft((currentDraft: MemoDraft) => ({ ...currentDraft, content: event.target.value }))} required rows={5} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="\uB5A0\uC624\uB978 \uC0DD\uAC01\uC744 \uC790\uC720\uB86D\uAC8C \uC801\uC5B4 \uC8FC\uC138\uC694." />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            {"\uD0DC\uADF8"}
            <input value={draft.tags} onChange={(event) => setDraft((currentDraft: MemoDraft) => ({ ...currentDraft, tags: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="#\uC77C\uC0C1, #React\uCC98\uB7FC \uC27C\uD45C\uB85C \uAD6C\uBD84\uD574 \uC8FC\uC138\uC694." />
            <span className="mt-1.5 block text-xs font-normal text-slate-400">{"\uC26C\uD45C(,)\uB85C \uAD6C\uBD84\uD574 \uC785\uB825\uD574 \uC8FC\uC138\uC694."}</span>
          </label>

          <section className="rounded-xl bg-violet-50 p-3.5" aria-label="AI \uCD94\uCC9C \uD0DC\uADF8">
            <p className="text-xs font-bold text-violet-700">{"\u2728 AI \uCD94\uCC9C \uD0DC\uADF8"}</p>
            <p className="mt-1 text-xs text-violet-800/70">{"\uC785\uB825\uD55C \uC5B8\uC5B4\uC640 \uAE30\uC220 \uC6A9\uC5B4\uC5D0 \uB9DE\uB294 \uD0DC\uADF8\uB97C \uCD94\uCC9C\uD574 \uB4DC\uB824\uC694."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {recommendedTags.map((tag: string) => {
                const isSelected = parseTags(draft.tags).some((currentTag: string) => currentTag.toLocaleLowerCase() === tag.toLocaleLowerCase());
                return <button key={tag} type="button" aria-pressed={isSelected} onClick={() => handleTagToggle(tag)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${isSelected ? "bg-violet-600 text-white" : "bg-white text-violet-700 shadow-sm hover:bg-violet-100"}`}>#{tag}</button>;
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
