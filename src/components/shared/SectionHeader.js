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
        "flex flex-col sm:flex-row justify-between items-center gap-4 px-6 mb-10",
        className
      )}
    >
      <div className="w-full">
        <h2 className={SECTION_TITLE}>
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
