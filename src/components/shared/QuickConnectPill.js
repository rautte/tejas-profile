import React from "react";

import {
  getQuickConnectPresentation,
} from "./quickConnectPresentation";

import {
  quickConnectCtaId,
} from "../../utils/analytics/ids";


/**
 * Shared visual pill used by Footer + MobileQuickConnectFab.
 * - No drag logic here (Footer can wrap it if needed).
 * - Visual specs identical to Footer.
 */
export default function QuickConnectPill({
  links = [],
  className = "",
}) {
  return (
    <div
      className={`
        flex items-center gap-8 px-6 h-10
        rounded-2xl sm:rounded-3xl
        bg-gray-400/40 dark:bg-gray-600/40
        backdrop-blur-md
        border border-white/40 dark:border-white/10
        shadow-[0_8px_30px_rgba(0,0,0,0.12)]
        ring-1 ring-white/30 dark:ring-white/10
        select-none
        ${className}
      `}
      role="group"
      aria-label="Quick connect links"
    >
      {links.map((l) => {
        const {
          Icon,
          colorClass,
        } =
          getQuickConnectPresentation(
            l.key
          );
        return (
          <a
            key={l.key}
            href={l.href}
            target={l.href.startsWith("mailto:") ? undefined : "_blank"}
            rel={l.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
            className={`${colorClass} transition`}
            aria-label={l.label}
            data-analytics={quickConnectCtaId(l.key)}
          >
            <Icon size={24} />
          </a>
        );
      })}
    </div>
  );
}
