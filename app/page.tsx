// 이 파일은 MemoOrbit의 첫 화면을 꾸미는 '교실 칠판'처럼, 메모들을 한곳에 보여주는 역할을 해요.
import type { Memo } from "@/types/memo";

// Dummy Data는 아직 서버가 없어도 화면을 연습할 수 있게 준비해 둔 예시 메모예요.
const memos: Memo[] = [
  {
    id: "memo-1",
    title: "오랜만에 찾은 나만의 리듬",
    content:
      "아침 산책을 하며 좋아하는 팟캐스트를 들었다. 서두르지 않아도 괜찮다는 생각이 들어 마음이 한결 가벼워졌다.",
    createdAt: "2026. 08. 28 · 오전 8:42",
    ageAtCreation: 29,
    tags: ["일상", "마음"],
    aiComment: "작은 루틴에서 회복의 감각을 발견하고 있네요. 이 리듬을 오래 지켜보세요.",
  },
  {
    id: "memo-2",
    title: "프로젝트의 첫 번째 이정표",
    content:
      "팀과 함께 정리한 기획안이 생각보다 빠르게 방향을 잡았다. 서로의 아이디어가 자연스럽게 이어지는 순간이 좋았다.",
    createdAt: "2026. 08. 27 · 오후 4:18",
    ageAtCreation: 29,
    tags: ["일", "성장"],
    aiComment: "협업의 흐름을 소중히 기록했어요. 당신은 연결 속에서 동력을 얻는 사람입니다.",
  },
  {
    id: "memo-3",
    title: "비 오는 날의 책갈피",
    content:
      "창가에 앉아 책을 읽었다. 빗소리 사이로 문장들이 더 천천히, 깊게 마음에 들어오는 오후였다.",
    createdAt: "2026. 08. 25 · 오후 2:06",
    tags: ["독서", "기록"],
    aiComment: "고요한 순간을 섬세하게 포착했네요. 이런 기억들이 당신만의 궤적을 만듭니다.",
  },
];

const navigation = [
  { label: "전체 메모", icon: "◌", active: true },
  { label: "생각 변화 타임라인", icon: "◷", active: false },
  { label: "AI 인사이트", icon: "✦", active: false },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8f8fb] text-slate-800">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#main-content" className="flex items-center gap-2.5" aria-label="MemoOrbit 홈">
            <span className="flex size-8 items-center justify-center rounded-xl bg-violet-600 text-lg text-white shadow-sm">◌</span>
            <span className="text-xl font-bold tracking-tight text-slate-900">MemoOrbit</span>
          </a>
          <button className="rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 sm:px-4">
            <span className="mr-1.5 text-base leading-none">+</span>새 메모 쓰기
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white px-4 py-3 lg:min-h-[calc(100vh-4rem)] lg:w-60 lg:border-r lg:border-b-0 lg:px-5 lg:py-8">
          <nav aria-label="주요 메뉴" className="flex gap-2 overflow-x-auto lg:flex-col">
            {navigation.map((item) => (
              <a
                key={item.label}
                href="#main-content"
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  item.active
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span className="text-lg leading-none" aria-hidden="true">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <main id="main-content" className="min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold text-violet-600">MY MEMO ORBIT</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">나의 모든 메모</h1>
              <p className="mt-2 text-sm text-slate-500 sm:text-base">생각과 순간들이 하나의 궤적을 만들어가고 있어요.</p>
            </div>

            <section className="space-y-4" aria-label="메모 목록">
              {/* map은 메모 상자(memos)를 하나씩 꺼내 Memo 카드 컴포넌트 모양으로 화면에 그려줘요. */}
              {memos.map((memo) => (
                <article key={memo.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{memo.title}</h2>
                      <p className="mt-1.5 text-xs text-slate-400">{memo.createdAt}{memo.ageAtCreation ? ` · ${memo.ageAtCreation}세` : ""}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {memo.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-6 text-slate-600 sm:text-base">{memo.content}</p>

                  {/* aiComment가 있는 메모에서만 AI 카드 조각을 붙여서 보여줘요. */}
                  {memo.aiComment && (
                    <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/80 px-4 py-3.5">
                      <p className="text-xs font-bold tracking-wide text-violet-700">🤖 AI Orbit Comment</p>
                      <p className="mt-1.5 text-sm leading-6 text-violet-900/80">{memo.aiComment}</p>
                    </div>
                  )}
                </article>
              ))}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
