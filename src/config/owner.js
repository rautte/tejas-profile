export const OWNER_PARAM = process.env.REACT_APP_OWNER_PARAM;
export const OWNER_SECRET = process.env.REACT_APP_OWNER_SECRET;
export const OWNER_SESSION_KEY = "tejas_profile_owner_enabled";

if (!OWNER_PARAM || !OWNER_SECRET) {
  console.warn(
    "[OwnerMode] Missing REACT_APP_OWNER_PARAM or REACT_APP_OWNER_SECRET"
  );
}
