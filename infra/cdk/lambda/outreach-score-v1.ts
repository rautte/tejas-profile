// infra/cdk/lambda/outreach-score-v1.ts

export const OUTREACH_SCORE_ALGORITHM_VERSION =
  "outreach-score.v1";

export type OutreachScoreConfidence =
  | "low"
  | "medium"
  | "high";

export interface OutreachScoreOverviewInput {
  uniqueVisitors: number;
  sessions: number;
  avgActiveMsPerSession: number;
  avgSectionsPerSession: number;
  eventCount: number;
}

export interface OutreachScoreSectionInput {
  section: string;
  visits: number;
}

export interface OutreachScoreCountedInput {
  count: number;
}

export interface OutreachScoreEngagementInput {
  meaningfulSessionCount: number;
  engagedSessionCount: number;
  topSessionActiveMsShare: number;
}

export interface OutreachScoreInput {
  overview: OutreachScoreOverviewInput;
  sections: OutreachScoreSectionInput[];
  ctas: OutreachScoreCountedInput[];
  projects: OutreachScoreCountedInput[];
  deepLinks: OutreachScoreCountedInput[];
  engagement: OutreachScoreEngagementInput;
  totalSectionCount: number;
}

export interface OutreachScoreComponents {
  reach: number;
  engagement: number;
  depth: number;
  intent: number;
  consistency: number;
}

export interface OutreachScoreResult {
  algorithm: string;
  score: number;
  confidence: OutreachScoreConfidence;
  components: OutreachScoreComponents;
}

/**
 * Fixed, absolute saturation caps.
 *
 * These are never compared against this profile's own history or
 * any other profile's data — the same inputs must always produce
 * the same score, including for a profile created after this one.
 */
const REACH_VISITOR_CAP = 50;
const REACH_MEANINGFUL_SESSION_CAP = 30;
const MEANINGFUL_SESSION_ACTIVE_MS = 10_000;
const ENGAGED_SESSION_ACTIVE_MS = 30_000;
const ENGAGED_SESSION_EVENT_COUNT = 5;
const ENGAGEMENT_ACTIVE_MS_CAP = 90_000;
const ENGAGEMENT_EVENTS_PER_SESSION_CAP = 15;
const DEPTH_SECTIONS_PER_SESSION_CAP = 6;
const INTENT_ACTIONS_PER_SESSION_CAP = 2;
const HIGH_INTENT_SECTIONS = new Set([
  "Resume",
  "Projects",
]);

const CONFIDENCE_LOW_MAX_SESSIONS = 4;
const CONFIDENCE_MEDIUM_MAX_SESSIONS = 19;

const COMPONENT_WEIGHTS = {
  reach: 0.25,
  engagement: 0.25,
  depth: 0.2,
  intent: 0.2,
  consistency: 0.1,
};

export {
  MEANINGFUL_SESSION_ACTIVE_MS,
  ENGAGED_SESSION_ACTIVE_MS,
  ENGAGED_SESSION_EVENT_COUNT,
};

function saturate(
  value: number,
  cap: number
): number {
  if (
    !Number.isFinite(
      value
    ) ||
    value <= 0 ||
    cap <= 0
  ) {
    return 0;
  }

  return Math.min(
    100,
    (value / cap) * 100
  );
}

function average(
  values: number[]
): number {
  if (
    values.length === 0
  ) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length
  );
}

function sumCounts(
  items: OutreachScoreCountedInput[]
): number {
  return items.reduce(
    (sum, item) =>
      sum +
      (Number(
        item?.count
      ) || 0),
    0
  );
}

/**
 * Computes an independent, absolute 0-100 Outreach Score for one
 * complete Analytics filter combination.
 *
 * Deliberately excluded from the formula: geography (countries,
 * cities), and any comparison against this profile's own history
 * or another profile's score. Confidence is reported separately
 * from the score itself and reflects sample size only.
 */
