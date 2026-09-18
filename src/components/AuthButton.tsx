"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SocialAuthModal } from "@/components/auth/SocialAuthModal";

export function AuthButton(): React.JSX.Element {
  const { user, signOut } = useAuth();
  // 사용자가 계정 버튼을 눌렀을 때만 모달을 마운트하여 게스트의 첫 화면을 가리지 않습니다.
  const [isOpen, setIsOpen] = useState(false);
  // 로그아웃 진행과 실패만 이 버튼에서 관리하고 사용자 정보는 공통 세션 상태를 따릅니다.
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signingOutRef = useRef(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  // 로그인 이벤트로 모달을 닫은 뒤 다른 탭에서 로그아웃해도 이전 모달이 다시 열리지 않게 합니다.
  if (user && isOpen) setIsOpen(false);

  // 💡 [직접 로그아웃]
  // 같은 순간의 연속 클릭을 막고, 성공 시 인증 구독이 사용자 정보를 비워 로그인 버튼을 복원합니다.
  const handleSignOut = async (): Promise<void> => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setIsSigningOut(true);
    setSignOutError(null);
    setIsOpen(false);
    try {
      await signOut();
    } catch (error) {
      console.error("로그아웃 실패:", error);
      setSignOutError("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      signingOutRef.current = false;
      setIsSigningOut(false);
    }
  };

  return (
    <div className="relative min-w-0 max-w-[65%] shrink-0 md:max-w-full">
      {user ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="max-w-24 truncate text-xs text-[#f3f4f6]" title={user.email ?? "계정 연결됨"}>
            {user.email ?? "계정 연결됨"}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="ios-tap min-h-11 shrink-0 rounded-xl px-2 text-xs text-[#9ca3af] hover:bg-white/5 hover:text-[#e5a93c] focus-visible:outline-2 focus-visible:outline-[#e5a93c] disabled:opacity-50"
          >
            {isSigningOut ? "로그아웃 중…" : "로그아웃"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label="클라우드 계정 로그인"
          title="클라우드 계정 로그인"
          className="ios-tap flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-[#9ca3af] hover:bg-white/5 hover:text-[#e5a93c] focus-visible:outline-2 focus-visible:outline-[#e5a93c]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden="true">
            <path d="M7 18a5 5 0 0 1-1-9.9A6 6 0 0 1 17.6 7a5.5 5.5 0 0 1 .9 11H7Z" />
            <path d="M12 16V10m-3 3 3-3 3 3" />
          </svg>
          <span className="whitespace-nowrap text-xs">
            클라우드 계정
          </span>
        </button>
      )}
      {user && signOutError && (
        <p role="alert" className="absolute right-0 top-full z-50 w-56 rounded-xl border border-white/15 bg-[#1a1d26] p-3 text-xs text-[#f3f4f6] shadow-lg">
          {signOutError}
        </p>
      )}
      {isOpen && !user && (
        <SocialAuthModal onClose={closeModal} />
      )}
    </div>
  );
}
