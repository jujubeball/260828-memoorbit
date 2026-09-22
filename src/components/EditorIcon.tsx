interface EditorIconProps {
  name: "format" | "checklist" | "table" | "camera" | "compose" | "bullet" | "number" | "outdent" | "indent" | "tag";
  className?: string;
}

// 같은 좌표계와 선 굵기를 공유하며 접근성 이름은 바깥 버튼에서 제공합니다.
export function EditorIcon({ name, className = "h-6 w-6" }: EditorIconProps): React.JSX.Element {
  const paths: Record<EditorIconProps["name"], string> = {
    format: "M2 19 8 5l6 14M4 14h8M16 11c5-3 6 1 6 3v5M22 14c-8-2-8 7 0 3",
    checklist: "M9 12l2 2 5-5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    table: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18",
    camera: "M8 5l2-2h4l2 2h5v15H3V5zM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    compose: "M12 4H4v16h16v-8M14 5l5 5M10 14l-1 1 1-5L19 1l4 4-9 9z",
    bullet: "M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01",
    number: "M10 6h11M10 12h11M10 18h11M3 3h1v6M2 9h4M2 14c0-3 5-3 4 0l-4 6h4",
    outdent: "M10 5h11M10 12h11M10 19h11M6 8l-4 4 4 4",
    indent: "M10 5h11M10 12h11M10 19h11M2 8l4 4-4 4",
    tag: "M3 3h8l10 10-8 8L3 11zM7 7h.01",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
