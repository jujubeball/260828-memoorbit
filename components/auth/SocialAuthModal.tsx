"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePageScrollLock } from "@/src/hooks/usePageScrollLock";

interface SocialAuthModalProps {
  onClose: () => void;
}

export function SocialAuthModal({ onClose }: SocialAuthModalProps): React.JSX.Element {
  const { user, signInWithGoogle, signInWithApple, signOut } = useAuth();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mountedRef = useRef(false);
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

  // 💡 [로그아웃 후 모달 닫기]
  // 계정 해제가 끝나면 열린 모달을 닫으며, 먼저 닫힌 모달에는 늦은 응답을 반영하지 않습니다.
  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
      if (mountedRef.current) onClose();
    } catch (cause) {
      console.error("로그아웃 실패:", cause);
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
            <button type="button" onClick={handleSignOut} className="min-h-11 w-full rounded-xl border border-white/20 text-sm hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[#e5a93c]">
              로그아웃
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button type="button" onClick={signInWithGoogle} className="min-h-12 w-full rounded-xl bg-white px-3 text-sm font-semibold text-[#161922] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[#e5a93c]">
              Google 로그인
            </button>
            <button type="button" onClick={signInWithApple} className="min-h-12 w-full rounded-xl border border-white/20 bg-black px-3 text-sm font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[#e5a93c]">
              Apple 로그인
            </button>
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
