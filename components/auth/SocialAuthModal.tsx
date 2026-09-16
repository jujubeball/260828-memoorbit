"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePageScrollLock } from "@/src/hooks/usePageScrollLock";

interface SocialAuthModalProps {
  onClose: () => void;
}

export function SocialAuthModal({ onClose }: SocialAuthModalProps): React.JSX.Element {
  const { user, isConfigured, error: authError, signInWithGoogle, signInWithApple, signOut } = useAuth();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestPending = useRef(false);
  const mountedRef = useRef(false);
  // 버튼에서 시작한 인증 요청의 진행·실패만 관리하며 메모 저장 상태와는 분리합니다.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageScrollLock(true);

  // 💡 [명시적으로 여는 로그인 모달]
  // 부모 버튼을 눌러 마운트된 때만 최상단 대화상자를 열고, 닫으면 원래 버튼으로 포커스를 복원합니다.
  useEffect(() => {
    mountedRef.current = true;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      mountedRef.current = false;
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  const run = async (action: () => Promise<void>, closeAfter = false): Promise<void> => {
    // 💡 [연속 클릭 방지]
    // 화면이 다시 그려지기 전의 빠른 두 번째 클릭도 참조로 막고, 닫힌 모달에 늦은 응답을 반영하지 않습니다.
    if (requestPending.current) return;
    requestPending.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await action();
      if (mountedRef.current && closeAfter) onClose();
    } catch (cause) {
      if (mountedRef.current) setError(cause instanceof Error ? cause.message : "연결하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      requestPending.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-white/15 bg-[#1a1d26]/95 p-0 text-[#f3f4f6] shadow-2xl backdrop-blur-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-bold">
            {user ? "클라우드 계정" : "백업 / 로그인"}
          </h2>
          <button type="button" onClick={onClose} aria-label="로그인 모달 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
            ✕
          </button>
        </div>
        <p id={descriptionId} className="mb-4 text-sm leading-6 text-[#9ca3af]">
          로그인 없이도 메모를 작성할 수 있습니다. 메모는 이 기기에 저장되며 클라우드 백업은 준비 중입니다.
        </p>
        {user ? (
          <div className="space-y-3">
            <p className="break-all text-sm">
              {user.email ?? "계정 연결됨"}
            </p>
            <button type="button" disabled={isSubmitting} onClick={() => void run(signOut, true)} className="min-h-11 w-full rounded-xl border border-white/20 text-sm hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[#e5a93c]">
              {isSubmitting ? "처리 중…" : "로그아웃"}
            </button>
          </div>
        ) : (
          <div className="space-y-3" aria-busy={isSubmitting}>
            <button type="button" disabled={isSubmitting} onClick={() => void run(signInWithGoogle)} className="min-h-12 w-full rounded-xl bg-white px-3 text-sm font-semibold text-[#161922] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[#e5a93c]">
              Google 로그인
            </button>
            <button type="button" disabled={isSubmitting} onClick={() => void run(signInWithApple)} className="min-h-12 w-full rounded-xl border border-white/20 bg-black px-3 text-sm font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[#e5a93c]">
              Apple 로그인
            </button>
          </div>
        )}
        {isSubmitting && (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-[#9ca3af]">
            <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            로그인 요청 처리 중…
          </p>
        )}
        {!isConfigured && (
          <p className="mt-3 text-xs leading-5 text-[#ffc86b]">
            로그인 연결이 아직 설정되지 않았습니다. 메모는 이 기기에 계속 저장됩니다.
          </p>
        )}
        {(error || authError) && (
          <p role="alert" className="mt-3 text-sm text-[#ffc86b]">
            {error || authError}
          </p>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
