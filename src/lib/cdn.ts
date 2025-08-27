// src/lib/cdn.ts
export const CDN_BASE =
  (import.meta as any).env?.VITE_CDN_BASE ||
  process.env.PUBLIC_CDN_BASE_URL ||
  "https://d2n9g8msgr1y81.cloudfront.net";

export const cdnUrl = (p: string) =>
  `${CDN_BASE}${p.startsWith("/") ? "" : "/"}${p}`;

