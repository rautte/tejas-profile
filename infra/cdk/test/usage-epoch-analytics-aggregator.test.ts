import {
  BatchGetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
} from "@aws-sdk/util-dynamodb";

import {
  computeDeploymentConfigurationId,
  normalizeAndValidateDeploymentConfigurationDocument,
} from "../lambda/deployment-configuration-contract";

import {
  USAGE_EPOCH_TRANSITION_KIND,
  createClosingUsageEpochDocument,
  createOpenUsageEpochDocument,
} from "../lambda/usage-epoch-contract";

import {
  createUsageEpochAnalyticsEventRecord,
} from "../lambda/usage-epoch-analytics-projection";

import {
  aggregateUsageEpochAnalyticsEvents,
  aggregateUsageEpochAnalyticsTrafficReport,
  buildUsageEpochAnalyticsReportData,
} from "../lambda/usage-epoch-analytics-aggregator";

import {
  createConfigurationAnalyticsReportDocument,
} from "../lambda/configuration-analytics-report-contract";

import {
  PUBLIC_SECTION_ORDER,
} from "../lambda/analytics-domain";

import {
  computeOutreachScoreV1,
} from "../lambda/outreach-score-v1";


const PROJECTION_TABLE =
  "usage-epoch-analytics-aggregate-test";

const ANALYTICS_TABLE =
  "analytics-aggregate-test";


function configuration() {
  const stage =
    "prod" as const;

  const platformReleaseId =
    "plr_epoch_aggregate";

  const profileVariantId =
    "prv_epoch_aggregate";

  const deploymentConfigurationId =
    computeDeploymentConfigurationId({
      stage,

      platformReleaseId,

      profileVariantId,
    });


  return normalizeAndValidateDeploymentConfigurationDocument({
    schema:
      "tejas-profile.deployment-configuration",

    schemaId:
      "tejas-profile.deployment-configuration.v1",

    deploymentConfigurationId,

    stage,

    createdAt:
      "2026-08-24T00:00:00.000Z",

    platformReleaseId,

    profileVariantId,

    profile: {
      contentSchemaVersion:
        1,

      contentHash:
        "a".repeat(
          64
        ),

      targeting: {
        location:
          "Austin",

        jobRole:
          "Backend Engineer",
      },
    },
  });
}


function closingEpoch() {
  const open =
    createOpenUsageEpochDocument({
      startedAt:
        "2026-08-24T23:59:00.000Z",

      deploymentConfiguration:
        configuration(),

      openedBy: {
        kind:
          USAGE_EPOCH_TRANSITION_KIND
            .PLATFORM_DEPLOYMENT,

        occurrenceId:
          "pdep_epoch_aggregate",
      },
    });


  return createClosingUsageEpochDocument({
    epoch:
      open,

    endedAt:
      "2026-08-25T00:02:00.000Z",

    closedBy: {
      kind:
        USAGE_EPOCH_TRANSITION_KIND
          .PROFILE_ACTIVATION,

      occurrenceId:
        "act_epoch_aggregate_close",
    },
  });
}


function record({
  eventId,
  ts,
  visitorHash,
  sessionHash,
  type,
  geo,
  ...event
}: {
  eventId:
    string;

  ts:
    number;

  visitorHash:
    string;

  sessionHash:
    string;

  type:
    string;

  geo?: {
    countryCode:
      string |
      null;

    regionCode:
      string |
      null;

    city:
      string |
      null;
  };

  [
    key:
      string
  ]:
    any;
}) {
  const epoch =
    closingEpoch();


  return createUsageEpochAnalyticsEventRecord({
    attribution: {
      usageEpochId:
        epoch.usageEpochId,

      stage:
        epoch.stage,

      deploymentConfigurationId:
        epoch
          .deploymentConfigurationId,

      platformReleaseId:
        epoch.platformReleaseId,

      profileVariantId:
        epoch.profileVariantId,

      startedAt:
        epoch.startedAt,

      endedAt:
        epoch.endedAt,
    },

    event: {
      eventId,

      ts,

      visitorHash,

      sessionHash,

      type,

      ...event,
    },

    geo:
      geo || {
        countryCode:
          "US",

        regionCode:
          "TX",

        city:
          "Austin",
      },
  });
}


