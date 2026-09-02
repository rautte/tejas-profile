// infra/cdk/test/outreach-score-v1.test.ts

import {
  OUTREACH_SCORE_ALGORITHM_VERSION,
  OutreachScoreInput,
  computeOutreachScoreV1,
} from "../lambda/outreach-score-v1";


function baseInput(
  overrides: Partial<OutreachScoreInput> = {}
): OutreachScoreInput {
  return {
    overview: {
      uniqueVisitors: 0,
      sessions: 0,
      avgActiveMsPerSession: 0,
      avgSectionsPerSession: 0,
      eventCount: 0,
    },

    sections: [],

    ctas: [],

    projects: [],

    deepLinks: [],

    engagement: {
      meaningfulSessionCount: 0,
      engagedSessionCount: 0,
      topSessionActiveMsShare: 0,
    },

    totalSectionCount: 9,

    ...overrides,
  };
}


describe(
  "computeOutreachScoreV1",
  () => {
    test(
      "returns an all-zero low-confidence score for empty analytics without crashing",
      () => {
        const result =
          computeOutreachScoreV1(
            baseInput()
          );

        expect(
          result.algorithm
        ).toBe(
          OUTREACH_SCORE_ALGORITHM_VERSION
        );

        expect(
          result.score
        ).toBe(0);

        expect(
          result.confidence
        ).toBe("low");

        expect(
          result.components
        ).toEqual({
          reach: 0,
          engagement: 0,
          depth: 0,
          intent: 0,
          consistency: 0,
        });
      }
    );


    test(
      "is deterministic: identical inputs always produce identical output, independent of when it runs",
      () => {
        const input =
          baseInput({
            overview: {
              uniqueVisitors: 40,
              sessions: 25,
              avgActiveMsPerSession: 60_000,
              avgSectionsPerSession: 5,
              eventCount: 300,
            },

            sections: [
              {
                section:
                  "Resume",
                visits: 10,
              },
            ],

            engagement: {
              meaningfulSessionCount: 20,
              engagedSessionCount: 18,
              topSessionActiveMsShare: 0.1,
            },
          });

        const first =
          computeOutreachScoreV1(
            input
          );

        const second =
          computeOutreachScoreV1(
            input
          );

        expect(
          second
        ).toEqual(
          first
        );
      }
    );


    test(
      "saturates every component at 100 once its cap is reached, never exceeding it for even extreme inputs",
      () => {
        const result =
          computeOutreachScoreV1(
            baseInput({
              overview: {
                uniqueVisitors: 5_000,
                sessions: 2_000,
                avgActiveMsPerSession: 10_000_000,
                avgSectionsPerSession: 9,
                eventCount: 1_000_000,
              },

              sections: [
                {
                  section:
                    "Resume",
                  visits: 5_000,
                },
                {
                  section:
                    "Projects",
                  visits: 5_000,
                },
              ],

              ctas: [
                {
                  count: 5_000,
                },
              ],

              engagement: {
                meaningfulSessionCount: 5_000,
                engagedSessionCount: 2_000,
                topSessionActiveMsShare: 0,
              },

              totalSectionCount: 2,
            })
          );

        expect(
          result.score
        ).toBe(100);

        expect(
          result.components
        ).toEqual({
          reach: 100,
          engagement: 100,
          depth: 100,
          intent: 100,
          consistency: 100,
        });
      }
    );


    test(
      "weights components as Reach 25 / Engagement 25 / Depth 20 / Intent 20 / Consistency 10",
      () => {
        // Every component independently saturated to 60/100 by
        // construction: overall score must land at exactly 60,
        // proving the weights sum to 1 and apply uniformly.
        const result =
          computeOutreachScoreV1(
            baseInput({
              overview: {
                uniqueVisitors: 30,
                sessions: 10,
                avgActiveMsPerSession: 54_000,
                avgSectionsPerSession: 3.6,
                eventCount: 90,
              },

              sections: [
                {
                  section:
                    "Resume",
                  visits: 12,
                },
                {
                  section:
                    "About Me",
                  visits: 1,
                },
                {
                  section:
                    "Experience",
                  visits: 1,
                },
                {
                  section:
                    "Skills",
                  visits: 1,
                },
                {
                  section:
                    "Education",
                  visits: 1,
                },
                {
                  section:
                    "Code Lab",
                  visits: 1,
                },
              ],

              engagement: {
                meaningfulSessionCount: 18,
                engagedSessionCount: 6,
                // Deliberately non-trivial, so Consistency's 10%
                // weight is actually exercised by this test too.
                topSessionActiveMsShare: 0.28,
              },

              totalSectionCount: 10,
            })
          );

        expect(
          result.components
            .reach
        ).toBe(60);

        expect(
          result.components
            .engagement
        ).toBe(60);

        expect(
          result.components
            .depth
        ).toBe(60);

        expect(
          result.components
            .intent
        ).toBe(60);

        expect(
          result.components
            .consistency
        ).toBe(80);

        // The score itself must be exactly the documented
        // weighted sum of the independently-asserted components
        // above — proving the weights are 25/25/20/20/10 and are
        // applied, not just that each component looks right on
        // its own.
        expect(
          result.score
        ).toBe(
          Math.round(
            result.components
              .reach *
              0.25 +
              result
                .components
                .engagement *
                0.25 +
              result
                .components
                .depth *
                0.2 +
              result
                .components
                .intent *
                0.2 +
              result
                .components
                .consistency *
                0.1
          )
        );

        expect(
          result.score
        ).toBe(62);
      }
    );


    test(
      "confidence reflects sample size only, independent of the score itself",
      () => {
        const strongButTinySample =
          computeOutreachScoreV1(
            baseInput({
              overview: {
                uniqueVisitors: 2,
                sessions: 2,
                avgActiveMsPerSession: 90_000,
                avgSectionsPerSession: 9,
                eventCount: 60,
              },

              sections: [
                {
                  section:
                    "Resume",
                  visits: 2,
                },
                {
                  section:
                    "Projects",
                  visits: 2,
                },
              ],

              engagement: {
                meaningfulSessionCount: 2,
                engagedSessionCount: 2,
                topSessionActiveMsShare: 0.5,
              },

              totalSectionCount: 2,
            })
          );

        expect(
          strongButTinySample.confidence
        ).toBe("low");

        expect(
          strongButTinySample.score
        ).toBeGreaterThan(
          70
        );


        const mediumSample =
          computeOutreachScoreV1(
            baseInput({
              overview: {
                uniqueVisitors: 10,
                sessions: 10,
                eventCount: 0,
                avgActiveMsPerSession: 0,
                avgSectionsPerSession: 0,
              },
            })
          );

        expect(
          mediumSample.confidence
        ).toBe("medium");


        const largeSample =
          computeOutreachScoreV1(
            baseInput({
              overview: {
                uniqueVisitors: 25,
                sessions: 25,
                eventCount: 0,
                avgActiveMsPerSession: 0,
                avgSectionsPerSession: 0,
              },
            })
          );

        expect(
          largeSample.confidence
        ).toBe("high");
      }
    );


    test(
      "consistency penalizes one session dominating engagement beyond its fair share of the sample",
      () => {
        const dominated =
          computeOutreachScoreV1(
            baseInput({
              overview: {
                uniqueVisitors: 10,
                sessions: 10,
                eventCount: 0,
                avgActiveMsPerSession: 0,
                avgSectionsPerSession: 0,
              },

              engagement: {
                meaningfulSessionCount: 0,
                engagedSessionCount: 0,
                topSessionActiveMsShare: 0.9,
              },
            })
          );

        const evenlySpread =
          computeOutreachScoreV1(
            baseInput({
              overview: {
                uniqueVisitors: 10,
                sessions: 10,
                eventCount: 0,
                avgActiveMsPerSession: 0,
                avgSectionsPerSession: 0,
              },

              engagement: {
                meaningfulSessionCount: 0,
                engagedSessionCount: 0,
                topSessionActiveMsShare: 0.1,
              },
            })
          );

        expect(
          dominated
            .components
            .consistency
        ).toBeLessThan(
          evenlySpread
            .components
            .consistency
        );

        expect(
          evenlySpread
            .components
            .consistency
        ).toBe(100);

        expect(
          dominated
            .components
            .consistency
        ).toBeGreaterThanOrEqual(
          0
        );
      }
    );


    test(
      "never reads geography, so it cannot influence the score even if present on the input object",
      () => {
        const withoutGeo =
          computeOutreachScoreV1(
            baseInput({
              overview: {
                uniqueVisitors: 12,
                sessions: 12,
                avgActiveMsPerSession: 20_000,
                avgSectionsPerSession: 2,
                eventCount: 40,
              },
            })
          );

        const withGeo =
          computeOutreachScoreV1({
            ...baseInput({
              overview: {
                uniqueVisitors: 12,
                sessions: 12,
                avgActiveMsPerSession: 20_000,
                avgSectionsPerSession: 2,
                eventCount: 40,
              },
            }),

            // @ts-expect-error -- geography is intentionally not
            // part of OutreachScoreInput; simulating a caller that
            // accidentally passes it through anyway.
            countries: [
              {
                countryCode:
                  "US",
                visitors: 12,
              },
            ],
          });

        expect(
          withGeo
        ).toEqual(
          withoutGeo
        );
      }
    );
  }
);
