// src/assets/ships/sprites/top.cdn.ts

const CDN_BASE: string = (() => {
  try {
    const v = (typeof process !== "undefined" && (process as any)?.env?.REACT_APP_CDN_BASE) as string | undefined;
    if (v) return v;
  } catch {}
  try {
    const v = (typeof window !== "undefined" && (window as any).__CDN_BASE__) as string | undefined;
    if (v) return v;
  } catch {}
  return "https://d2n9g8msgr1y81.cloudfront.net";
})();

/** Ship-ID → folder key. Keep in sync with side.cdn.ts */
const SHIP_ID_TO_KEY: Record<number, string> = {
  1: "lcs-independence",
  2: "lcs-freedom",
  3: "k130",
  4: "saar6",
  5: "visby",
};

/** Minimal mapping BoardGrid expects: Record<shipId, url> */
export const TOP_SPRITES: Record<number, string> = Object.fromEntries(
  Object.entries(SHIP_ID_TO_KEY).map(([id, key]) => [
    Number(id),
    `${CDN_BASE}/ships/sprites/${key}/top/north.png`,
  ])
);

// src/assets/ships/sprites/top.cdn.ts
export const TOP_NUDGE: Record<number, {N:{x:number;y:number},E:{x:number;y:number},S:{x:number;y:number},W:{x:number;y:number}}> = {
  // Start values for the big hull (id=1). Tweak ±1–3 px to taste.
  1: {
    N: { x:  -4.5, y:  -10 },
    E: { x: 10, y:  -4.5 },
    S: { x:  4.5, y: 10 },
    W: { x:  -10, y:  4.5 },
  },
  2: { N:{x:0,y:0}, E:{x:0,y:0}, S:{x:0,y:0}, W:{x:0,y:0} },
  3: { N:{x:0,y:0}, E:{x:0,y:0}, S:{x:0,y:0}, W:{x:0,y:0} },
  4: { N:{x:0,y:0}, E:{x:0,y:0}, S:{x:0,y:0}, W:{x:0,y:0} },
  5: { N:{x:0,y:0}, E:{x:0,y:0}, S:{x:0,y:0}, W:{x:0,y:0} },
};

export const TOP_CDN_BASE = CDN_BASE;
