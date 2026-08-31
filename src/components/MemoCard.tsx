import type { Memo } from "@/types/memo";

interface MemoCardProps {
  memo: Memo;
  onEdit: (memo: Memo) => void;
  onDelete: (memo: Memo) => void;
  onTogglePin: (id: string) => void;
}

export function MemoCard({
  memo,
  onEdit,
  onDelete,
  onTogglePin,
}: MemoCardProps): React.JSX.Element {
  return (
    <article className="rounded-2xl border border-stone-200 bg-[#faf9f6] p-5 shadow-sm">
      <header className="flex justify-between gap-3">
        <div className="min-w-0">
          {!memo.richContent && (
            <h2 className="break-words text-lg font-bold text-stone-900">
              {memo.title}
            </h2>
          )}
          <p className="mt-1 text-xs text-stone-500">
            {new Date(memo.updatedAt).toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onTogglePin(memo.id)}
            aria-label={memo.isPinned ? `${memo.title} 고정 해제` : `${memo.title} 고정`}
            className="interactive-control rounded-lg px-2 py-2 text-sm font-semibold text-stone-700 active:scale-95"
          >
            {memo.isPinned ? "고정 해제" : "고정"}
          </button>
          <button
            type="button"
            onClick={() => onEdit(memo)}
            aria-label={`${memo.title} 수정`}
            className="interactive-control rounded-lg px-2 py-2 text-sm font-semibold text-stone-700 active:scale-95"
          >
            수정
          </button>
          <button
            type="button"
            onClick={() => onDelete(memo)}
            aria-label={`${memo.title} 삭제`}
            className="interactive-control rounded-lg px-2 py-2 text-sm font-semibold text-red-800 active:scale-95"
          >
            삭제
          </button>
        </div>
      </header>

      {memo.richContent ? (
        <div
          className="rich-content mt-4 text-stone-800"
          dangerouslySetInnerHTML={{ __html: memo.richContent }}
        />
      ) : (
        <p
          className={`mt-4 whitespace-pre-wrap text-sm leading-6 ${
            memo.content ? "text-stone-700" : "italic text-stone-500"
          }`}
        >
          {memo.content || "추가 텍스트 없음"}
        </p>
      )}

      {memo.tags.length > 0 && (
        <footer className="mt-4 flex flex-wrap gap-1.5 border-t border-stone-200 pt-4">
          {memo.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700"
            >
              #{tag}
            </span>
          ))}
        </footer>
      )}
    </article>
  );
}
