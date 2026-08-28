"use client";

// 이 페이지는 메모 카드 상자를 관리하는 선생님이에요. 생성, 수정, 삭제 요청을 한곳에서 처리해요.
import { useState } from "react";
import { MemoCard } from "@/src/components/MemoCard";
import { MemoModal, type MemoDraft } from "@/src/components/MemoModal";
import type { Memo } from "@/types/memo";

const initialMemos: Memo[] = [
  { id: "memo-1", title: "Morning walk", content: "A quiet walk helped me slow down and find my own rhythm again.", createdAt: "2026. 08. 28 | 08:42", ageAtCreation: 29, tags: ["daily", "mind"], aiComment: "You found a small moment of recovery in a familiar routine." },
  { id: "memo-2", title: "First project milestone", content: "Our ideas connected naturally today, and the project began to feel real.", createdAt: "2026. 08. 27 | 16:18", ageAtCreation: 29, tags: ["work", "growth"], aiComment: "Collaboration seems to be an important source of energy for you." },
  { id: "memo-3", title: "A rainy afternoon", content: "Rain at the window made every sentence in my book feel slower and deeper.", createdAt: "2026. 08. 25 | 14:06", tags: ["reading", "record"], aiComment: "You are carefully collecting the quiet details that make up your orbit." },
];

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

// 쉼표로 적은 태그를 메모가 사용할 수 있는 태그 목록으로 바꿔 주는 작은 번역기예요.
const toTags = (tags: string): string[] =>
  tags
    .split(",")
    .map((tag: string) => tag.trim())
    .filter((tag: string) => tag.length > 0);

export default function Home(): React.JSX.Element {
  // useState는 현재 메모 상자와 열려 있는 공책을 기억하는 서랍이에요.
  const [memos, setMemos] = useState<Memo[]>(initialMemos);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);

  const handleOpenModal = (): void => {
    setEditingMemo(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = (): void => {
    setIsModalOpen(false);
    setEditingMemo(null);
  };

  // 수정할 카드를 공책에 넣고 열면, 모달은 생성이 아닌 수정 모드가 돼요.
  const handleEditMemo = (memo: Memo): void => {
    setEditingMemo(memo);
    setIsModalOpen(true);
  };

  const handleAddMemo = (draft: MemoDraft): void => {
    const newMemo: Memo = {
      id: crypto.randomUUID(),
      title: draft.title,
      content: draft.content,
      createdAt: new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date()),
      tags: toTags(draft.tags),
      aiComment: "Your new thought has started another gentle orbit.",
    };

    // 기존 카드 묶음은 그대로 두고 새 카드가 맨 앞에 든 새 묶음을 만들어요.
    setMemos((currentMemos: Memo[]) => [newMemo, ...currentMemos]);
    handleCloseModal();
  };

  // filter는 지울 카드만 빼고 새 상자를 만드는 체예요. 원래 상자를 직접 바꾸지 않아요.
  const handleDeleteMemo = (id: string): void => {
    setMemos((currentMemos: Memo[]) => currentMemos.filter((memo: Memo) => memo.id !== id));
  };

  // map은 모든 카드를 새 상자에 옮기되, 같은 id 카드만 수정한 카드로 바꿔 끼워요.
  const handleUpdateMemo = (updatedMemo: Memo): void => {
    setMemos((currentMemos: Memo[]) => currentMemos.map((memo: Memo) => (memo.id === updatedMemo.id ? updatedMemo : memo)));
    handleCloseModal();
  };

  // 모달은 초안만 건네고, 이 페이지는 새 메모인지 수정 메모인지 결정하는 교통정리 역할을 해요.
  const handleSubmitMemo = (draft: MemoDraft): void => {
    if (editingMemo) {
      handleUpdateMemo({ ...editingMemo, title: draft.title, content: draft.content, tags: toTags(draft.tags) });
      return;
    }

    handleAddMemo(draft);
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
            <span className="mr-1.5 text-base leading-none">+</span>{"\uC0C8 \uBA54\uBAA8 \uC4F0\uAE30"}
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{"\uB098\uC758 \uBAA8\uB4E0 \uBA54\uBAA8"}</h1>
              <p className="mt-2 text-sm text-slate-500 sm:text-base">{"\uC0DD\uAC01\uACFC \uC21C\uAC04\uB4E4\uC774 \uD558\uB098\uC758 \uADA4\uC801\uC744 \uB9CC\uB4E4\uC5B4\uAC00\uACE0 \uC788\uC5B4\uC694."}</p>
            </div>
            <section className="space-y-4" aria-label="Memo list">
              {/* map은 메모 상자에서 카드를 하나씩 꺼내 액자 컴포넌트에 끼워 보여 줘요. */}
              {memos.map((memo: Memo) => <MemoCard key={memo.id} memo={memo} onEdit={handleEditMemo} onDelete={handleDeleteMemo} />)}
            </section>
          </div>
        </main>
      </div>

      {isModalOpen ? <MemoModal isOpen={isModalOpen} editingMemo={editingMemo} onClose={handleCloseModal} onSubmit={handleSubmitMemo} /> : null}
    </div>
  );
}
