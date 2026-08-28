// 이 컴포넌트는 메모 한 장을 액자처럼 보여 주고, 수정과 삭제 요청을 부모에게 전달해요.
import type { Memo } from "@/types/memo";

interface MemoCardProps {
  memo: Memo;
  onEdit: (memo: Memo) => void;
  onDelete: (id: string) => void;
}

export function MemoCard({ memo, onEdit, onDelete }: MemoCardProps): React.JSX.Element {
  const displayTime = memo.isEdited && memo.updatedAt ? memo.updatedAt : memo.createdAt;

  // 삭제는 되돌리기 어려운 행동이라, 버튼을 한 번 더 눌러 확인받는 안전문을 만들어요.
  const handleDeleteClick = (): void => {
    if (window.confirm("정말로 이 메모를 삭제하시겠습니까?")) {
      onDelete(memo.id);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{memo.title}</h2>
          <p className="mt-1.5 text-xs text-slate-400">
            {displayTime}
            {memo.isEdited ? <span className="ml-1">{"(\uC218\uC815\uB428)"}</span> : null}
            {memo.ageAtCreation ? ` | ${memo.ageAtCreation}` : ""}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap justify-end gap-1.5">
          {/* 긴 태그도 다음 줄로 자연스럽게 내려가도록, 이름표 바구니에 flex-wrap을 사용해요. */}
          {memo.tags.map((tag: string) => (
            <span key={tag} className="max-w-full break-all rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
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
        <button type="button" onClick={() => onEdit(memo)} className="rounded-lg px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50">{"\uC218\uC815"}</button>
        <button type="button" onClick={handleDeleteClick} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50">{"\uC0AD\uC81C"}</button>
      </div>
    </article>
  );
}
