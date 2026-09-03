// src/data/App/index.js
// App-level “data only” (no JSX, no hooks, no logic)

import {
  DEFAULT_SECTION,
  PUBLIC_SECTION_ORDER,
  SIDEBAR_GROUPS as PUBLIC_SIDEBAR_GROUPS,
} from "../structure";

export { DEFAULT_SECTION, PUBLIC_SECTION_ORDER };

/**
 * IMPORTANT:
 * PUBLIC_SECTION_ORDER is also the canonical analytics section
 * registry (see utils/analytics/tracker.js). Admin pages must never
 * appear in visitor engagement metrics -- this fixed vocabulary is
 * intentionally independent of any owner-editable structure.
 */

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
  ...PUBLIC_SIDEBAR_GROUPS,
  admin: ADMIN_SECTION_ORDER,
};