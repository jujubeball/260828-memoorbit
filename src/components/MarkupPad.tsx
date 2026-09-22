"use client";

import { useRef, useState, type PointerEvent } from "react";

interface MarkupPadProps {
  onAttach: (url: string) => void;
  onClose: () => void;
}

export function MarkupPad({ onAttach, onClose }: MarkupPadProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  // 💡 [손가락 좌표를 그림 좌표로 변환]
  // 화면에 보이는 캔버스 크기와 저장할 이미지 크기가 달라도 같은 위치에 선을 그립니다.
  const draw = (event: PointerEvent<HTMLCanvasElement>, begin: boolean): void => {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
    if (begin) {
      drawing.current = true;
      canvas.setPointerCapture(event.pointerId);
      context.beginPath();
      context.moveTo(x, y);
    }
    if (!drawing.current) return;
    context.strokeStyle = "#e5a93c";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineTo(x + (begin ? 0.1 : 0), y);
    context.stroke();
    setHasDrawing(true);
  };

  return (
    <section aria-label="마크업" className="rounded-t-3xl bg-slate-900 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <h3>마크업</h3>
        <button type="button" onClick={onClose} className="min-h-11 px-2">취소</button>
        <button type="button" onClick={() => {
          const canvas = canvasRef.current;
          canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
          setHasDrawing(false);
        }} className="min-h-11 px-2">지우기</button>
        <button type="button" disabled={!hasDrawing} onClick={() => {
          if (canvasRef.current) onAttach(canvasRef.current.toDataURL("image/png"));
        }} className="min-h-11 px-2 text-amber-400 disabled:opacity-40">그림 첨부</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        aria-label="손가락이나 펜으로 그림 그리기"
        onPointerDown={(event) => draw(event, true)}
        onPointerMove={(event) => draw(event, false)}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }}
        className="h-40 w-full touch-none rounded-xl border border-slate-700 bg-slate-950"
      />
    </section>
  );
}
