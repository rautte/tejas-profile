// src/lib/resume/template.js
// Small helpers to keep <Resume /> clean.

export function normalizeUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

export function mailto(email) {
  return email ? `mailto:${email}` : "";
}
