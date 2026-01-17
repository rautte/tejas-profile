// src/data/App/index.js
// App-level “data only” (no JSX, no hooks, no logic)

export const DEFAULT_SECTION = "About Me";

/**
 * Section order for:
 * - keyboard / boundary navigation (next/prev)
 * - snap traversal
 * - any linear flows
 */
export const SECTION_ORDER = [
  "About Me",
  "Experience",
  "Skills",
  "Education",
  "Resume",
  "Projects",
  "Code Lab",
  "Fun Zone",
  "Timeline",
  "Analytics",
  "Data",
  "Settings",
];

/**
 * Sidebar nav composition.
 * Keep these as label strings so UI can decide icons, styling, etc.
 */
export const SIDEBAR_GROUPS = {
  pinned: ["About Me"],
  recruiter: ["Experience", "Skills", "Education", "Resume"],
  hiringManager: ["Projects", "Code Lab", "Fun Zone"],
  explore: ["Timeline"],
  admin: ["Analytics", "Data", "Settings"],
};
