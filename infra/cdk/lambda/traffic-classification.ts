// infra/cdk/lambda/traffic-classification.ts

/**
 * Privacy-safe, deterministic Analytics traffic classification.
 *
 * This classifier is an Analytics-quality signal only.
 * It MUST NOT be used as an authentication, authorization,
 * abuse-prevention, or security boundary.
 *
 * V1 intentionally classifies one logical session only from
 * evidence belonging to that session.
 *
 * Cross-session clustering, geography, IP/network reputation,
 * and query-window-relative behavior are deliberately excluded
 * from the canonical classification contract.
 */

export const TRAFFIC_CLASSIFIER_VERSION =
  "traffic-classifier.v1";


export const TRAFFIC_CLASSIFICATION = {
  LIKELY_HUMAN:
    "likely_human",

  LIKELY_AUTOMATED:
    "likely_automated",

  UNCERTAIN:
    "uncertain",
} as const;


export type TrafficClassification =
  typeof TRAFFIC_CLASSIFICATION[
    keyof typeof TRAFFIC_CLASSIFICATION
  ];


export const TRAFFIC_CONFIDENCE = {
  HIGH:
    "high",

  MEDIUM:
    "medium",

  LOW:
    "low",
} as const;


export type TrafficConfidence =
  typeof TRAFFIC_CONFIDENCE[
    keyof typeof TRAFFIC_CONFIDENCE
  ];


/**
 * Evidence values are deliberately coarse.
 *
 * Never place:
 *
 * - raw User-Agent
 * - IP address
 * - mouse coordinates
 * - keyboard contents
 * - browser fingerprint material
 *
 * in this contract.
 */
export const TRAFFIC_EVIDENCE = {
  KNOWN_AUTOMATION_USER_AGENT:
    "known_automation_user_agent",

  HEADLESS_USER_AGENT:
    "headless_user_agent",

  WEBDRIVER_DETECTED:
    "webdriver_detected",

  MISSING_USER_AGENT:
    "missing_user_agent",

  TRUSTED_POINTER_INPUT:
    "trusted_pointer_input",

  TRUSTED_KEYBOARD_INPUT:
    "trusted_keyboard_input",

  TRUSTED_TOUCH_INPUT:
    "trusted_touch_input",

  TRUSTED_WHEEL_INPUT:
    "trusted_wheel_input",

  MEANINGFUL_ENGAGEMENT:
    "meaningful_engagement",

  PASSIVE_SHORT_SESSION:
    "passive_short_session",
} as const;


export type TrafficEvidence =
  typeof TRAFFIC_EVIDENCE[
    keyof typeof TRAFFIC_EVIDENCE
  ];


export const TRAFFIC_FILTER_ALL =
  "all";


const VALID_TRAFFIC_EVIDENCE =
  new Set<string>(
    Object.values(
      TRAFFIC_EVIDENCE
    )
  );


const VALID_TRAFFIC_FILTERS =
  new Set<string>([
    TRAFFIC_FILTER_ALL,

    TRAFFIC_CLASSIFICATION
      .LIKELY_HUMAN,

    TRAFFIC_CLASSIFICATION
      .LIKELY_AUTOMATED,

    TRAFFIC_CLASSIFICATION
      .UNCERTAIN,
  ]);


const STRONG_AUTOMATION_EVIDENCE =
  new Set<string>([
    TRAFFIC_EVIDENCE
      .KNOWN_AUTOMATION_USER_AGENT,

    TRAFFIC_EVIDENCE
      .HEADLESS_USER_AGENT,

    TRAFFIC_EVIDENCE
      .WEBDRIVER_DETECTED,
  ]);


const TRUSTED_HUMAN_INPUT_EVIDENCE =
  new Set<string>([
    TRAFFIC_EVIDENCE
      .TRUSTED_POINTER_INPUT,

    TRAFFIC_EVIDENCE
      .TRUSTED_KEYBOARD_INPUT,

    TRAFFIC_EVIDENCE
      .TRUSTED_TOUCH_INPUT,

    TRAFFIC_EVIDENCE
      .TRUSTED_WHEEL_INPUT,
  ]);


/**
 * Keep detection intentionally conservative.
 *
 * These tokens identify clients that openly advertise
 * automation/crawler behavior. Ordinary browser strings
 * are not treated as automated merely because they come
 * from a datacenter or unexpected geography.
 */
const KNOWN_AUTOMATION_UA_TOKENS = [
  "bot",
  "spider",
  "crawler",
  "lighthouse",
  "pingdom",
  "uptimerobot",
  "facebookexternalhit",
  "slackbot",
  "discordbot",
  "twitterbot",
  "linkedinbot",
  "bingpreview",
  "skypeuripreview",
  "google-inspectiontool",
  "urlscan",
];


