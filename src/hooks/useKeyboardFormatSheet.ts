"use client";

import { useCallback, useEffect, useState } from "react";

interface KeyboardFormatSheetState {
  mode: "editor" | "waiting" | "format";
}

// 💡 [키보드와 서식 시트 교체]
// 포커스를 해제한 뒤 키보드가 차지하던 높이가 복원되고 움직임이 멈춰야 시트를 표시합니다.
export function useKeyboardFormatSheet(active: boolean) {
  const [state, setState] = useState<KeyboardFormatSheetState>({ mode: "editor" });
  const open = useCallback(() => setState({ mode: "waiting" }), []);
  const close = useCallback(() => setState({ mode: "editor" }), []);

  useEffect(() => {
    if (!active || state.mode !== "waiting") return;
    const viewport = window.visualViewport;
    let timer = 0;
    const reveal = (): void => {
      // 가시 높이가 아직 작다면 키보드가 내려오는 중이므로 다음 크기 변경까지 기다립니다.
      if (viewport && Math.round(viewport.height) < Math.round(window.innerHeight) - 2) return;
      setState({ mode: "format" });
    };
    const settle = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(reveal, 160);
    };
    timer = window.setTimeout(reveal, 350);
    viewport?.addEventListener("resize", settle);
    window.addEventListener("resize", settle);
    return () => {
      // 본문 재진입·다른 도구 선택·모달 종료 후 이전 예약이 시트를 다시 열지 않게 합니다.
      window.clearTimeout(timer);
      viewport?.removeEventListener("resize", settle);
      window.removeEventListener("resize", settle);
    };
  }, [active, state.mode]);

  return { mode: state.mode, open, close };
}