export function computeOutreachScoreV1(
  input: OutreachScoreInput
): OutreachScoreResult {
  const sessions =
    Math.max(
      0,
      Number(
        input.overview
          .sessions
      ) || 0
    );

  const visitors =
    Math.max(
      0,
      Number(
        input.overview
          .uniqueVisitors
      ) || 0
    );

  // Reach
  const reach =
    average([
      saturate(
        visitors,
        REACH_VISITOR_CAP
      ),

      saturate(
        input.engagement
          .meaningfulSessionCount,
        REACH_MEANINGFUL_SESSION_CAP
      ),
    ]);

  // Engagement
  const engagedSessionRate =
    sessions > 0
      ? (input.engagement
          .engagedSessionCount /
          sessions) *
        100
      : 0;

  const eventsPerSession =
    sessions > 0
      ? input.overview
          .eventCount /
        sessions
      : 0;

  const engagement =
    average([
      saturate(
        input.overview
          .avgActiveMsPerSession,
        ENGAGEMENT_ACTIVE_MS_CAP
      ),

      Math.min(
        100,
        engagedSessionRate
      ),

      saturate(
        eventsPerSession,
        ENGAGEMENT_EVENTS_PER_SESSION_CAP
      ),
    ]);

  // Content Depth
  const sectionsVisited =
    input.sections.filter(
      (section) =>
        section.visits >
        0
    ).length;

  const coverageScore =
    input.totalSectionCount >
    0
      ? (sectionsVisited /
          input.totalSectionCount) *
        100
      : 0;

  const depth =
    average([
      saturate(
        input.overview
          .avgSectionsPerSession,
        DEPTH_SECTIONS_PER_SESSION_CAP
      ),

      coverageScore,
    ]);

  // Intent
  const highIntentSectionVisits =
    input.sections
      .filter(
        (section) =>
          HIGH_INTENT_SECTIONS.has(
            section.section
          )
      )
      .reduce(
        (sum, section) =>
          sum +
          section.visits,
        0
      );

  const highIntentActions =
    sumCounts(
      input.ctas
    ) +
    sumCounts(
      input.projects
    ) +
    sumCounts(
      input.deepLinks
    ) +
    highIntentSectionVisits;

  const highIntentPerSession =
    sessions > 0
      ? highIntentActions /
        sessions
      : 0;

  const intent =
    saturate(
      highIntentPerSession,
      INTENT_ACTIONS_PER_SESSION_CAP
    );

  // Consistency: penalizes one session dominating engagement
  // beyond the "fair share" implied by the sample size, rather
  // than penalizing a small sample outright — that is what
  // Confidence is for. With zero sessions there is nothing to
  // claim is consistent.
  let consistency =
    sessions > 0
      ? 100
      : 0;

  if (sessions > 1) {
    const fairShare =
      1 / sessions;

    const excess =
      Math.max(
        0,
        input.engagement
          .topSessionActiveMsShare -
          fairShare
      );

    consistency =
      100 *
      (1 -
        excess /
          (1 -
            fairShare));
  }

  consistency =
    Math.max(
      0,
      Math.min(
        100,
        consistency
      )
    );

  const score =
    reach *
      COMPONENT_WEIGHTS.reach +
    engagement *
      COMPONENT_WEIGHTS.engagement +
    depth *
      COMPONENT_WEIGHTS.depth +
    intent *
      COMPONENT_WEIGHTS.intent +
    consistency *
      COMPONENT_WEIGHTS.consistency;

  let confidence: OutreachScoreConfidence =
    "high";

  if (
    sessions <=
    CONFIDENCE_LOW_MAX_SESSIONS
  ) {
    confidence = "low";
  } else if (
    sessions <=
    CONFIDENCE_MEDIUM_MAX_SESSIONS
  ) {
    confidence = "medium";
  }

  return {
    algorithm:
      OUTREACH_SCORE_ALGORITHM_VERSION,

    score:
      Math.max(
        0,
        Math.min(
          100,
          Math.round(
            score
          )
        )
      ),

    confidence,

    components: {
      reach:
        Math.round(
          reach
        ),

      engagement:
        Math.round(
          engagement
        ),

      depth:
        Math.round(
          depth
        ),

      intent:
        Math.round(
          intent
        ),

      consistency:
        Math.round(
          consistency
        ),
    },
  };
}
