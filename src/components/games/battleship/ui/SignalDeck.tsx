// src/components/games/battleship/ui/SignalDeck.tsx
import React from "react";
import type { Role } from "lib/mp";

export type IntelLine = {
  id: number;
  t: number;
  voice: "CIC" | "Ops" | "Gunnery";
  text: string;
  flavor?: boolean;
};

// NEW: extracted props type
export type SignalDeckProps = {
  role: Role;
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  roleLabel: Role;
  log: IntelLine[];
  /** Optional pixel cap for the scroll area, lets caller sync to board height. */
  maxHeight?: number;
};

export const SignalDeck: React.FC<SignalDeckProps> = ({ role, Icon, roleLabel, log, maxHeight }) => {
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log]);

  const bubbleBgClass = role === "host" ? "bg-blue-600/10" : "bg-emerald-600/10";

  return (
    <div
      className="
        relative overflow-hidden
        rounded-2xl p-3
        bg-white/[0.08] dark:bg-white/[0.045]
        backdrop-blur-xl backdrop-saturate-150
        border border-white/15 dark:border-white/[0.06]
        ring-1 ring-white/[0.06] dark:ring-black/[0.25]
        shadow-lg
      "
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-white/10 to-transparent dark:from-gray-800/50 dark:via-gray-900/30 dark:to-transparent" />

      <div className="relative z-10 flex items-center gap-2 pb-2">
        <span
          className={`inline-flex items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 ${bubbleBgClass}`}
          style={{ width: 24, height: 24 }}
        >
          <Icon width={18} height={18} aria-hidden />
        </span>
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Signal Deck{" "}
          <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
            ({roleLabel})
          </span>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="
          relative z-10 mt-1 pr-1
          max-h-[20vh] overflow-y-auto
          text-[13px] leading-5 text-gray-800 dark:text-gray-100
          scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent
        "
        /* UPDATED: apply px string if provided */
        style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined }}
        aria-live="polite"
        aria-label="Signal Deck messages"
      >
        {log.length === 0 ? (
          <div className="text-xs text-gray-5 00 dark:text-gray-400">CIC link standing by…</div>
        ) : (
          <ul className="space-y-1.5">
            {log.map((ln) => (
              <li key={ln.id} className="flex gap-3">
                <span className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {ln.voice}
                </span>
                <span className={ln.flavor ? "text-gray-700 dark:text-gray-200" : ""}>{ln.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
