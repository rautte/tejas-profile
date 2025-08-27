// src/assets/ships/sprites/side.cdn.ts

/**
 * CDN base selection:
 * - First, REACT_APP_CDN_BASE (CRA & many bundlers)
 * - Then, VITE_CDN_BASE (Vite)
 * - Then, window.__CDN_BASE__ (can be set at runtime)
 * - Finally, the hard-coded CloudFront domain from your CDK outputs
 */
function pickCdnBase(): string {
  // REACT_APP_* (CRA)
  try {
    const v = (process as any)?.env?.REACT_APP_CDN_BASE;
    if (typeof v === "string" && v) return v;
  } catch {}

  // Vite
  try {
    const v = (import.meta as any)?.env?.VITE_CDN_BASE;
    if (typeof v === "string" && v) return v;
  } catch {}

  // Runtime global override
  try {
    const v = (window as any).__CDN_BASE__;
    if (typeof v === "string" && v) return v;
  } catch {}

  // Fallback to your deployed distribution
  return "https://d2n9g8msgr1y81.cloudfront.net";
}

const CDN_BASE = pickCdnBase();

/** Ship-ID → folder key. Adjust if you want different ship order. */
const SHIP_ID_TO_KEY: Record<number, string> = {
  1: "lcs-independence",
  2: "lcs-freedom",
  3: "k130",
  4: "saar6",
  5: "visby",
};

const DEFAULT_FRAME_COUNT = 250;

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

/**
 * Returns an array of frame URLs for the given ship id.
 * By default we assume 250 frames named 0001.png … 0250.png in:
 *   /ships/sprites/<key>/side/<frame>.png
 */
export function getSideFrames(shipId: number, frameCount = DEFAULT_FRAME_COUNT): string[] {
  const key = SHIP_ID_TO_KEY[shipId] ?? SHIP_ID_TO_KEY[1];
  const base = `${CDN_BASE}/ships/sprites/${key}/side`;
  const frames: string[] = new Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    frames[i] = `${base}/${pad4(i + 1)}.png`;
  }
  return frames;
}

/** In case someone wants to probe which CDN is in use */
export const SIDE_CDN_BASE = CDN_BASE;
