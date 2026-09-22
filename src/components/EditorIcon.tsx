interface EditorIconProps {
  name: "plus" | "back" | "undo" | "share" | "more" | "check" | "close" | "clip" | "pen" | "link" | "palette" | "inset" | "mic" | "search" | "format" | "checklist" | "table" | "camera" | "compose" | "dash" | "bullet" | "number" | "outdent" | "indent" | "tag";
  className?: string;
}

// 같은 좌표계와 선 굵기를 공유하며 접근성 이름은 바깥 버튼에서 제공합니다.
export function EditorIcon({ name, className = "h-6 w-6" }: EditorIconProps): React.JSX.Element {
  const paths: Record<EditorIconProps["name"], string> = {
    plus: "M12 4v16M4 12h16",
    back: "M15 4l-8 8 8 8",
    undo: "M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12",
    share: "M12 15V2M7 7l5-5 5 5M5 10H3v12h18V10h-2",
    more: "M4 12h.01M12 12h.01M20 12h.01",
    check: "M5 12l4 4L19 6",
    close: "M6 6l12 12M18 6 6 18",
    clip: "M8 15l8-8a3 3 0 0 1 4 4L10 21a5 5 0 0 1-7-7L14 3",
    pen: "M4 20l1-6L17 2l5 5L10 19zM14 5l5 5M4 20l6-1",
    link: "M9 15l6-6M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
    palette: "M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a3 3 0 0 0 3-3 9 9 0 0 0-9-7M7 8h.01M12 6h.01M17 8h.01M5 13h.01",
    inset: "M3 3h18v18H3zM7 7v10M11 8h6M11 12h6M11 16h6",
    mic: "M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0zM5 10v2a7 7 0 0 0 14 0v-2M12 19v4M8 23h8",
    search: "M16 16l6 6M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    format: "M2 5h6v7l-6 6M11 4v16M11 11h3M16 11h4v4l-4 4M22 10v10M22 15h1",
    dash: "M2 6h3M2 12h3M2 18h3M9 6h12M9 12h12M9 18h12",
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
