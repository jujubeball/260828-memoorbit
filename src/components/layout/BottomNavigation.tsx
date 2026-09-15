"use client";

import { useEffect, useState } from "react";

export type NavigationSection = "memos" | "orbit" | "timeline";

interface BottomNavigationProps {
  activeSection: NavigationSection;
  onSelect: (section: NavigationSection) => void;
  hidden?: boolean;
}

interface NavigationItem {
  id: NavigationSection;
  label: string;
  icon: string;
}

const items: NavigationItem[] = [
  { id: "memos", label: "메모 목록", icon: "▤" },
  { id: "orbit", label: "태그 궤도", icon: "◎" },
  { id: "timeline", label: "시간 뷰", icon: "◷" },
];

export function BottomNavigation({ activeSection, onSelect, hidden = false }: BottomNavigationProps): React.JSX.Element | null {
  // 입력 시작부터 포커스 해제까지 탭을 숨겨 가상 키보드 위에서 콘텐츠를 가리지 않게 합니다.
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    let active = true;
    const update = (): void => {
      if (!active) return;
      const element = document.activeElement;
      setIsEditing(element instanceof HTMLElement && (
        element.matches("input:not([type=button]):not([type=checkbox]):not([type=radio]), textarea")
        || element.isContentEditable
      ));
    };
    // 💡 [입력 포커스 전환]
    // 입력 사이를 이동할 때 잠깐 탭이 나타나지 않도록 다음 마이크로태스크에서 최종 포커스를 읽습니다.
    const schedule = (): void => queueMicrotask(update);
    update();
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      active = false;
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
    };
  }, []);

  if (hidden || isEditing) return null;
  return (
    <nav
      aria-label="하단 주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#2a2e3d] bg-[#0f1117]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid h-16 grid-cols-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={activeSection === item.id ? "page" : undefined}
            onClick={() => onSelect(item.id)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 text-xs font-semibold ${activeSection === item.id ? "text-[#ffc86b]" : "text-[#9ca3af]"}`}
          >
            <span aria-hidden="true" className="text-2xl leading-6">
              {item.icon}
            </span>
            <span>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
