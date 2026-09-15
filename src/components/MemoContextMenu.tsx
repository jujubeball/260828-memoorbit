"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Memo } from "@/types/memo";

export interface MemoMenuPosition {
  left: number;
  top: number;
}

interface MemoContextMenuProps {
  memo: Memo;
  position: MemoMenuPosition;
  onClose: () => void;
  onTogglePin: (id: string) => void;
  onEditTags: (memo: Memo) => void;
  onDelete: (memo: Memo) => void;
}

export function MemoContextMenu({ memo, position, onClose, onTogglePin, onEditTags, onDelete }: MemoContextMenuProps): React.JSX.Element {
  // 💡 [메뉴 포커스와 외부 입력]
  // 메뉴를 본문 포털에 띄워 카드의 잘림을 피하고, 닫을 때 원래 조작 위치로 키보드 포커스를 돌려줍니다.
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    menuRef.current?.querySelector("button")?.focus();
    const dismiss = (event: Event): void => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [onClose]);

  // 메뉴 선택은 부모의 기존 저장·태그 편집·삭제 확인 흐름으로 전달합니다.
  const actions = [
    { label: memo.isPinned ? "📌 고정 해제" : "📌 고정", run: () => onTogglePin(memo.id) },
    { label: "🏷️ 태그 변경", run: () => onEditTags(memo) },
    { label: "🗑️ 삭제", run: () => onDelete(memo) },
  ];
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="메모 작업"
      className="fixed z-[60] w-44 rounded-xl border border-[#2a2e3d] bg-[#1a1d26] p-1 text-[#f3f4f6] shadow-xl"
      style={{ left: Math.max(8, Math.min(position.left, window.innerWidth - 184)), top: Math.max(8, Math.min(position.top, window.innerHeight - 148)) }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          className="block h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-white/10 focus:bg-white/10"
          onClick={() => {
            onClose();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
