"use client";

// 이 페이지는 교실 칠판처럼 메모 카드를 한곳에 모으고, 모달이 만든 새 카드를 받아 붙여 주는 곳이에요.
import { useState } from "react";
import { MemoCard } from "@/src/components/MemoCard";
import { MemoModal, type MemoDraft } from "@/src/components/MemoModal";
import type { Memo } from "@/types/memo";

const initialMemos: Memo[] = [
  {
    id: "memo-1",
    title: "Morning walk",
    content: "A quiet walk helped me slow down and find my own rhythm again.",
    createdAt: "2026. 08. 28 | 08:42",
    ageAtCreation: 29,
    tags: ["daily", "mind"],
    aiComment: "You found a small moment of recovery in a familiar routine.",
  },
  {
    id: "memo-2",
    title: "First project milestone",
    content: "Our ideas connected naturally today, and the project began to feel real.",
    createdAt: "2026. 08. 27 | 16:18",
    ageAtCreation: 29,
    tags: ["work", "growth"],
    aiComment: "Collaboration seems to be an important source of energy for you.",
  },
  {
    id: "memo-3",
    title: "A rainy afternoon",
    content: "Rain at the window made every sentence in my book feel slower and deeper.",
    createdAt: "2026. 08. 25 | 14:06",
    tags: ["reading", "record"],
    aiComment: "You are carefully collecting the quiet details that make up your orbit.",
  },
];

// 메뉴 한 칸이 어떤 글자와 모양을 가져야 하는지 적어 둔 안내 카드예요.
interface NavigationItem {
  label: string;
  icon: string;
  active: boolean;
}

const navigation: NavigationItem[] = [
  { label: "\uC804\uCCB4 \uBA54\uBAA8", icon: "O", active: true },
  { label: "\uC0DD\uAC01 \uBCC0\uD654 \uD0C0\uC784\uB77C\uC778", icon: "T", active: false },
  { label: "AI \uC778\uC0AC\uC774\uD2B8", icon: "*", active: false },
];

export default function Home(): React.JSX.Element {
  // useState는 칠판에 붙인 메모의 '현재 모습'을 기억하는 상자예요.
  // 상자 안의 값이 바뀌면 React가 바뀐 부분을 찾아 화면을 다시 그려 줘요.
  const [memos, setMemos] = useState<Memo[]>(initialMemos);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleOpenModal = (): void => setIsModalOpen(true);
  const handleCloseModal = (): void => setIsModalOpen(false);

  // 이 함수는 새 메모가 들어오는 우체통이에요. 나중에 서버나 로컬스토리지를 연결할 때도 이곳만 바꾸면 돼요.
  const handleAddMemo = (draft: MemoDraft): void => {
    const tags: string[] = draft.tags
      .split(",")
      // split은 쉼표를 가위처럼 사용해 "일상, 생각"을 두 조각으로 잘라요.
      .map((tag: string) => tag.trim())
      // map은 잘린 모든 조각의 앞뒤 공백을 지우는 똑같은 작업을 반복해요.
      .filter((tag: string) => tag.length > 0);
      // filter는 빈 조각을 걸러 내는 체처럼, 이름이 있는 태그만 남겨요.

    const newMemo: Memo = {
      id: crypto.randomUUID(),
      title: draft.title,
      content: draft.content,
      createdAt: new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
      tags,
      aiComment: "Your new thought has started another gentle orbit.",
    };

    // 이미 있는 카드 묶음을 직접 바꾸지 않고, 새 카드를 맨 앞에 붙인 새 묶음을 만들어요.
    // 레고 작품을 뜯지 않고 똑같은 새 작품을 만든 뒤 블록 하나를 더 끼우는 것과 같아요.
    // React는 새 묶음을 발견하면 화면의 맨 위에 새 메모 카드를 바로 그려 줘요.
    setMemos((currentMemos: Memo[]) => [newMemo, ...currentMemos]);
    handleCloseModal();
  };

  return (
    <div className="min-h-screen bg-[#f8f8fb] text-slate-800">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#main-content" className="flex items-center gap-2.5" aria-label="MemoOrbit home">
            <span className="flex size-8 items-center justify-center rounded-xl bg-violet-600 text-lg text-white shadow-sm">O</span>
            <span className="text-xl font-bold tracking-tight text-slate-900">MemoOrbit</span>
          </a>
          <button type="button" onClick={handleOpenModal} className="rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 sm:px-4">
            <span className="mr-1.5 text-base leading-none">+</span>{ "\uC0C8 \uBA54\uBAA8 \uC4F0\uAE30" }
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white px-4 py-3 lg:min-h-[calc(100vh-4rem)] lg:w-60 lg:border-r lg:border-b-0 lg:px-5 lg:py-8">
          <nav aria-label="Main navigation" className="flex gap-2 overflow-x-auto lg:flex-col">
            {navigation.map((item: NavigationItem) => (
              <a key={item.label} href="#main-content" className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${item.active ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
                <span className="text-sm leading-none" aria-hidden="true">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <main id="main-content" className="min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold text-violet-600">MY MEMO ORBIT</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{ "\uB098\uC758 \uBAA8\uB4E0 \uBA54\uBAA8" }</h1>
              <p className="mt-2 text-sm text-slate-500 sm:text-base">{ "\uC0DD\uAC01\uACFC \uC21C\uAC04\uB4E4\uC774 \uD558\uB098\uC758 \uADA4\uC801\uC744 \uB9CC\uB4E4\uC5B4\uAC00\uACE0 \uC788\uC5B4\uC694." }</p>
            </div>
            <section className="space-y-4" aria-label="Memo list">
              {/* map은 메모 상자에서 메모를 하나씩 꺼내서, 재사용 가능한 MemoCard 액자에 끼워 화면에 보여 줘요. */}
              {memos.map((memo: Memo) => <MemoCard key={memo.id} memo={memo} />)}
            </section>
          </div>
        </main>
      </div>

      <MemoModal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleAddMemo} />
    </div>
  );
}
