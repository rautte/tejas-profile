import React from "react";
import { cx } from "../../utils/cx";

export default function MobileDockNav({ items, activeId, onSelect }) {
  const scrollerRef = React.useRef(null);

  // Auto-scroll the active item into view (centered) when it changes
  React.useEffect(() => {
    const el = scrollerRef.current?.querySelector(
      `[data-dock-item="${activeId}"]`
    );
    el?.scrollIntoView?.({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeId]);

  return (
    <nav
      className={cx(
        "md:hidden fixed left-0 right-0 bottom-0 z-[60]",
        "px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2",
        "backdrop-blur-xl bg-white/70 dark:bg-[#0b0b12]/60",
        "border-t border-gray-200/70 dark:border-white/10"
      )}
      aria-label="Mobile bottom navigation"
    >
      <div className="mx-auto max-w-4xl">
        {/* Horizontal scrollable dock */}
        <div
          ref={scrollerRef}
          className={cx(
            "flex items-stretch gap-2",
            "overflow-x-auto whitespace-nowrap",
            "snap-x snap-mandatory",
            "no-scrollbar",
            "pb-1"
          )}
        >
          {items.map((it) => {
            const active = it.id === activeId;
            return (
              <button
                key={it.id}
                data-dock-item={it.id}
                type="button"
                onClick={() => onSelect(it.id)}
                className={cx(
                  "snap-start shrink-0",
                  "relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 px-3 min-w-[72px]",
                  "transition",
                  active
                    ? "bg-purple-100 dark:bg-purple-800/50"
                    : "hover:bg-gray-100/70 dark:hover:bg-white/5"
                )}
                aria-current={active ? "page" : undefined}
                aria-label={it.label}
              >
                <span
                  className={cx(
                    "text-[18px] leading-none",
                    active
                      ? "text-purple-700 dark:text-purple-200"
                      : "text-gray-700 dark:text-gray-200"
                  )}
                >
                  {it.icon}
                </span>

                <span
                  className={cx(
                    "text-[10px] font-medium",
                    active
                      ? "text-purple-700 dark:text-purple-200"
                      : "text-gray-600 dark:text-gray-300"
                  )}
                >
                  {it.shortLabel ?? it.label}
                </span>

                {active && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full bg-purple-500/80" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Local CSS for hiding scrollbar (kept scoped to this component) */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </nav>
  );
}
