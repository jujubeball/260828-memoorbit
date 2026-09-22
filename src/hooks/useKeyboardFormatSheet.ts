"use client";

import { useCallback, useState } from "react";

interface KeyboardFormatSheetState {
  mode: "editor" | "format";
}

// 💡 [키보드를 유지하는 서식 패널]
// 높이 복원을 기다리지 않고 즉시 패널을 엽니다. 본문의 편집 가능 여부는 변경하지 않습니다.
export function useKeyboardFormatSheet(active: boolean) {
  const [state, setState] = useState<KeyboardFormatSheetState>({ mode: "editor" });
  const open = useCallback(() => setState({ mode: "format" }), []);
  const close = useCallback(() => setState({ mode: "editor" }), []);
  return { mode: active ? state.mode : "editor", open, close };
}
