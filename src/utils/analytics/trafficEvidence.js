// src/utils/analytics/trafficEvidence.js

/**
 * Privacy-safe browser evidence for Analytics traffic classification.
 *
 * This module deliberately records only coarse boolean-style evidence.
 *
 * Never add:
 * - raw User-Agent
 * - IP/network information
 * - pointer coordinates
 * - keyboard contents
 * - browser fingerprint material
 *
 * Evidence is scoped to the current logical Analytics session so
 * a previous session's human-like interaction cannot leak forward.
 */

export const TRAFFIC_EVIDENCE =
  Object.freeze({
    WEBDRIVER_DETECTED:
      "webdriver_detected",

    TRUSTED_POINTER_INPUT:
      "trusted_pointer_input",

    TRUSTED_KEYBOARD_INPUT:
      "trusted_keyboard_input",

    TRUSTED_TOUCH_INPUT:
      "trusted_touch_input",

    TRUSTED_WHEEL_INPUT:
      "trusted_wheel_input",
  });


const INTERACTION_EVIDENCE =
  Object.freeze({
    pointer:
      TRAFFIC_EVIDENCE
        .TRUSTED_POINTER_INPUT,

    keyboard:
      TRAFFIC_EVIDENCE
        .TRUSTED_KEYBOARD_INPUT,

    touch:
      TRAFFIC_EVIDENCE
        .TRUSTED_TOUCH_INPUT,

    wheel:
      TRAFFIC_EVIDENCE
        .TRUSTED_WHEEL_INPUT,
  });


let evidenceSessionId =
  "";

let evidence =
  new Set();


function cleanSessionId(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .slice(
      0,
      120
    );
}


function webdriverDetected() {
  try {
    return (
      typeof navigator !==
        "undefined" &&
      navigator
        .webdriver ===
        true
    );
  } catch {
    return false;
  }
}


function ensureEvidenceSession(
  sessionId
) {
  const normalized =
    cleanSessionId(
      sessionId
    );


  if (!normalized) {
    return "";
  }


  if (
    normalized !==
      evidenceSessionId
  ) {
    evidenceSessionId =
      normalized;

    evidence =
      new Set();


    if (
      webdriverDetected()
    ) {
      evidence.add(
        TRAFFIC_EVIDENCE
          .WEBDRIVER_DETECTED
      );
    }
  }


  return normalized;
}


export function readTrafficEvidence(
  sessionId
) {
  if (
    !ensureEvidenceSession(
      sessionId
    )
  ) {
    return [];
  }


  return [
    ...evidence,
  ].sort(
    (
      left,
      right
    ) =>
      left.localeCompare(
        right
      )
  );
}


export function recordTrustedTrafficInteraction({
  sessionId,

  kind,

  event,
} = {}) {
  if (
    !ensureEvidenceSession(
      sessionId
    )
  ) {
    return [];
  }


  /**
   * Browser Event.isTrusted prevents ordinary application JavaScript
   * from manufacturing human-input evidence through dispatchEvent().
   *
   * This is an Analytics-quality signal, not a security boundary.
   * Browser automation may still synthesize trusted input.
   */
  if (
    event?.isTrusted !==
      true
  ) {
    return readTrafficEvidence(
      sessionId
    );
  }


  const code =
    INTERACTION_EVIDENCE[
      String(
        kind || ""
      )
    ];


  if (code) {
    evidence.add(
      code
    );
  }


  return readTrafficEvidence(
    sessionId
  );
}


export function clearTrafficEvidence() {
  evidenceSessionId =
    "";

  evidence =
    new Set();
}
