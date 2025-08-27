// src/assets/ships/sprites/top.cdn.ts

function pickCdnBase(): string {
  try {
    const v = (process as any)?.env?.REACT_APP_CDN_BASE;
    if (typeof v === "string" && v) return v;
  } catch {}
  try {
    const v = (import.meta as any)?.env?.VITE_CDN_BASE;
    if (typeof v === "string" && v) return v;
  } catch {}
  try {
    const v = (window as any).__CDN_BASE__;
    if (typeof v === "string" && v) return v;
  } catch {}
  return "https://d2n9g8msgr1y81.cloudfront.net";
}

const CDN_BASE = pickCdnBase();

/** Ship-ID → folder key. Keep in sync with side.cdn.ts */
const SHIP_ID_TO_KEY: Record<number, string> = {
  1: "k130",
  2: "lcs-freedom",
  3: "lcs-independence",
  4: "saar6",
  5: "visby",
};

/**
 * Minimal "top sprite" mapping expected by your BoardGrid:
 * Record<shipId, url>. We point each ID to its top/north.png on the CDN.
 * If your BoardGrid expects richer data, you can expand this shape later.
 */
export const TOP_SPRITES: Record<number, string> = Object.fromEntries(
  Object.entries(SHIP_ID_TO_KEY).map(([id, key]) => [
    Number(id),
    `${CDN_BASE}/ships/sprites/${key}/top/north.png`,
  ])
);

/** Export base in case other code needs it */
export const TOP_CDN_BASE = CDN_BASE;
