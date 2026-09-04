"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface MainContentHeaderProps {
  id: string;
  label: string;
  title: string;
  description: string;
  badgeCount?: number;
  action?: ReactNode;
  onVisibilityChange?: (isVisible: boolean) => void;
}

// 세 주요 화면이 같은 간격과 정보 순서를 사용하도록 영문 라벨·제목·설명을 한곳에서 그립니다.
export function MainContentHeader({
  id,
  label,
  title,
  description,
  badgeCount,
  action,
  onVisibilityChange,
}: MainContentHeaderProps): React.JSX.Element {
  const headerRef = useRef<HTMLElement>(null);

  // 💡 [큰 페이지 제목 노출 감지]
  // 콘텐츠 헤더가 상단바 아래에서 사라졌는지 관찰해 모바일 상단바가 브랜드와 축약 페이지명 중 무엇을 보여 줄지 알려줍니다.
  useEffect(() => {
    const header = headerRef.current;
    if (!header || !onVisibilityChange) return;
    const observer = new IntersectionObserver(
      ([entry]) => onVisibilityChange(entry.isIntersecting),
      { rootMargin: "-56px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, [onVisibilityChange]);

  return (
    <header ref={headerRef} className="pt-3 sm:pt-5 xl:pt-6">
      <p className="mb-1 hidden text-xs font-semibold uppercase tracking-wider text-[#e5a93c] sm:block">
        {label}
      </p>
      <div className="flex items-center justify-between gap-3 sm:mb-1 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 text-xl font-bold text-[#f3f4f6] sm:text-2xl">
          <h2 id={id} className="truncate">
            {title}
          </h2>
          {/* 메모 배열의 실제 길이를 숫자로 받아, 화면에 표시할 문구를 헤더 내부에서 일관되게 만듭니다. */}
          {badgeCount !== undefined && (
            <span className="shrink-0 rounded-full border border-[#2a2e3d] bg-[#1a1d26]/80 px-2.5 py-1 text-xs font-semibold text-[#ffc86b]">
              전체 {badgeCount}개
            </span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <p
        className={`${action ? "mb-4 xl:mb-6" : "mb-6"} hidden text-sm text-[#9ca3af] sm:block`}
      >
        {description}
      </p>
    </header>
  );
}
