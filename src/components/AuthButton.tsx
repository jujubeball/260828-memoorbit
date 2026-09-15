"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SocialAuthModal } from "@/components/auth/SocialAuthModal";

export function AuthButton(): React.JSX.Element {
  const { user, isTestSession } = useAuth();
  // 사용자가 계정 버튼을 눌렀을 때만 모달을 마운트하여 게스트의 첫 화면을 가리지 않습니다.
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={isTestSession ? "테스트 계정 관리" : user ? "클라우드 계정 관리" : "클라우드 백업 / 로그인"}
        title={isTestSession ? "임시 테스트 계정 · 실제 연결 없음" : user ? "계정 연결됨 · 백업 준비 중" : "클라우드 백업 / 로그인"}
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
      {isOpen && (
        <SocialAuthModal onClose={closeModal} />
      )}
    </>
  );
}
