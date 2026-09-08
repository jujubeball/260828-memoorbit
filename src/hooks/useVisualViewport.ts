"use client";

import { useEffect, useState } from "react";

interface VisualViewportState {
  height: number | null;
  offsetTop: number;
}

export function useVisualViewport(active = true): VisualViewportState {
  // 서버에서는 창 크기를 알 수 없으므로 기본 CSS 높이를 사용합니다.
  const [viewport, setViewport] = useState<VisualViewportState>({ height: null, offsetTop: 0 });

  // 💡 [가시 영역 추적]
  // 키보드와 화면 크기 변경만 한 프레임으로 묶습니다. 스크롤마다 위치를 바꾸면 iOS의 화면 보정과 서로 반복되어 모달이 떨릴 수 있습니다.
  useEffect(() => {
    if (!active) return;
    const visualViewport = window.visualViewport;
    let frame = 0;
    const measure = (): void => {
      // 키보드 경계의 소수점 흔들림은 정수 픽셀로 정규화하고 실제 크기 변화만 전달합니다.
      const height = Math.round(visualViewport?.height ?? window.innerHeight);
      const offsetTop = Math.max(0, Math.round(visualViewport?.offsetTop ?? 0));
      setViewport((current) => current.height === height && current.offsetTop === offsetTop
        ? current
        : { height, offsetTop });
    };
    const schedule = (): void => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    schedule();
    visualViewport?.addEventListener("resize", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      visualViewport?.removeEventListener("resize", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [active]);

  return viewport;
}
