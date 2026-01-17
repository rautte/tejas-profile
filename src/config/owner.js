// src/configs/owner.js

export const OWNER_SECRET = process.env.REACT_APP_OWNER_SECRET;
export const OWNER_SESSION_KEY = "tejas_profile_owner_enabled";

if (!OWNER_SECRET) {
  console.warn("[OwnerMode] Missing REACT_APP_OWNER_SECRET");
}

