"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  // 계정 팝오버와 이미지 실패 상태만 보관하며 이메일은 인증 상태에서 바로 읽습니다.
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileId = useId();
  const email = user?.email || "계정 연결됨";
  const avatarUrl = typeof user?.user_metadata?.avatar_url === "string"
    && /^https?:\/\//.test(user.user_metadata.avatar_url) ? user.user_metadata.avatar_url : null;

  // 💡 [팝오버 닫기와 포커스 복원]
  // 바깥 클릭과 초점 이동은 닫기만 하고, Escape는 계정 버튼으로 돌아갑니다.
  useEffect(() => {
    if (!isProfileOpen) return;
    const closeOutside = (event: Event): void => {
      if (!profileRef.current?.contains(event.target as Node)) setIsProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setIsProfileOpen(false);
      profileButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isProfileOpen]);

  // 로그인 이벤트로 모달을 닫은 뒤 다른 탭에서 로그아웃해도 이전 모달이 다시 열리지 않게 합니다.
  if (user && isOpen) setIsOpen(false);
  if (!user && isProfileOpen) setIsProfileOpen(false);

  const avatar = (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5a93c]/15 text-sm font-semibold text-[#e5a93c] ring-1 ring-white/10">
      {avatarUrl && failedAvatar !== avatarUrl ? (
        // 외부 공급자의 작은 프로필 사진은 원본 주소로 표시하고 실패 시 첫 글자로 대체합니다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={32}
          height={32}
          referrerPolicy="no-referrer"
          onError={() => setFailedAvatar(avatarUrl)}
          className="h-full w-full object-cover"
        />
      ) : (
        user?.email?.charAt(0).toUpperCase() || "?"
      )}
    </span>
  );

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
    <div className="relative min-w-0 max-w-full">
      {user ? (
        <>
          <div className="hidden min-w-0 items-center gap-3 md:flex">
            {avatar}
            <span className="min-w-0 text-sm text-[#f3f4f6] [overflow-wrap:anywhere]">
              {email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="ios-tap min-h-11 shrink-0 cursor-pointer rounded-xl px-2 text-xs transition-colors text-[#9ca3af] hover:bg-white/5 hover:text-[#e5a93c] focus-visible:outline-2 focus-visible:outline-[#e5a93c] disabled:opacity-50"
            >
              {isSigningOut ? "로그아웃 중…" : "로그아웃"}
            </button>
          </div>
          <div ref={profileRef} className="relative md:hidden">
            <button
              ref={profileButtonRef}
              type="button"
              aria-label="내 계정 정보"
              aria-expanded={isProfileOpen}
              aria-controls={profileId}
              onClick={() => setIsProfileOpen((open) => !open)}
              className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-2 text-xs text-[#9ca3af] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#e5a93c]"
            >
              {avatar}
              <span>
                계정
              </span>
            </button>
            {isProfileOpen && (
              <div id={profileId} aria-label="계정 정보" className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/15 bg-[#1a1d26] p-4 shadow-2xl">
                <p className="mb-1 text-xs text-[#9ca3af]">
                  로그인한 계정
                </p>
                <p className="text-sm leading-6 text-[#f3f4f6] [overflow-wrap:anywhere]">
                  {email}
                </p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="mt-3 min-h-12 w-full cursor-pointer rounded-xl border border-white/15 text-sm transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#e5a93c] disabled:opacity-50"
                >
                  {isSigningOut ? "로그아웃 중…" : "로그아웃"}
                </button>
                {signOutError && (
                  <p role="alert" className="mt-2 text-xs leading-5 text-[#f3f4f6]">
                    {signOutError}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label="클라우드 동기화 로그인"
          title="클라우드 동기화 로그인"
          className="ios-tap flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 text-[#9ca3af] transition-colors hover:bg-white/10 hover:text-[#e5a93c] focus-visible:outline-2 focus-visible:outline-[#e5a93c]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden="true">
            <path d="M7 18a5 5 0 0 1-1-9.9A6 6 0 0 1 17.6 7a5.5 5.5 0 0 1 .9 11H7Z" />
            <path d="M12 16V10m-3 3 3-3 3 3" />
          </svg>
          <span className="whitespace-nowrap text-xs md:text-sm">
            클라우드 동기화
          </span>
        </button>
      )}
      {user && signOutError && (
        <p role="alert" className="absolute right-0 top-full z-50 hidden w-56 md:block rounded-xl border border-white/15 bg-[#1a1d26] p-3 text-xs text-[#f3f4f6] shadow-lg">
          {signOutError}
        </p>
      )}
      {isOpen && !user && (
        <SocialAuthModal onClose={closeModal} />
      )}
    </div>
  );
}