describe(
  "Usage Epoch Analytics aggregation",
  () => {
    test(
      "aggregates exact event facts into the immutable report analytics shape",
      () => {
        const epoch =
          closingEpoch();

        const dayOne =
          Date.parse(
            "2026-08-24T23:59:10.000Z"
          );

        const dayTwo =
          Date.parse(
            "2026-08-25T00:00:10.000Z"
          );


        const events = [
          record({
            eventId:
              "event-01",

            ts:
              dayOne,

            visitorHash:
              "visitor-a",

            sessionHash:
              "session-a",

            type:
              "session_start",
          }),

          record({
            eventId:
              "event-02",

            ts:
              dayOne +
              1_000,

            visitorHash:
              "visitor-a",

            sessionHash:
              "session-a",

            type:
              "section_view",

            section:
              "About Me",
          }),

          record({
            eventId:
              "event-03",

            ts:
              dayOne +
              2_000,

            visitorHash:
              "visitor-a",

            sessionHash:
              "session-a",

            type:
              "section_time",

            section:
              "About Me",

            ms:
              2_000,
          }),

          record({
            eventId:
              "event-04",

            ts:
              dayOne +
              3_000,

            visitorHash:
              "visitor-a",

            sessionHash:
              "session-a",

            type:
              "scroll_depth",

            section:
              "About Me",

            depthPct:
              25,
          }),

          record({
            eventId:
              "event-05",

            ts:
              dayOne +
              4_000,

            visitorHash:
              "visitor-a",

            sessionHash:
              "session-a",

            type:
              "cta_click",

            ctaId:
              "resume-download",
          }),

          record({
            eventId:
              "event-06",

            ts:
              dayOne +
              5_000,

            visitorHash:
              "visitor-a",

            sessionHash:
              "session-a",

            type:
              "deep_link",

            hash:
              "#/fun-zone/battleship-ABCD",
          }),

          record({
            eventId:
              "event-07",

            ts:
              dayTwo,

            visitorHash:
              "visitor-b",

            sessionHash:
              "session-b",

            type:
              "project_open",

            projectId:
              "project-1",

            geo: {
              countryCode:
                "IN",

              regionCode:
                "MH",

              city:
                "Pune",
            },
          }),

          record({
            eventId:
              "event-08",

            ts:
              dayTwo +
              1_000,

            visitorHash:
              "visitor-b",

            sessionHash:
              "session-b",

            type:
              "code_snippet_view",

            snippetId:
              "snippet-1",

            geo: {
              countryCode:
                "IN",

              regionCode:
                "MH",

              city:
                "Pune",
            },
          }),

          record({
            eventId:
              "event-09",

            ts:
              dayTwo +
              2_000,

            visitorHash:
              "visitor-b",

            sessionHash:
              "session-b",

            type:
              "section_view",

            section:
              "Projects",

            geo: {
              countryCode:
                "IN",

              regionCode:
                "MH",

              city:
                "Pune",
            },
          }),

          record({
            eventId:
              "event-10",

            ts:
              dayTwo +
              3_000,

            visitorHash:
              "visitor-b",

            sessionHash:
              "session-b",

            type:
              "section_time",

            section:
              "Projects",

            ms:
              3_000,

            geo: {
              countryCode:
                "IN",

              regionCode:
                "MH",

              city:
                "Pune",
            },
          }),
        ];


        const analytics =
          aggregateUsageEpochAnalyticsEvents({
            epoch,

            events,

            visitorFirstSeenByHash:
              new Map([
                [
                  "visitor-a",

                  Date.parse(
                    "2026-08-24T20:00:00.000Z"
                  ),
                ],

                [
                  "visitor-b",

                  dayTwo,
                ],
              ]),
          });


        expect(
          analytics.overview
        ).toEqual({
          uniqueVisitors:
            2,

          newVisitors:
            1,

          returningVisitors:
            1,

          classifiedVisitors:
            2,

          unclassifiedVisitors:
            0,

          returningVisitorPct:
            50,

          sessions:
            2,

          activeMs:
            5_000,

          avgActiveMsPerSession:
            2_500,

          avgSectionsPerSession:
            1,

          eventCount:
            10,

          topSection:
            "Projects",
        });


        expect(
          analytics.sections.find(
            (
              row
            ) =>
              row.section ===
              "About Me"
          )
        ).toMatchObject({
          visits:
            1,

          visitors:
            1,

          sessions:
            1,

          activeMs:
            2_000,
        });


        expect(
          analytics.sections.find(
            (
              row
            ) =>
              row.section ===
              "Projects"
          )
        ).toMatchObject({
          visits:
            1,

          visitors:
            1,

          sessions:
            1,

          activeMs:
            3_000,
        });


        expect(
          analytics.ctas
        ).toEqual([
          {
            ctaId:
              "resume-download",

            count:
              1,

            visitors:
              1,

            sessions:
              1,
          },
        ]);


        expect(
          analytics.projects
        ).toEqual([
          {
            projectId:
              "project-1",

            count:
              1,

            visitors:
              1,

            sessions:
              1,
          },
        ]);


        expect(
          analytics.snippets
        ).toEqual([
          {
            snippetId:
              "snippet-1",

            count:
              1,

            visitors:
              1,

            sessions:
              1,
          },
        ]);


        expect(
          analytics.deepLinks
        ).toEqual([
          {
            path:
              "#/fun-zone/battleship",

            count:
              1,

            visitors:
              1,

            sessions:
              1,
          },
        ]);


        expect(
          analytics.depthMilestones
        ).toEqual([
          {
            section:
              "About Me",

            depthPct:
              25,

            visitors:
              1,

            sessions:
              1,
          },
        ]);


        expect(
          analytics.countries
        ).toEqual([
          {
            countryCode:
              "IN",

            visitors:
              1,

            sessions:
              1,

            activeMs:
              3_000,
          },

          {
            countryCode:
              "US",

            visitors:
              1,

            sessions:
              1,

            activeMs:
              2_000,
          },
        ]);


        expect(
          analytics.daily
        ).toEqual([
          {
            day:
              "2026-08-24",

            uniqueVisitors:
              1,

            sessions:
              1,

            activeMs:
              2_000,

            avgActiveMsPerSession:
              2_000,

            eventCount:
              6,
          },

          {
            day:
              "2026-08-25",

            uniqueVisitors:
              1,

            sessions:
              1,

            activeMs:
              3_000,

            avgActiveMsPerSession:
              3_000,

            eventCount:
              4,
          },
        ]);


        /**
         * P8D compatibility gate:
         *
         * exact P8E2 analytics must already satisfy the immutable
         * report payload contract before P8E3 is allowed to persist it.
         */
        expect(
          () =>
            createConfigurationAnalyticsReportDocument({
              epoch,

              analytics,
            })
        ).not.toThrow();
      }
    );


    test(
      "computes per-session engagement and an Outreach Score from the exact same slice it appends them to",
      () => {
        const epoch =
          closingEpoch();

        const windowStart =
          Date.parse(
            "2026-08-24T23:59:10.000Z"
          );

        const events = [
          // A long, active session -- crosses both the meaningful
          // (>=10s) and engaged (>=30s) active-time thresholds.
          record({
            eventId:
              "engaged-01",

            ts:
              windowStart,

            visitorHash:
              "visitor-engaged",

            sessionHash:
              "session-engaged",

            type:
              "section_time",

            section:
              "About Me",

            ms:
              35_000,
          }),

          // A short, single-event session -- crosses neither
          // threshold.
          record({
            eventId:
              "quiet-01",

            ts:
              windowStart +
              1_000,

            visitorHash:
              "visitor-quiet",

            sessionHash:
              "session-quiet",

            type:
              "section_time",

            section:
              "Skills",

            ms:
              1_000,
          }),
        ];


        const analytics =
          aggregateUsageEpochAnalyticsEvents({
            epoch,

            events,

            visitorFirstSeenByHash:
              new Map(
                [
                  [
                    "visitor-engaged",
                    windowStart,
                  ],

                  [
                    "visitor-quiet",
                    windowStart,
                  ],
                ]
              ),
          });


        expect(
          analytics.engagement
        ).toEqual(
          {
            meaningfulSessionCount:
              1,

            engagedSessionCount:
              1,

            topSessionActiveMsShare:
              35_000 /
              36_000,
          }
        );


        /**
         * outreachScore is only appended one level up, per traffic
         * slice, by aggregateUsageEpochAnalyticsTrafficReport --
         * aggregateUsageEpochAnalyticsEvents itself only produces
         * the engagement inputs asserted above.
         */
        const trafficReport =
          aggregateUsageEpochAnalyticsTrafficReport(
            {
              epoch,

              events,

              visitorFirstSeenByHash:
                new Map(
                  [
                    [
                      "visitor-engaged",
                      windowStart,
                    ],

                    [
                      "visitor-quiet",
                      windowStart,
                    ],
                  ]
                ),
            }
          );

        const allSlice =
          trafficReport
            .analyticsByTraffic
            .all;


        expect(
          allSlice.outreachScore
        ).toEqual(
          computeOutreachScoreV1(
            {
              overview:
                allSlice.overview,

              sections:
                allSlice.sections,

              ctas:
                allSlice.ctas,

              projects:
                allSlice.projects,

              deepLinks:
                allSlice.deepLinks,

              engagement:
                allSlice.engagement,

              totalSectionCount:
                PUBLIC_SECTION_ORDER.length,
            }
          )
        );


        expect(
          allSlice.outreachScore
            .algorithm
        ).toBe(
          "outreach-score.v1"
        );
      }
    );


    test(
      "missing visitor registry evidence remains explicitly unclassified",
      () => {
        const epoch =
          closingEpoch();

        const analytics =
          aggregateUsageEpochAnalyticsEvents({
            epoch,

            events: [
              record({
                eventId:
                  "visitor-unclassified",

                ts:
                  Date.parse(
                    "2026-08-25T00:00:00.000Z"
                  ),

                visitorHash:
                  "visitor-unknown",

                sessionHash:
                  "session-unknown",

                type:
                  "session_start",
              }),
            ],
          });


        expect(
          analytics.overview
        ).toMatchObject({
          uniqueVisitors:
            1,

          newVisitors:
            0,

          returningVisitors:
            0,

          classifiedVisitors:
            0,

          unclassifiedVisitors:
            1,
        });
      }
    );


    test(
      "projection corruption or right-open interval violations fail closed",
      () => {
        const epoch =
          closingEpoch();

        const valid =
          record({
            eventId:
              "valid-corruption-base",

            ts:
              Date.parse(
                "2026-08-25T00:00:00.000Z"
              ),

            visitorHash:
              "visitor",

            sessionHash:
              "session",

            type:
              "session_start",
          });


        expect(
          () =>
            aggregateUsageEpochAnalyticsEvents({
              epoch,

              events: [
                {
                  ...valid,

                  deploymentConfigurationId:
                    "cfg_forged",
                },
              ],
            })
        ).toThrow(
          /runtime identity/
        );


        expect(
          () =>
            aggregateUsageEpochAnalyticsEvents({
              epoch,

              events: [
                {
                  ...valid,

                  ts:
                    Date.parse(
                      epoch.endedAt!
                    ),

                  day:
                    "2026-08-25",
                },
              ],
            })
        ).toThrow(
          /outside the Usage Epoch interval/
        );
      }
    );


    test(
      "reader paginates strongly and report-data builder loads visitor first-seen evidence",
      async () => {
        const epoch =
          closingEpoch();

        const first =
          record({
            eventId:
              "page-1",

            ts:
              Date.parse(
                "2026-08-24T23:59:30.000Z"
              ),

            visitorHash:
              "visitor-a",

            sessionHash:
              "session-a",

            type:
              "session_start",
          });

        const second =
          record({
            eventId:
              "page-2",

            ts:
              Date.parse(
                "2026-08-25T00:00:30.000Z"
              ),

            visitorHash:
              "visitor-b",

            sessionHash:
              "session-b",

            type:
              "session_start",
          });


        let queryCount =
          0;


        const send =
          jest.fn(
            async (
              command:
                any
            ) => {
              if (
                command instanceof
                  QueryCommand
              ) {
                queryCount +=
                  1;


                if (
                  queryCount ===
                  1
                ) {
                  return {
                    Items: [
                      marshall(
                        first
                      ),
                    ],

                    LastEvaluatedKey:
                      marshall({
                        pk:
                          first.pk,

                        sk:
                          first.sk,
                      }),
                  };
                }


                return {
                  Items: [
                    marshall(
                      second
                    ),
                  ],
                };
              }


              if (
                command instanceof
                  BatchGetItemCommand
              ) {
                return {
                  Responses: {
                    [ANALYTICS_TABLE]: [
                      marshall({
                        visitorHash:
                          "visitor-a",

                        firstSeenAt:
                          Date.parse(
                            "2026-08-20T00:00:00.000Z"
                          ),
                      }),

                      marshall({
                        visitorHash:
                          "visitor-b",

                        firstSeenAt:
                          Date.parse(
                            "2026-08-25T00:00:30.000Z"
                          ),
                      }),
                    ],
                  },

                  UnprocessedKeys:
                    {},
                };
              }


              throw new Error(
                "Unexpected DynamoDB command."
              );
            }
          );


        const analytics =
          await buildUsageEpochAnalyticsReportData({
            client: {
              send,
            },

            projectionTableName:
              PROJECTION_TABLE,

            analyticsTableName:
              ANALYTICS_TABLE,

            epoch,
          });


        expect(
          queryCount
        ).toBe(
          2
        );


        const queryCommands =
          send.mock.calls
            .map(
              (
                call
              ) =>
                call[0]
            )
            .filter(
              (
                command:
                  any
              ) =>
                command instanceof
                  QueryCommand
            );


        expect(
          queryCommands.every(
            (
              command:
                any
            ) =>
              command.input
                .ConsistentRead ===
              true
          )
        ).toBe(
          true
        );


        expect(
          analytics.overview
        ).toMatchObject({
          uniqueVisitors:
            2,

          newVisitors:
            1,

          returningVisitors:
            1,

          sessions:
            2,

          eventCount:
            2,
        });
      }
    );


    test(
      "duplicate projected event fingerprints are rejected rather than double-counted",
      () => {
        const epoch =
          closingEpoch();

        const value =
          record({
            eventId:
              "duplicate-event",

            ts:
              Date.parse(
                "2026-08-25T00:00:00.000Z"
              ),

            visitorHash:
              "visitor",

            sessionHash:
              "session",

            type:
              "session_start",
          });


        expect(
          () =>
            aggregateUsageEpochAnalyticsEvents({
              epoch,

              events: [
                value,
                value,
              ],
            })
        ).toThrow(
          /Duplicate Usage Epoch Analytics event fingerprint/
        );
      }
    );
  }
);