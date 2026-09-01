import type { ReactNode } from "react";

interface MainContentHeaderProps {
  id: string;
  label: string;
  title: string;
  description: string;
  badge?: string;
  action?: ReactNode;
}

export function MainContentHeader({
  id,
  label,
  title,
  description,
  badge,
  action,
}: MainContentHeaderProps): React.JSX.Element {
  return (
    <header>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#e5a93c]">
        {label}
      </p>
      <div className="mb-1 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-2xl font-bold text-[#f3f4f6]">
          <h2 id={id} className="truncate">
            {title}
          </h2>
          {badge && (
            <span className="shrink-0 rounded-full border border-[#2a2e3d] bg-[#1a1d26]/80 px-2.5 py-1 text-xs font-semibold text-[#ffc86b]">
              {badge}
            </span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <p className="mb-6 text-sm text-[#9ca3af]">
        {description}
      </p>
    </header>
  );
}
