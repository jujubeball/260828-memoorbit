"use client";

export type NavigationSection = "memos" | "orbit" | "timeline";

interface TopSegmentedNavigationProps {
  activeSection: NavigationSection;
  onSelect: (section: NavigationSection) => void;
  hidden?: boolean;
}

const items: Array<{ id: NavigationSection; label: string }> = [
  { id: "memos", label: "메모 목록" },
  { id: "orbit", label: "태그 궤도" },
  { id: "timeline", label: "시간 뷰" },
];

// 세 화면은 같은 세그먼트 DOM을 공유하고 activeSection에 따라 선택 배경만 이동합니다.
export function TopSegmentedNavigation({ activeSection, onSelect, hidden = false }: TopSegmentedNavigationProps): React.JSX.Element | null {
  if (hidden) return null;
  return (
    <nav
      aria-label="상단 주요 메뉴"
      className="fixed inset-x-0 top-[var(--mobile-header-height)] z-40 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur-md md:hidden"
    >
      <div className="flex rounded-lg bg-slate-800 p-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={activeSection === item.id ? "page" : undefined}
            onClick={() => onSelect(item.id)}
            className={`min-h-9 min-w-0 flex-1 rounded-md px-2 text-xs font-semibold transition-colors ${activeSection === item.id ? "bg-amber-500 text-black shadow-sm" : "text-slate-300"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