const HEADLESS_UA_TOKENS = [
  "headlesschrome",
  "phantomjs",
  "selenium",
  "playwright",
  "puppeteer",
];


function cleanString(
  value:
    unknown,

  max =
    1024
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


function nonNegativeNumber(
  value:
    unknown
) {
  const normalized =
    Number(
      value
    );


  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized <
      0
  ) {
    return 0;
  }


  return normalized;
}


export function normalizeTrafficEvidence(
  input:
    unknown
): TrafficEvidence[] {
  const values =
    input instanceof
      Set
      ? [
          ...input,
        ]
      : Array.isArray(
          input
        )
        ? input
        : [];


  const normalized =
    new Set<
      TrafficEvidence
    >();


  for (
    const raw of values
  ) {
    const value =
      cleanString(
        raw,
        80
      );


    if (
      VALID_TRAFFIC_EVIDENCE
        .has(
          value
        )
    ) {
      normalized.add(
        value as
          TrafficEvidence
      );
    }
  }


  return [
    ...normalized,
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


/**
 * Reduces a raw User-Agent to coarse evidence immediately.
 *
 * The caller must not persist the original User-Agent merely
 * for traffic classification.
 */
export function deriveUserAgentTrafficEvidence(
  userAgent:
    unknown
): TrafficEvidence[] {
  const normalized =
    cleanString(
      userAgent
    )
      .toLowerCase();


  if (!normalized) {
    return [
      TRAFFIC_EVIDENCE
        .MISSING_USER_AGENT,
    ];
  }


  const evidence =
    new Set<
      TrafficEvidence
    >();


  if (
    HEADLESS_UA_TOKENS.some(
      (
        token
      ) =>
        normalized.includes(
          token
        )
    )
  ) {
    evidence.add(
      TRAFFIC_EVIDENCE
        .HEADLESS_USER_AGENT
    );
  }


  if (
    KNOWN_AUTOMATION_UA_TOKENS.some(
      (
        token
      ) =>
        normalized.includes(
          token
        )
    )
  ) {
    evidence.add(
      TRAFFIC_EVIDENCE
        .KNOWN_AUTOMATION_USER_AGENT
    );
  }


  return normalizeTrafficEvidence(
    evidence
  );
}


export function deriveBehavioralTrafficEvidence({
  eventCount =
    0,

  activeMs =
    0,

  sectionCount =
    0,

  journeyEventCount =
    0,
}: {
  eventCount?:
    unknown;

  activeMs?:
    unknown;

  sectionCount?:
    unknown;

  journeyEventCount?:
    unknown;
} = {}): TrafficEvidence[] {
  const events =
    nonNegativeNumber(
      eventCount
    );

  const active =
    nonNegativeNumber(
      activeMs
    );

  const sections =
    nonNegativeNumber(
      sectionCount
    );

  const journey =
    nonNegativeNumber(
      journeyEventCount
    );


  const evidence =
    new Set<
      TrafficEvidence
    >();


  /**
   * This is deliberately a conservative fallback for sessions
   * where direct trusted-input evidence is unavailable.
   *
   * It is NOT strong enough to override automation evidence.
   */
  if (
    (
      active >=
        30_000 &&
      sections >=
        2 &&
      events >=
        4
    ) ||
    (
      active >=
        60_000 &&
      events >=
        3
    )
  ) {
    evidence.add(
      TRAFFIC_EVIDENCE
        .MEANINGFUL_ENGAGEMENT
    );
  }


  /**
   * A short, passive, low-variation session is not declared a bot.
   *
   * It is merely evidence that the session should remain
   * UNCERTAIN unless stronger evidence exists.
   */
  if (
    events >
      0 &&
    events <=
      8 &&
    active <=
      20_000 &&
    sections <=
      2 &&
    journey <=
      2
  ) {
    evidence.add(
      TRAFFIC_EVIDENCE
        .PASSIVE_SHORT_SESSION
    );
  }


  return normalizeTrafficEvidence(
    evidence
  );
}


function matchingEvidence(
  evidence:
    TrafficEvidence[],

  allowed:
    Set<string>
) {
  return evidence.filter(
    (
      value
    ) =>
      allowed.has(
        value
      )
  );
}


export function classifyTrafficSession({
  evidence =
    [],

  eventCount =
    0,

  activeMs =
    0,

  sectionCount =
    0,

  journeyEventCount =
    0,
}: {
  evidence?:
    unknown;

  eventCount?:
    unknown;

  activeMs?:
    unknown;

  sectionCount?:
    unknown;

  journeyEventCount?:
    unknown;
} = {}) {
  const combinedEvidence =
    normalizeTrafficEvidence([
      ...normalizeTrafficEvidence(
        evidence
      ),

      ...deriveBehavioralTrafficEvidence({
        eventCount,

        activeMs,

        sectionCount,

        journeyEventCount,
      }),
    ]);


  const strongAutomation =
    matchingEvidence(
      combinedEvidence,
      STRONG_AUTOMATION_EVIDENCE
    );


  /**
   * Automation evidence wins over human-like interaction evidence.
   *
   * Browser automation can synthesize interaction, and classification
   * must not flip to LIKELY_HUMAN merely because both are present.
   */
  if (
    strongAutomation.length
  ) {
    return {
      classifierVersion:
        TRAFFIC_CLASSIFIER_VERSION,

      classification:
        TRAFFIC_CLASSIFICATION
          .LIKELY_AUTOMATED,

      confidence:
        TRAFFIC_CONFIDENCE
          .HIGH,

      reasonCodes:
        strongAutomation,
    };
  }


  const trustedHumanInput =
    matchingEvidence(
      combinedEvidence,
      TRUSTED_HUMAN_INPUT_EVIDENCE
    );


  if (
    trustedHumanInput.length
  ) {
    return {
      classifierVersion:
        TRAFFIC_CLASSIFIER_VERSION,

      classification:
        TRAFFIC_CLASSIFICATION
          .LIKELY_HUMAN,

      confidence:
        TRAFFIC_CONFIDENCE
          .HIGH,

      reasonCodes:
        trustedHumanInput,
    };
  }


  if (
    combinedEvidence.includes(
      TRAFFIC_EVIDENCE
        .MEANINGFUL_ENGAGEMENT
    )
  ) {
    return {
      classifierVersion:
        TRAFFIC_CLASSIFIER_VERSION,

      classification:
        TRAFFIC_CLASSIFICATION
          .LIKELY_HUMAN,

      confidence:
        TRAFFIC_CONFIDENCE
          .MEDIUM,

      reasonCodes: [
        TRAFFIC_EVIDENCE
          .MEANINGFUL_ENGAGEMENT,
      ],
    };
  }


  /**
   * A trusted CloudFront browser request should normally contain
   * a User-Agent. Missing UA is therefore suspicious, but not as
   * conclusive as an explicit crawler/headless/WebDriver signal.
   */
  if (
    combinedEvidence.includes(
      TRAFFIC_EVIDENCE
        .MISSING_USER_AGENT
    )
  ) {
    return {
      classifierVersion:
        TRAFFIC_CLASSIFIER_VERSION,

      classification:
        TRAFFIC_CLASSIFICATION
          .LIKELY_AUTOMATED,

      confidence:
        TRAFFIC_CONFIDENCE
          .MEDIUM,

      reasonCodes: [
        TRAFFIC_EVIDENCE
          .MISSING_USER_AGENT,
      ],
    };
  }


  if (
    combinedEvidence.includes(
      TRAFFIC_EVIDENCE
        .PASSIVE_SHORT_SESSION
    )
  ) {
    return {
      classifierVersion:
        TRAFFIC_CLASSIFIER_VERSION,

      classification:
        TRAFFIC_CLASSIFICATION
          .UNCERTAIN,

      confidence:
        TRAFFIC_CONFIDENCE
          .MEDIUM,

      reasonCodes: [
        TRAFFIC_EVIDENCE
          .PASSIVE_SHORT_SESSION,
      ],
    };
  }


  return {
    classifierVersion:
      TRAFFIC_CLASSIFIER_VERSION,

    classification:
      TRAFFIC_CLASSIFICATION
        .UNCERTAIN,

    confidence:
      TRAFFIC_CONFIDENCE
        .LOW,

    reasonCodes:
      [] as TrafficEvidence[],
  };
}


export function normalizeTrafficClassificationFilter(
  value:
    unknown
) {
  const normalized =
    cleanString(
      value,
      40
    )
      .toLowerCase();


  if (!normalized) {
    return TRAFFIC_FILTER_ALL;
  }


  return VALID_TRAFFIC_FILTERS
    .has(
      normalized
    )
    ? normalized
    : null;
}


export function trafficClassificationMatchesFilter(
  classification:
    unknown,

  filter:
    unknown
) {
  const normalizedFilter =
    normalizeTrafficClassificationFilter(
      filter
    );


  if (
    normalizedFilter ===
      null
  ) {
    return false;
  }


  if (
    normalizedFilter ===
      TRAFFIC_FILTER_ALL
  ) {
    return true;
  }


  return (
    cleanString(
      classification,
      40
    ) ===
    normalizedFilter
  );
}
