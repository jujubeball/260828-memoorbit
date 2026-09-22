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
      className="fixed inset-0 m-auto max-h-[calc(100dvh-3rem)] w-[90%] max-w-[400px] overflow-y-auto rounded-2xl border border-white/15 bg-[#1a1d26]/95 p-0 text-[#f3f4f6] shadow-2xl backdrop-blur-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-bold">
            클라우드 동기화 및 로그인
          </h2>
          <button type="button" onClick={onClose} aria-label="로그인 모달 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
            ✕
          </button>
        </div>
        <p id={descriptionId} className="mb-4 text-sm leading-6 text-[#9ca3af]">
          로그인 없이도 메모를 작성할 수 있습니다. 로그인하면 작성한 메모가 클라우드에 안전하게 백업되어 모든 기기에서 사용할 수 있습니다.
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
            <button type="button" onClick={signInWithGoogle} className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-white px-3 text-sm font-semibold text-black transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-[#e5a93c]">
              <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z" />
                <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.79-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
              </svg>
              <span>
                Google 로그인
              </span>
            </button>
            <button type="button" onClick={signInWithApple} className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-white/25 bg-[#292b30] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#36383e] focus-visible:outline-2 focus-visible:outline-[#e5a93c]">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true">
                <path d="M17.05 12.536c.031 3.323 2.916 4.429 2.948 4.443-.024.078-.461 1.577-1.52 3.126-.916 1.339-1.866 2.673-3.364 2.701-1.472.027-1.945-.873-3.628-.873-1.682 0-2.208.845-3.601.9-1.446.055-2.547-1.448-3.47-2.782-1.885-2.728-3.325-7.709-1.391-11.071.961-1.67 2.678-2.728 4.542-2.755 1.42-.027 2.76.956 3.628.956.868 0 2.497-1.182 4.204-1.008.715.03 2.723.289 4.012 2.176-.104.065-2.396 1.394-2.36 4.187ZM14.284 4.368c.767-.929 1.284-2.222 1.143-3.509-1.105.044-2.441.736-3.234 1.664-.71.822-1.333 2.137-1.165 3.398 1.232.095 2.489-.626 3.256-1.553Z" />
              </svg>
              <span>
                Apple 로그인
              </span>
            </button>
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
