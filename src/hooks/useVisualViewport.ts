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
  // 키보드와 화면 이동 이벤트를 한 프레임으로 묶어 모달에 실제 보이는 영역을 전달합니다.
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
    visualViewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      visualViewport?.removeEventListener("resize", schedule);
      visualViewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [active]);

  return viewport;
}
