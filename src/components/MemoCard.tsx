// 이 컴포넌트는 메모 한 장을 액자처럼 보여 주고, 수정과 삭제 요청을 부모에게 전달해요.
import type { Memo } from "@/types/memo";

interface MemoCardProps {
  // memo는 액자에 넣을 메모이고, 두 함수는 버튼을 눌렀을 때 부모에게 보내는 알림이에요.
  memo: Memo;
  onEdit: (memo: Memo) => void;
  onDelete: (id: string) => void;
}

export function MemoCard({ memo, onEdit, onDelete }: MemoCardProps): React.JSX.Element {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{memo.title}</h2>
          <p className="mt-1.5 text-xs text-slate-400">
            {memo.createdAt}
            {memo.ageAtCreation ? ` | ${memo.ageAtCreation}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {/* map은 태그 바구니에서 태그를 하나씩 꺼내 같은 모양의 이름표로 만들어요. */}
          {memo.tags.map((tag: string) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-600 sm:text-base">{memo.content}</p>

      {memo.aiComment ? (
        <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/80 px-4 py-3.5">
          <p className="text-xs font-bold tracking-wide text-violet-700">{"\uD83E\uDD16 AI Orbit Comment"}</p>
          <p className="mt-1.5 text-sm leading-6 text-violet-900/80">{memo.aiComment}</p>
        </div>
      ) : null}

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={() => onEdit(memo)} className="rounded-lg px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50">
          {"\uC218\uC815"}
        </button>
        <button type="button" onClick={() => onDelete(memo.id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50">
          {"\uC0AD\uC81C"}
        </button>
      </div>
    </article>
  );
}
