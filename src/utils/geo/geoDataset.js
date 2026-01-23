// src/utils/geo/geoDataset.js

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LS_KEY = "tejas_profile_geo_dataset_v1";

let memCache = null;
let memCacheAt = 0;

/**
 * Expected dataset shape:
 * [
 *  { id, display, city, region?, country?, countryCode, lat, lng }
 * ]
 */
export async function loadGeoDataset({ ttlMs = DEFAULT_TTL_MS } = {}) {
  const url = (process.env.REACT_APP_GEO_DATASET_URL || "").trim();

  // 1) If already in memory and fresh, return immediately
  if (memCache && Date.now() - memCacheAt < ttlMs) return memCache;

  // 2) Try localStorage cache
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.data) &&
        typeof parsed.savedAt === "number" &&
        Date.now() - parsed.savedAt < ttlMs
      ) {
        memCache = parsed.data;
        memCacheAt = parsed.savedAt;
        return memCache;
      }
    }
  } catch {
    // ignore cache errors
  }

  // 3) If URL missing, return empty (UI should allow manual typing)
  if (!url) {
    memCache = [];
    memCacheAt = Date.now();
    return memCache;
  }

  // 4) Fetch remote dataset
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    memCache = [];
    memCacheAt = Date.now();
    return memCache;
  }

  const json = await res.json();
  const data = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];

  // Basic normalize (no crashes if fields missing)
  const normalized = data
    .map((r, i) => {
      const city = String(r.city || "").trim();
      const cc = String(r.countryCode || "").trim().toUpperCase();
      const display = String(r.display || `${city}${cc ? ", " + cc : ""}`).trim();
      const lat = typeof r.lat === "number" ? r.lat : null;
      const lng = typeof r.lng === "number" ? r.lng : null;

      if (!city || !cc) return null;

      return {
        id: String(r.id || `${cc}:${city}:${i}`),
        display,
        city,
        region: r.region ? String(r.region) : null,
        country: r.country ? String(r.country) : null,
        countryCode: cc,
        lat,
        lng,
      };
    })
    .filter(Boolean);

  memCache = normalized;
  memCacheAt = Date.now();

  // 5) Save to localStorage
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ savedAt: memCacheAt, data: memCache })
    );
  } catch {
    // ignore cache write errors
  }

  return memCache;
}

export function searchGeo(dataset, query, limit = 8) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  const list = Array.isArray(dataset) ? dataset : [];

  // Prefix-ish matching: city, display, and "city, CC"
  const scored = [];
  for (const r of list) {
    const city = String(r.city || "").toLowerCase();
    const disp = String(r.display || "").toLowerCase();
    const cc = String(r.countryCode || "").toLowerCase();
    const cityCc = `${city}, ${cc}`;

    // scoring: startsWith city > startsWith display > includes
    let score = -1;
    if (city.startsWith(q)) score = 3;
    else if (disp.startsWith(q)) score = 2;
    else if (cityCc.startsWith(q)) score = 2;
    else if (disp.includes(q)) score = 1;

    if (score > 0) scored.push({ r, score });
  }

  scored.sort((a, b) => b.score - a.score || a.r.display.localeCompare(b.r.display));
  return scored.slice(0, limit).map((x) => x.r);
}
