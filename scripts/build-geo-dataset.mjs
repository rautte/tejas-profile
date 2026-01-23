// scripts/build-geo-dataset.mjs
import fs from "fs";
import readline from "readline";
import path from "path";

const INPUT = process.env.GEONAMES_INPUT || "data/geonames/cities5000.txt";
const OUT = process.env.GEO_OUT || "public/geo/major_cities.v1.json";

/**
 * GeoNames cities5000.txt columns (tab-separated):
 * 0 geonameid
 * 1 name
 * 2 asciiname
 * 3 alternatenames
 * 4 latitude
 * 5 longitude
 * 6 feature class
 * 7 feature code
 * 8 country code
 * 9 cc2
 * 10 admin1 code
 * 11 admin2 code
 * 12 admin3 code
 * 13 admin4 code
 * 14 population
 * 15 elevation
 * 16 dem
 * 17 timezone
 * 18 modification date
 */

// Tweak these knobs to match “what you want”
const MIN_POP_GLOBAL = Number(process.env.MIN_POP_GLOBAL || 200_000); // keep only >= 200k
const MAX_PER_COUNTRY = Number(process.env.MAX_PER_COUNTRY || 80);    // cap per country
const MAX_TOTAL = Number(process.env.MAX_TOTAL || 5000);              // final hard cap

function toNum(s) {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function safeStr(s) {
  return String(s || "").trim();
}

// Optional: small mapping for common admin1 codes -> readable region names
// (If you want full admin names, we can enrich later using admin1CodesASCII.txt)
const ADMIN1_HINTS = {
  US: {
    "WA": "Washington",
    "CA": "California",
    "NY": "New York",
    "TX": "Texas",
  },
};

function buildDisplay({ city, region, countryCode }) {
  const parts = [city, region, countryCode].filter(Boolean);
  return parts.join(", ");
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`Missing input file: ${INPUT}. Download cities5000.txt first.`);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  const byCountry = new Map(); // countryCode -> array of entries

  for await (const line of rl) {
    if (!line || line.startsWith("#")) continue;

    const cols = line.split("\t");
    if (cols.length < 19) continue;

    const geonameid = safeStr(cols[0]);
    const name = safeStr(cols[1]);
    const lat = toNum(cols[4]);
    const lng = toNum(cols[5]);
    const featureClass = safeStr(cols[6]); // "P" for populated place
    const countryCode = safeStr(cols[8]).toUpperCase();
    const admin1 = safeStr(cols[10]); // code (not always human-readable)
    const population = toNum(cols[14]) ?? 0;

    if (!geonameid || !name || !countryCode) continue;
    if (featureClass !== "P") continue;
    if (lat == null || lng == null) continue;
    if (population < MIN_POP_GLOBAL) continue;

    // Best-effort region label:
    // - GeoNames admin1 is a code; for US it’s numeric, for others varies.
    // - Keep it null unless you later enrich it.
    let region = null;

    // If you want to allow manual overrides later, keep region null and rely on display "City, CC".
    // For now, we keep region only when we have a hint mapping.
    if (ADMIN1_HINTS[countryCode] && ADMIN1_HINTS[countryCode][admin1]) {
      region = ADMIN1_HINTS[countryCode][admin1];
    }

    const city = name;
    const display = buildDisplay({ city, region, countryCode });

    const entry = {
      id: geonameid,
      city,
      region,
      country: null, // optional; can be added later via countryInfo.txt mapping
      countryCode,
      lat,
      lng,
      display,
      population,
      source: "geonames",
    };

    const arr = byCountry.get(countryCode) || [];
    arr.push(entry);
    byCountry.set(countryCode, arr);
  }

  // Sort each country by population desc and cap
  const merged = [];
  for (const [cc, arr] of byCountry.entries()) {
    arr.sort((a, b) => (b.population || 0) - (a.population || 0));
    merged.push(...arr.slice(0, MAX_PER_COUNTRY));
  }

  // Global sort and cap
  merged.sort((a, b) => (b.population || 0) - (a.population || 0));
  const final = merged.slice(0, MAX_TOTAL).map((x) => ({
    id: x.id,
    city: x.city,
    region: x.region,
    country: x.country,
    countryCode: x.countryCode,
    lat: x.lat,
    lng: x.lng,
    display: x.display,
    population: x.population,
  }));

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(final, null, 2), "utf8");

  console.log(`Wrote ${final.length} cities -> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
