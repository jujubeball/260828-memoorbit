import type { Memo } from "@/types/memo";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;

// 날짜를 공유 이미지에 약속된 `YYYY.MM.DD` 형식으로 표시합니다.
const formatMemoryDate = (iso: string): string => {
  const date = new Date(iso);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join(".");
};

// 💡 [Canvas 둥근 사각형 경로]
// 사각형의 위치와 크기를 받아 폴라로이드 카드와 이미지 영역에 사용할 둥근 테두리 모양을 만듭니다.
const createRoundedRectPath = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

// 💡 [이미지 비율 유지 렌더링]
// 원본 사진의 가로세로 비율을 유지하면서 지정된 사진 칸을 빈틈없이 덮도록 중앙을 기준으로 잘라 그립니다.
const drawCoverImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
};

// 브라우저가 이미지 주소를 모두 읽을 때까지 기다리고, 외부 서버 이미지에는 Canvas 사용을 위한 CORS 요청을 보냅니다.
const loadCanvasImage = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  if (!source.startsWith("data:")) image.crossOrigin = "anonymous";
  image.addEventListener("load", () => resolve(image), { once: true });
  image.addEventListener("error", () => reject(new Error("공유 이미지 원본을 불러오지 못했습니다.")), { once: true });
  image.src = source;
});

// 💡 [사진 또는 안전한 대체 배경 렌더링]
// 첨부 이미지를 먼저 시도하고 CORS 등으로 실패하면 개인정보나 원본 주소 대신 브랜드 그라데이션을 그립니다.
const drawMemoryPhoto = async (
  context: CanvasRenderingContext2D,
  source?: string,
): Promise<void> => {
  context.save();
  createRoundedRectPath(context, 24, 24, 352, 264, 14);
  context.clip();

  if (source) {
    try {
      const image = await loadCanvasImage(source);
      drawCoverImage(context, image, 24, 24, 352, 264);
      context.restore();
      return;
    } catch {
      // 외부 이미지가 Canvas 사용을 허용하지 않아도 아래 브랜드 배경으로 계속 내보냅니다.
    }
  }

  const gradient = context.createLinearGradient(24, 24, 376, 288);
  gradient.addColorStop(0, "#E5A93C");
  gradient.addColorStop(0.5, "#454B5E");
  gradient.addColorStop(1, "#0F1117");
  context.fillStyle = gradient;
  context.fillRect(24, 24, 352, 264);
  context.restore();
};

// 긴 제목을 최대 두 줄로 나눠 카드 폭을 넘지 않도록 그립니다.
const drawWrappedTitle = (
  context: CanvasRenderingContext2D,
  title: string,
): void => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  words.forEach((word) => {
    const current = lines.at(-1) ?? "";
    const next = current ? `${current} ${word}` : word;
    if (current && context.measureText(next).width > 336) lines.push(word);
    else if (lines.length === 0) lines.push(next);
    else lines[lines.length - 1] = next;
  });
  lines.slice(0, 2).forEach((line, index) => context.fillText(line, 32, 340 + index * 27));
};

// Canvas를 PNG 파일 데이터로 바꿔 주는 비동기 도우미입니다.
const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("공유 이미지를 PNG로 변환하지 못했습니다."));
  }, "image/png");
});

// 💡 [추억 폴라로이드 이미지 내보내기]
// Memo 객체에서 이미지·제목·날짜·태그만 꺼내 400×500 Canvas에 다시 그리고, 메타데이터 없는 새 PNG로 다운로드합니다.
export const exportMemoryImage = async (memo: Memo): Promise<void> => {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이 브라우저에서는 이미지 합성을 지원하지 않습니다.");

  context.fillStyle = "#0F1117";
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  createRoundedRectPath(context, 10, 10, 380, 480, 20);
  context.fillStyle = "#1A1D26";
  context.fill();
  context.strokeStyle = "#2A2E3D";
  context.lineWidth = 2;
  context.stroke();

  await drawMemoryPhoto(context, memo.imageUrl ?? memo.aiImageUrl);

  context.fillStyle = "#F3F4F6";
  context.font = "700 20px system-ui, sans-serif";
  drawWrappedTitle(context, memo.title || "제목 없음");

  context.fillStyle = "#9CA3AF";
  context.font = "14px system-ui, sans-serif";
  context.fillText(formatMemoryDate(memo.createdAt), 32, 400);

  context.fillStyle = "#FFC86B";
  context.font = "600 13px system-ui, sans-serif";
  const tags = memo.tags.slice(0, 4).map((tag) => `#${tag}`).join("  ");
  context.fillText(tags || "#MemoryOrbit", 32, 435, 336);

  context.fillStyle = "#E5A93C";
  context.font = "700 12px system-ui, sans-serif";
  context.fillText("MEMOORBIT · MEMORY", 32, 468);

  const blob = await canvasToBlob(canvas);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `MemoOrbit_추억_${formatMemoryDate(memo.createdAt).replaceAll(".", "")}.png`;
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};
