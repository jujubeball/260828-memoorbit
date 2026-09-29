import type { ButtonHTMLAttributes } from "react";
import { EditorIcon } from "@/src/components/EditorIcon";

interface LayerCloseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "type"> {
  "aria-label": string;
}

// 각 레이어가 전달한 닫기·선택 보존 이벤트는 유지하고, X의 모양만 한곳에서 관리합니다.
export function LayerCloseButton(props: LayerCloseButtonProps): React.JSX.Element {
  return (
    <button
      {...props}
      type="button"
      className="w-7 h-7 rounded-full bg-slate-700/80 flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-600 transition-colors shadow-sm shrink-0"
    >
      <EditorIcon name="close" className="w-4 h-4" />
    </button>
  );
}
