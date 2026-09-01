import type { ImageMood } from "@/types/memo";

const MOOD_COLORS: Record<ImageMood, [string, string, string]> = {
  수채화: ["#f7d6b5", "#b8d8d8", "#7a9e9f"],
  네온: ["#15102b", "#6d28d9", "#22d3ee"],
  흑백: ["#111827", "#6b7280", "#e5e7eb"],
  빈티지: ["#3f2d20", "#a67c52", "#e8d8b8"],
};

const hashText = (value: string): number =>
  [...value].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);

const escapeSvg = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const createMemoImageDataUrl = (sourceText: string, mood: ImageMood): string => {
  const [start, middle, end] = MOOD_COLORS[mood];
  const seed = Math.abs(hashText(`${mood}:${sourceText}`));
  const x = 18 + (seed % 64);
  const y = 20 + ((seed >> 3) % 54);
  const caption = escapeSvg(sourceText.trim().slice(0, 42) || "기억의 한 장면");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${start}" />
          <stop offset="0.55" stop-color="${middle}" />
          <stop offset="1" stop-color="${end}" />
        </linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="55" /></filter>
      </defs>
      <rect width="1200" height="720" fill="url(#background)" />
      <circle cx="${x}%" cy="${y}%" r="190" fill="${end}" opacity="0.38" filter="url(#blur)" />
      <circle cx="${100 - x}%" cy="${100 - y}%" r="230" fill="${start}" opacity="0.32" filter="url(#blur)" />
      <rect x="70" y="535" width="1060" height="115" rx="28" fill="#000" opacity="0.24" />
      <text x="105" y="600" fill="#fff" font-size="34" font-family="sans-serif" font-weight="600">${caption}</text>
      <text x="105" y="630" fill="#fff" opacity="0.7" font-size="18" font-family="sans-serif">MemoOrbit · ${mood}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
