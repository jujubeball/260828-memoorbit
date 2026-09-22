"use client";

import { useEffect } from "react";

interface OriginalScrollStyles {
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyWidth: string;
  scrollX: number;
  scrollY: number;
}

// 💡 [문서 원점 고정]
// 키보드가 문서를 밀어도 루트만 되돌립니다. 본문과 가로 툴바의 내부 스크롤은 대상이 아닙니다.
const keepDocumentAtOrigin = (): void => {
  const html = document.documentElement;
  const body = document.body;
  if (html.scrollTop !== 0) html.scrollTop = 0;
  if (body.scrollTop !== 0) body.scrollTop = 0;
  if (window.scrollY !== 0 || (window.visualViewport?.offsetTop ?? 0) > 0) {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
};

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
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyLeft: body.style.left,
        bodyWidth: body.style.width,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      };
      html.style.overflow = "hidden";
      html.style.overscrollBehavior = "none";
      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "none";
      // 💡 [모바일 키보드 배경 고정]
      // 키보드가 열리면 숨김 설정만으로 문서가 움직일 수 있어, 현재 목록 위치 그대로 본문 전체를 고정합니다.
      body.style.position = "fixed";
      body.style.top = `-${originalStyles.scrollY}px`;
      body.style.left = `-${originalStyles.scrollX}px`;
      body.style.width = "100%";
      keepDocumentAtOrigin();
      window.addEventListener("scroll", keepDocumentAtOrigin, { passive: true });
      window.visualViewport?.addEventListener("scroll", keepDocumentAtOrigin, { passive: true });
      window.visualViewport?.addEventListener("resize", keepDocumentAtOrigin, { passive: true });
    }

    activeLockCount += 1;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);
      if (activeLockCount > 0 || !originalStyles) return;

      window.removeEventListener("scroll", keepDocumentAtOrigin);
      window.visualViewport?.removeEventListener("scroll", keepDocumentAtOrigin);
      window.visualViewport?.removeEventListener("resize", keepDocumentAtOrigin);

      html.style.overflow = originalStyles.htmlOverflow;
      html.style.overscrollBehavior = originalStyles.htmlOverscrollBehavior;
      body.style.overflow = originalStyles.bodyOverflow;
      body.style.overscrollBehavior = originalStyles.bodyOverscrollBehavior;
      body.style.position = originalStyles.bodyPosition;
      body.style.top = originalStyles.bodyTop;
      body.style.left = originalStyles.bodyLeft;
      body.style.width = originalStyles.bodyWidth;
      // 마지막 팝업을 닫을 때 고정을 해제하고 사용자가 보던 메모 위치로 즉시 돌아갑니다.
      window.scrollTo({ left: originalStyles.scrollX, top: originalStyles.scrollY, behavior: "instant" });
      originalStyles = null;
    };
  }, [isLocked]);
}
