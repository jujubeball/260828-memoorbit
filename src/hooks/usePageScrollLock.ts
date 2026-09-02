"use client";

import { useEffect } from "react";

interface OriginalScrollStyles {
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
}

let activeLockCount = 0;
let originalStyles: OriginalScrollStyles | null = null;

// 💡 [페이지 전체 스크롤 잠금]
// 팝업이 열리면 실제 문서 스크롤을 나눠 담당하는 html과 body를 함께 잠그며, 여러 팝업이 겹치면 마지막 팝업까지 닫힌 뒤 원래 스타일을 복원합니다.
export function usePageScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    const html = document.documentElement;
    const body = document.body;

    if (activeLockCount === 0) {
      originalStyles = {
        htmlOverflow: html.style.overflow,
        htmlOverscrollBehavior: html.style.overscrollBehavior,
        bodyOverflow: body.style.overflow,
        bodyOverscrollBehavior: body.style.overscrollBehavior,
      };
      html.style.overflow = "hidden";
      html.style.overscrollBehavior = "none";
      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "none";
    }

    activeLockCount += 1;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);
      if (activeLockCount > 0 || !originalStyles) return;

      html.style.overflow = originalStyles.htmlOverflow;
      html.style.overscrollBehavior = originalStyles.htmlOverscrollBehavior;
      body.style.overflow = originalStyles.bodyOverflow;
      body.style.overscrollBehavior = originalStyles.bodyOverscrollBehavior;
      originalStyles = null;
    };
  }, [isLocked]);
}
