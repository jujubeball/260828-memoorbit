import type { Memo } from "@/types/memo";
interface MemoCardProps { memo: Memo; onEdit: (memo: Memo) => void; onDelete: (memo: Memo) => void; onTogglePin: (id: string) => void; }
export function MemoCard({ memo, onEdit, onDelete, onTogglePin }: MemoCardProps): React.JSX.Element {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <header className="flex justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-bold">{memo.title}</h2><p className="mt-1 text-xs text-slate-400">{new Date(memo.updatedAt).toLocaleString("ko-KR")}</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => onTogglePin(memo.id)} className="rounded-lg px-2 py-2 text-sm text-amber-600">{memo.isPinned ? "고정 해제" : "고정"}</button><button type="button" onClick={() => onEdit(memo)} className="rounded-lg px-2 py-2 text-sm text-violet-700">수정</button><button type="button" onClick={() => onDelete(memo)} className="rounded-lg px-2 py-2 text-sm text-rose-600">삭제</button></div></header>
    <p className={`mt-4 whitespace-pre-wrap text-sm leading-6 ${memo.content ? "text-slate-600" : "italic text-slate-400"}`}>{memo.content || "추가 텍스트 없음"}</p>
    {memo.tags.length > 0 && <footer className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">{memo.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">#{tag}</span>)}</footer>}
  </article>;
}
