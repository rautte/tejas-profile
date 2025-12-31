// src/components/shared/SectionHeader.js
import React from "react";
import { cx } from "../../utils/cx";
import { SECTION_ICON, SECTION_TITLE, SECTION_UNDERLINE } from "../../utils/ui";

/**
 * Shared section header (title + optional right slot + optional underline).
 * Keeps alignment consistent across pages.
 */
export default function SectionHeader({
  icon: Icon,
  title,
  right,
  className,
  showUnderline = false,
}) {
  return (
    <div
      className={cx(
        "flex flex-col sm:flex-row justify-between items-center gap-4 mb-8",
        // Mobile padding
        "px-0",
        // Desktop padding unchanged
        "md:px-6 md:mb-10",
        className
      )}
    >
      <div className="w-full">
        <h2
          className={cx(
            SECTION_TITLE,
            // Mobile-only adjustments
            // "justify-center text-center text-2xl",
            "justify-start text-left text-xl",
            // Desktop restores original behavior
            "md:justify-start md:text-left md:text-3xl"
          )}
        >
          {Icon ? <Icon className={SECTION_ICON} /> : null}
          {title}
        </h2>
        {showUnderline ? <div className={SECTION_UNDERLINE} /> : <div />}
      </div>

      {right ? (
        <div className="shrink-0">{right}</div>
      ) : (
        <div className="hidden sm:block" />
      )}
    </div>
  );
}
