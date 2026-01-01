import React from "react";
import { FaGithub, FaLinkedin, FaGlobe, FaEnvelope } from "react-icons/fa";
import { FOOTER_LINKS } from "../../data/footer";

const ICONS = {
  linkedin: FaLinkedin,
  github: FaGithub,
  portfolio: FaGlobe,
  email: FaEnvelope,
};

/**
 * Shared visual pill used by Footer + MobileQuickConnectFab.
 * - No drag logic here (Footer can wrap it if needed).
 * - Visual specs identical to Footer.
 */
export default function QuickConnectPill({ className = "" }) {
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
      {FOOTER_LINKS.map((l) => {
        const Icon = ICONS[l.key];
        return (
          <a
            key={l.key}
            href={l.href}
            target={l.href.startsWith("mailto:") ? undefined : "_blank"}
            rel={l.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
            className={`${l.colorClass} transition`}
            aria-label={l.label}
          >
            <Icon size={24} />
          </a>
        );
      })}
    </div>
  );
}
