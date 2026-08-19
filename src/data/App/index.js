// src/data/App/index.js
// App-level “data only” (no JSX, no hooks, no logic)

export const DEFAULT_SECTION = "About Me";

/**
 * Public sections visible to normal visitors.
 *
 * IMPORTANT:
 * This is also the canonical analytics section registry.
 * Admin pages must never appear in visitor engagement metrics.
 */
export const PUBLIC_SECTION_ORDER = [
  "About Me",
  "Experience",
  "Skills",
  "Education",
  "Resume",
  "Projects",
  "Code Lab",
  "Fun Zone",
  "Timeline",
];

export const ADMIN_SECTION_ORDER = [
  "Analytics",
  "Snapshots",
  "Data",
  "Settings",
];

/**
 * Full app navigation order.
 */
export const SECTION_ORDER = [
  ...PUBLIC_SECTION_ORDER,
  ...ADMIN_SECTION_ORDER,
];

export const SIDEBAR_GROUPS = {
  pinned: ["About Me"],
  recruiter: ["Experience", "Skills", "Education", "Resume"],
  hiringManager: ["Projects", "Code Lab", "Fun Zone"],
  explore: ["Timeline"],
  admin: ADMIN_SECTION_ORDER,
};