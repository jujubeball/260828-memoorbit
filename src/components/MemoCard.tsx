// 이 컴포넌트는 메모 한 장을 예쁜 액자에 넣어 보여 주는 역할을 해요.
import type { Memo } from "@/types/memo";

interface MemoCardProps {
  // 부모가 건네준 memo 한 장을 받아서, 이 액자 안에 그려요.
  memo: Memo;
}

export function MemoCard({ memo }: MemoCardProps) {
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
          {/* map은 태그 바구니에서 태그를 하나씩 꺼내, 같은 모양의 작은 이름표로 만들어요. */}
          {memo.tags.map((tag: string) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-600 sm:text-base">{memo.content}</p>

      {/* aiComment가 있을 때만 AI 액자를 보여 줘요. 삼항 연산자는 "있으면 왼쪽, 없으면 오른쪽"을 고르는 갈림길이에요. */}
      {memo.aiComment ? (
        <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/80 px-4 py-3.5">
          <p className="text-xs font-bold tracking-wide text-violet-700">{"\uD83E\uDD16 AI Orbit Comment"}</p>
          <p className="mt-1.5 text-sm leading-6 text-violet-900/80">{memo.aiComment}</p>
        </div>
      ) : null}
    </article>
  );
}
