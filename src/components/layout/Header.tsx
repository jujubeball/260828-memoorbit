"use client";

import { AuthButton } from "@/src/components/AuthButton";
import type { NavigationSection } from "@/src/components/layout/TopSegmentedNavigation";

interface HeaderProps {
  activeSection: NavigationSection;
}

const titles: Record<NavigationSection, string> = {
  memos: "MemoOrbit",
  orbit: "태그 궤도",
  timeline: "시간 뷰",
};

// 현재 탭을 한 줄 제목으로 전달하고 계정 버튼은 기존 인증 흐름을 그대로 사용합니다.
export function Header({ activeSection }: HeaderProps): React.JSX.Element {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[var(--mobile-header-height)] items-center justify-between border-b border-[#2a2e3d] bg-[#0f1117]/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
      <h1 className="min-w-0 truncate text-lg font-bold text-[#f3f4f6]">
        {titles[activeSection]}
      </h1>
      <AuthButton />
    </header>
  );
}
