// src/utils/cx.js
export function cx(...parts) {
  return parts.flat().filter(Boolean).join(" ");
}
