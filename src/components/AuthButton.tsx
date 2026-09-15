"use client";

import { useId, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function AuthButton() {
  const { user, isLoading, isConfigured, error: authError, signInWithGoogle, signInWithApple, signOut } = useAuth();
  const id = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  // 버튼 실행 중에는 중복 로그인을 막고, 실패 문구는 시트 안에만 표시합니다.
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 💡 [명시적인 계정 작업]
  // 클릭으로 받은 작업만 실행합니다. 실패해도 시트 밖의 메모 저장에는 영향을 주지 않습니다.
  const run = async (action: () => Promise<void>, closeAfter = false) => {
    if (isPending) return;
    setIsPending(true);
    setError(null);
    try {
      await action();
      if (closeAfter) sheetRef.current?.hidePopover();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "연결하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={user ? "클라우드 계정 관리" : "클라우드 백업 / 로그인"}
        title={user ? "계정 연결됨 · 백업 준비 중" : "클라우드 백업 / 로그인"}
        className="ios-tap relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#9ca3af] hover:bg-white/5 hover:text-[#e5a93c] focus-visible:outline-2 focus-visible:outline-[#e5a93c]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden="true">
          <path d="M7 18a5 5 0 0 1-1-9.9A6 6 0 0 1 17.6 7a5.5 5.5 0 0 1 .9 11H7Z" />
          <path d="M12 16V10m-3 3 3-3 3 3" />
        </svg>
        {user && (
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#e5a93c]" />
        )}
      </button>
      {/* 브라우저 팝오버는 바깥 클릭·Escape로 닫히며 문서와 하단 툴바의 높이를 바꾸지 않습니다. */}
      <div
        ref={sheetRef}
        id={id}
        popover="auto"
        role="dialog"
        aria-labelledby={`${id}-title`}
        className="fixed inset-auto right-4 top-[max(4rem,env(safe-area-inset-top))] m-0 max-h-[calc(100dvh-5rem)] w-[calc(100%-2rem)] max-w-80 overflow-y-auto rounded-2xl border border-[#2a2e3d] bg-[#1a1d26]/95 p-4 text-[#f3f4f6] shadow-2xl backdrop-blur-xl backdrop:bg-transparent"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id={`${id}-title`} className="text-base font-semibold">
            {user ? "클라우드 계정" : "로그인"}
          </h2>
          <button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="로그인 시트 닫기" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-[#9ca3af]">
          메모는 이 기기에 저장됩니다. 클라우드 백업은 준비 중입니다.
        </p>
        {user ? (
          <div className="space-y-3">
            <p className="break-all text-sm">
              {user.email ?? "계정 연결됨"}
            </p>
            <button type="button" disabled={isPending} onClick={() => void run(signOut, true)} className="min-h-11 w-full rounded-xl border border-[#2a2e3d] text-sm disabled:opacity-50">
              {isPending ? "처리 중…" : "로그아웃"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button type="button" disabled={!isConfigured || isLoading || isPending} onClick={() => void run(signInWithGoogle)} className="min-h-11 w-full rounded-xl bg-white px-3 text-sm font-medium text-[#161922] disabled:opacity-50">
              Google로 계속하기
            </button>
            <button type="button" disabled={!isConfigured || isLoading || isPending} onClick={() => void run(signInWithApple)} className="min-h-11 w-full rounded-xl border border-white/20 bg-black px-3 text-sm font-medium disabled:opacity-50">
              Apple로 계속하기
            </button>
          </div>
        )}
        {!isConfigured && (
          <p className="mt-3 text-xs text-[#ffc86b]">
            클라우드 연결을 준비 중입니다. 로그인 없이 계속 기록할 수 있습니다.
          </p>
        )}
        {(error || authError) && (
          <p role="alert" className="mt-3 text-xs text-[#ffc86b]">
            {error || authError}
          </p>
        )}
      </div>
    </>
  );
}
