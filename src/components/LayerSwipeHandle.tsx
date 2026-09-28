import { useRef, type PointerEvent } from "react";

interface LayerSwipeHandleProps {
  onClose: () => void;
  label?: string;
}

// 💡 [레이어 아래로 닫기]
// 손잡이에서 시작한 세로 이동만 닫기로 처리하므로 본문 스크롤과 입력창의 텍스트 선택을 방해하지 않습니다.
export function LayerSwipeHandle({ onClose, label = "아래로 밀어 닫기" }: LayerSwipeHandleProps): React.JSX.Element {
  const start = useRef<{ x: number; y: number } | null>(null);
  const finish = (event: PointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    const origin = start.current;
    start.current = null;
    if (origin && event.clientY - origin.y > 70 && event.clientY - origin.y > Math.abs(event.clientX - origin.x)) onClose();
  };
  return (
    <button
      type="button"
      aria-label={label}
      className="mx-auto flex h-6 w-20 shrink-0 touch-none items-center justify-center"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        start.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => event.preventDefault()}
      onPointerUp={finish}
      onPointerCancel={() => { start.current = null; }}
      onClick={(event) => { if (event.detail === 0) onClose(); }}
    >
      <span className="h-1 w-10 rounded-full bg-slate-500" />
    </button>
  );
}
