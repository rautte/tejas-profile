// src/utils/hashRouting.js

import {
  DEFAULT_SECTION,
  SECTION_ORDER,
} from "../data/App";

/**
 * Canonical slug format used by the application's hash router.
 */
export function toSectionSlug(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const SLUG_TO_LABEL =
  SECTION_ORDER.reduce(
    (acc, label) => {
      acc[toSectionSlug(label)] = label;
      return acc;
    },
    {}
  );

/**
 * Converts a browser hash into the application's normalized route path.
 *
 * Examples:
 *
 * #/experience
 *   -> experience
 *
 * #/code-lab?from=battleship
 *   -> code-lab
 *
 * #/fun-zone/tictactoe
 *   -> fun-zone/tictactoe
 */
export function hashPathFromHash(hash) {
  return String(hash || "")
    .replace(/^#\/?/, "")
    .split("?")[0]
    .toLowerCase();
}

/**
 * Parses supported nested Fun Zone routes.
 *
 * Supported:
 *
 * fun-zone/battleship
 * fun-zone/battleship-AX9G
 * fun-zone/minesweeper
 * fun-zone/tictactoe
 */
export function parseFunZoneRoute(rawHashPath) {
  let path =
    String(rawHashPath || "").trim();

  try {
    path =
      decodeURIComponent(path);
  } catch {
    // Malformed percent encoding must never crash the router.
  }

  path =
    path.toLowerCase();

  if (!path.startsWith("fun-zone/")) {
    return {
      game: null,
      code: null,
    };
  }

  const battleship =
    path.match(
      /^fun-zone\/battleship(?:-([a-z0-9]{4}))?(?:[/?].*)?$/i
    );

  if (battleship) {
    return {
      game: "battleship",
      code: battleship[1]
        ? battleship[1].toUpperCase()
        : null,
    };
  }

  if (
    /^fun-zone\/minesweeper(?:[/?].*)?$/.test(
      path
    )
  ) {
    return {
      game: "minesweeper",
      code: null,
    };
  }

  if (
    /^fun-zone\/tictactoe(?:[/?].*)?$/.test(
      path
    )
  ) {
    return {
      game: "tictactoe",
      code: null,
    };
  }

  return {
    game: null,
    code: null,
  };
}

/**
 * Resolves a browser hash to its top-level application section.
 *
 * Nested game routes intentionally belong to Fun Zone.
 *
 * #/fun-zone/tictactoe
 * #/fun-zone/minesweeper
 * #/fun-zone/battleship
 * #/fun-zone/battleship-AX9G
 *
 * all resolve to:
 *
 * Fun Zone
 */
export function resolveSectionLabelFromHash(
  hash,
  {
    fallbackToDefault = false,
  } = {}
) {
  const raw =
    hashPathFromHash(hash);

  const funZoneRoute =
    parseFunZoneRoute(raw);

  if (funZoneRoute.game) {
    return "Fun Zone";
  }

  const label =
    SLUG_TO_LABEL[raw] || null;

  if (label) {
    return label;
  }

  return fallbackToDefault
    ? DEFAULT_SECTION
    : null;
}

/**
 * Canonical Analytics representation of a hash route.
 *
 * Battleship invite room IDs are useful for routing but are not useful
 * Analytics dimensions.
 *
 * #/fun-zone/battleship-AX9G
 *      ↓
 * #/fun-zone/battleship
 */
export function canonicalizeAnalyticsHash(
  hash
) {
  const value =
    String(hash || "").trim();

  if (!value) return "";

  return value.replace(
    /^#\/fun-zone\/battleship-[a-z0-9]{4}(?=([/?]|$))/i,
    "#/fun-zone/battleship"
  );
}