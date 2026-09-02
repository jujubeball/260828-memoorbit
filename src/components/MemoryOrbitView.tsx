"use client";

import { useEffect, useMemo, useState } from "react";
import { exportMemoryImage } from "@/src/utils/exportMemoryImage";
import type { Memo } from "@/types/memo";

export interface MemoryCandidate {
  memo: Memo;
  intervalLabel: "1년 전" | "100일 전";
}

interface MemoryOrbitViewProps {
  candidates: MemoryCandidate[];
  onOpenMemo: (memo: Memo) => void;
}

const HIDDEN_MEMORIES_KEY = "memoorbit_hidden_memories";

const formatDate = (iso: string): string => new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
}).format(new Date(iso));

export function MemoryOrbitView({
  candidates,
  onOpenMemo,
}: MemoryOrbitViewProps): React.JSX.Element | null {
  // 💡 [추억 영역 열림 State]
  // 사용자가 오늘의 추억 목록을 접었는지 기억하고 아코디언 본문 표시 여부에 연결합니다.
  const [isOpen, setIsOpen] = useState(true);
  // 💡 [숨긴 추억 ID State]
  // LocalStorage에서 읽은 메모 ID를 보관하며 이 배열에 들어간 후보는 화면 목록에서 제외합니다.
  const [hiddenMemoryIds, setHiddenMemoryIds] = useState<string[]>([]);
  // 💡 [숨김 목록 준비 State]
  // 저장소를 읽기 전에 숨겼던 카드가 잠깐 보이는 현상을 막기 위해 로딩 완료 여부를 따로 기억합니다.
  const [hasLoadedHiddenMemories, setHasLoadedHiddenMemories] = useState(false);
  // 💡 [공유 확인 대상 State]
  // 이미지 저장 버튼을 누른 메모를 보관하고 값이 있을 때만 개인정보 확인 팝업을 표시합니다.
  const [exportTarget, setExportTarget] = useState<Memo | null>(null);
  // 💡 [내보내기 진행 State]
  // Canvas 합성과 PNG 변환이 진행되는 동안 버튼을 잠가 중복 다운로드를 막습니다.
  const [isExporting, setIsExporting] = useState(false);
  // 💡 [내보내기 오류 State]
  // 이미지 로드나 브라우저 다운로드가 실패했을 때 사용자가 원인을 알 수 있도록 오류 문구를 화면에 표시합니다.
  const [exportError, setExportError] = useState("");

  // 💡 [숨긴 추억 불러오기]
  // 컴포넌트가 처음 나타날 때 브라우저 저장소의 JSON 문자열을 ID 배열로 바꿔 숨김 필터에 전달합니다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(HIDDEN_MEMORIES_KEY);
        const parsed = stored ? JSON.parse(stored) as unknown : [];
        if (Array.isArray(parsed)) {
          setHiddenMemoryIds(parsed.filter((id): id is string => typeof id === "string"));
        }
      } catch {
        window.localStorage.removeItem(HIDDEN_MEMORIES_KEY);
      } finally {
        setHasLoadedHiddenMemories(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // 💡 [공유 확인창 배경 스크롤 잠금]
  // 확인창이 열린 동안 뒤쪽 메모 목록이 움직이지 않게 막고 닫을 때 이전 body 설정으로 복원합니다.
  useEffect(() => {
    if (!exportTarget) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow || "unset";
    };
  }, [exportTarget]);

  // 숨긴 ID가 바뀔 때만 후보 배열을 다시 걸러 현재 화면에 남아야 할 카드만 계산합니다.
  const visibleCandidates = useMemo(
    () => candidates.filter(({ memo }) => !hiddenMemoryIds.includes(memo.id)),
    [candidates, hiddenMemoryIds],
  );

  // 💡 [추억 다시 보지 않기]
  // 현재 메모 ID를 중복 없이 State와 LocalStorage에 함께 넣어 즉시 제거하고 다음 후보가 같은 자리를 채우게 합니다.
  const hideMemory = (memoId: string): void => {
    setHiddenMemoryIds((current) => {
      const updated = current.includes(memoId) ? current : [...current, memoId];
      window.localStorage.setItem(HIDDEN_MEMORIES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // 💡 [공유 이미지 확인창 열기]
  // 사용자가 저장하려는 메모를 기억하고 실제 다운로드 전에 포함 필드와 개인정보 확인 안내를 보여 줍니다.
  const requestMemoryExport = (memo: Memo): void => {
    setExportError("");
    setExportTarget(memo);
  };

  // 💡 [확인 후 Canvas 이미지 저장]
  // 확인창에서 사용자가 동의하면 선택한 메모를 합성 함수에 전달하고 완료 또는 실패 상태를 다시 화면에 반영합니다.
  const confirmMemoryExport = async (): Promise<void> => {
    if (!exportTarget) return;
    setIsExporting(true);
    setExportError("");
    try {
      await exportMemoryImage(exportTarget);
      setExportTarget(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "추억 이미지를 저장하지 못했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!hasLoadedHiddenMemories || visibleCandidates.length === 0) return null;

  return (
    <section className="mb-8" aria-labelledby="memory-orbit-title">
      <div className="flex h-11 items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="ios-tap flex h-11 items-center gap-2 text-left"
          aria-expanded={isOpen}
          aria-controls="memory-orbit-content"
        >
          <h2 id="memory-orbit-title" className="text-[22px] font-bold leading-7">
            오늘의 Memory Orbit
          </h2>
          <span className="text-[#b77912]" aria-hidden="true">
            {isOpen ? "⌃" : "⌄"}
          </span>
        </button>
        {isOpen && <span className="text-xs text-[#9ca3af]">기억이 다시 도착한 날</span>}
      </div>

      {isOpen && (
        <div id="memory-orbit-content" className="scrollbar-hidden flex snap-x gap-4 overflow-x-auto px-1 pb-4 pt-2">
          {visibleCandidates.map(({ memo, intervalLabel }) => (
            <article
              key={`${intervalLabel}-${memo.id}`}
              className="w-[min(82vw,340px)] shrink-0 snap-center rotate-[-1deg] border border-[#2a2e3d] bg-[#1a1d26]/90 p-3 pb-5 text-[#f3f4f6] shadow-xl backdrop-blur-md"
            >
              <button
                type="button"
                onClick={() => onOpenMemo(memo)}
                className="ios-tap block w-full text-left"
                aria-label={`${memo.title} 메모 열기`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#e5a93c] via-[#8e8e93] to-[#1c1c1e]">
                  {(memo.imageUrl || memo.aiImageUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={memo.imageUrl ?? memo.aiImageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
                    {intervalLabel}
                  </span>
                </div>
                <div className="px-1 pt-4">
                  <h3 className="truncate text-lg font-bold">{memo.title}</h3>
                  <p className="mt-1 text-xs text-[#9ca3af]">{formatDate(memo.createdAt)}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#9ca3af]">{memo.content}</p>
                </div>
              </button>
              <div className="mt-4 grid grid-cols-2 gap-2 px-1">
                <button
                  type="button"
                  onClick={() => hideMemory(memo.id)}
                  className="ios-tap rounded-xl border border-[#2a2e3d] px-3 py-2.5 text-xs font-semibold text-[#9ca3af] hover:text-white"
                >
                  다시 보지 않기
                </button>
                <button
                  type="button"
                  onClick={() => requestMemoryExport(memo)}
                  className="ios-tap rounded-xl bg-[#e5a93c] px-3 py-2.5 text-xs font-bold text-[#0f1117] hover:bg-[#ffc86b]"
                >
                  이미지 저장
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {exportTarget && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-export-title"
          onClick={() => !isExporting && setExportTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-[#2a2e3d] bg-[#1a1d26] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="memory-export-title" className="text-xl font-bold">
              추억 이미지를 저장할까요?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#9ca3af]">
              이미지, 제목, 작성 날짜와 태그만 400×500 PNG에 포함됩니다. 본문, 사용자 ID와 내부 메모 ID는 제외됩니다.
            </p>
            <p className="mt-3 rounded-xl bg-[#e5a93c]/10 p-3 text-xs leading-5 text-[#ffc86b]">
              제목·사진·태그에 개인 정보가 보이는지 확인한 뒤 저장하세요. Canvas로 다시 그려 원본 파일 메타데이터는 제거합니다.
            </p>
            {exportError && (
              <p role="alert" className="mt-3 text-sm text-[#ff6961]">
                {exportError}
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportTarget(null)}
                disabled={isExporting}
                className="ios-tap rounded-xl border border-[#2a2e3d] px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmMemoryExport()}
                disabled={isExporting}
                className="ios-tap rounded-xl bg-[#e5a93c] px-4 py-3 text-sm font-bold text-[#0f1117] disabled:opacity-50"
              >
                {isExporting ? "합성 중…" : "확인하고 저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
