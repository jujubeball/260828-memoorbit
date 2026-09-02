interface MemoOrbitDefaultCoverProps {
  title?: string;
  className?: string;
}

// 💡 [MemoOrbit 기본 커버]
// 사용자가 사진을 첨부하지 않은 메모가 빈칸으로 보이지 않도록, 제목과 브랜드 궤도 그래픽을 카드와 편집 화면에 함께 제공합니다.
export function MemoOrbitDefaultCover({
  title,
  className = "",
}: MemoOrbitDefaultCoverProps): React.JSX.Element {
  return (
    <div
      role="img"
      aria-label={`${title || "기록된 생각의 궤도"} 기본 커버`}
      className={`relative flex h-full min-h-36 w-full select-none items-center justify-center overflow-hidden bg-[#0f1117] p-4 ${className}`}
    >
      <svg
        className="absolute inset-0 h-full w-full opacity-60"
        viewBox="0 0 320 180"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="memo-orbit-glow">
            <stop offset="0" stopColor="#ffc86b" stopOpacity="0.8" />
            <stop offset="1" stopColor="#e5a93c" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx="160"
          cy="90"
          rx="126"
          ry="48"
          fill="none"
          stroke="#e5a93c"
          strokeWidth="2"
          strokeDasharray="8 7"
          transform="rotate(-10 160 90)"
        />
        <ellipse
          cx="160"
          cy="90"
          rx="92"
          ry="70"
          fill="none"
          stroke="#2a2e3d"
          strokeWidth="1.5"
          transform="rotate(22 160 90)"
        />
        <circle cx="160" cy="90" r="38" fill="url(#memo-orbit-glow)" />
        <circle cx="160" cy="90" r="16" fill="#e5a93c" />
        <circle cx="271" cy="57" r="7" fill="#9ca3af" />
      </svg>
      <div className="relative z-10 flex max-w-[85%] flex-col items-center gap-1 text-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#e5a93c]">
          MemoOrbit
        </span>
        <p className="line-clamp-1 text-xs font-medium text-[#9ca3af]">
          {title || "기록된 생각의 궤도"}
        </p>
      </div>
    </div>
  );
}
