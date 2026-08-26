// infra/cdk/lambda/analytics-domain.ts

export const PUBLIC_SECTION_ORDER =
  [
    "About Me",
    "Experience",
    "Skills",
    "Education",
    "Resume",
    "Projects",
    "Code Lab",
    "Fun Zone",
    "Timeline",
  ] as const;


export const PUBLIC_SECTIONS =
  new Set<string>(
    PUBLIC_SECTION_ORDER
  );

/**
 * Analytics ingest accepts delayed client events for up to 24 hours.
 *
 * Historical Usage Epoch reports must never be finalized before this
 * window has expired, otherwise a still-valid delayed event could arrive
 * after an immutable report was written.
 *
 * Keep this rule shared between ingest and report finalization.
 */
export const MAX_EVENT_AGE_MS =
  24 * 60 * 60 * 1000;


export const ALLOWED_EVENT_TYPES =
  new Set([
    "session_start",
    "section_view",
    "section_time",
    "scroll_depth",
    "cta_click",
    "deep_link",
    "project_open",
    "code_snippet_view",
  ]);


function safeStr(
  value:
    unknown,

  max =
    200
) {
  return String(
    value ?? ""
  )
    .trim()
    .slice(
      0,
      max
    );
}


/**
 * Temporary Battleship room IDs are routing information,
 * not useful Analytics dimensions.
 *
 * Application routing may contain:
 *
 *   #/fun-zone/battleship-AX9G
 *
 * while Analytics records:
 *
 *   #/fun-zone/battleship
 */
export function canonicalizeDeepLinkValue(
  value:
    unknown
) {
  const raw =
    safeStr(
      value,
      240
    );


  if (!raw) {
    return "";
  }


  return raw.replace(
    /(^|#\/|\/)fun-zone\/battleship-[a-z0-9]{4}(?=([/?]|$))/i,
    "$1fun-zone/battleship"
  );
}