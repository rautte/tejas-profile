// src/assets/ships/sprites/side.cdn.ts

// Resolve CDN base without using import.meta (works in CRA/webpack)
const CDN_BASE: string = (() => {
  try {
    const v = (typeof process !== "undefined" && (process as any)?.env?.REACT_APP_CDN_BASE) as string | undefined;
    if (v) return v;
  } catch {}
  try {
    const v = (typeof window !== "undefined" && (window as any).__CDN_BASE__) as string | undefined;
    if (v) return v;
  } catch {}
  return "https://d2n9g8msgr1y81.cloudfront.net"; // CloudFront fallback
})();

/** Ship-ID → folder key. Keep in sync with top.cdn.ts */
const SHIP_ID_TO_KEY: Record<number, string> = {
  1: "lcs-independence",
  2: "lcs-freedom",
  3: "k130",
  4: "saar6",
  5: "visby",
};

const DEFAULT_FRAME_COUNT = 240;
const pad4 = (n: number) => String(n).padStart(4, "0");

/** Build CDN URLs for side frames 0001.png … N.png */
export function getSideFrames(shipId: number, frameCount = DEFAULT_FRAME_COUNT): string[] {
  const key = SHIP_ID_TO_KEY[shipId] ?? SHIP_ID_TO_KEY[1];
  const base = `${CDN_BASE}/ships/sprites/${key}/side`;
  const frames: string[] = new Array(frameCount);
  for (let i = 0; i < frameCount; i++) frames[i] = `${base}/${pad4(i + 1)}.png`;
  return frames;
}

/* ---------- WARMER ---------- */
const warmed = new Set<number>();

/**
 * Prefetches & decodes the first chunk of frames so switching ships is instant.
 * - prefetchCount hints the network (via <link rel="prefetch">)
 * - decodeCount actually decodes a subset off-thread (Image.decode)
 */
export async function warmSideFrames(shipId: number, prefetchCount = 48, decodeCount = 24) {
  if (warmed.has(shipId)) return;
  warmed.add(shipId);

  try {
    const urls = getSideFrames(shipId);
    const head = typeof document !== "undefined" ? document.head : null;

    if (head) {
      for (let i = 0; i < Math.min(prefetchCount, urls.length); i++) {
        const l = document.createElement("link");
        l.rel = "prefetch";
        l.as = "image";
        l.href = urls[i];
        head.appendChild(l);
      }
    }

    const tasks: Promise<unknown>[] = [];
    for (let i = 0; i < Math.min(decodeCount, urls.length); i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = urls[i];
      tasks.push(img.decode().catch(() => {}));
    }
    await Promise.allSettled(tasks);
  } catch {}
}
/* ---------- end add ---------- */

export const SIDE_CDN_BASE = CDN_BASE;

