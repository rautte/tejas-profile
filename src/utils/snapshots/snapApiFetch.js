// src/utils/snapApiFetch.js
import { OWNER_SESSION_KEY, OWNER_TOKEN_KEY } from "../config/owner";

export function snapFetch(url, opts = {}) {
  const ownerMode = sessionStorage.getItem(OWNER_SESSION_KEY) === "1";
  const token = sessionStorage.getItem(OWNER_TOKEN_KEY) || "";

  const headers = new Headers(opts.headers || {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json");

  if (ownerMode && token) {
    headers.set("x-owner-token", token);
  }

  return fetch(url, { ...opts, headers });
}

