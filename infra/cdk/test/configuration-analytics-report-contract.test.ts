import {
  computeDeploymentConfigurationId,
} from "../lambda/deployment-configuration-contract";

import {
  USAGE_EPOCH_TRANSITION_KIND,
  createClosingUsageEpochDocument,
  createOpenUsageEpochDocument,
  finalizeUsageEpochDocument,
} from "../lambda/usage-epoch-contract";

import {
  CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA,
  CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1,
  computeConfigurationAnalyticsReportId,
  createConfigurationAnalyticsReportDocument,
  createConfigurationAnalyticsReportObjectKey,
  normalizeAndValidateConfigurationAnalyticsReportDocument,
} from "../lambda/configuration-analytics-report-contract";


function configuration({
  stage =
    "prod",

  platformReleaseId =
    "plr_report_001",

  profileVariantId =
    "prv_report_001",
}: {
  stage?:
    | "dev"
    | "prod";

  platformReleaseId?:
    string;

  profileVariantId?:
    string;
} = {}) {
  const deploymentConfigurationId =
    computeDeploymentConfigurationId({
      stage,

      platformReleaseId,

      profileVariantId,
    });


  return {
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
  };
}


function openEpoch() {
  return createOpenUsageEpochDocument({
    startedAt:
      "2026-08-24T01:00:00.000Z",

    deploymentConfiguration:
      configuration(),

    openedBy: {
      kind:
        USAGE_EPOCH_TRANSITION_KIND
          .PLATFORM_DEPLOYMENT,

      occurrenceId:
        "pdep_report_001",
    },
  });
}


function closingEpoch() {
  return createClosingUsageEpochDocument({
    epoch:
      openEpoch(),

    endedAt:
      "2026-08-24T02:00:00.000Z",

    closedBy: {
      kind:
        USAGE_EPOCH_TRANSITION_KIND
          .PROFILE_ACTIVATION,

      occurrenceId:
        "act_report_close_001",
    },
  });
}


function analytics() {
  return {
    overview: {
      uniqueVisitors:
        2,

      newVisitors:
        1,

      returningVisitors:
        1,

      sessions:
        3,

      activeMs:
        120000,

      eventCount:
        18,
    },

    sections: [
      {
        section:
          "About Me",

        visits:
          3,

        activeMs:
          40000,

        visitors:
          2,

        sessions:
          3,
      },
    ],

    ctas: [
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
    ],

    projects:
      [],

    snippets:
      [],

    deepLinks:
      [],

    depthMilestones:
      [],

    countries: [
      {
        countryCode:
          "US",

        visitors:
          2,

        sessions:
          3,

        activeMs:
          120000,
      },
    ],

    cities:
      [],

    daily: [
      {
        day:
          "2026-08-24",

        uniqueVisitors:
          2,

        sessions:
          3,

        activeMs:
          120000,

        eventCount:
          18,

        fragments:
          4,
      },
    ],
  };
}


function report() {
  return createConfigurationAnalyticsReportDocument({
    epoch:
      closingEpoch(),

    analytics:
      analytics(),
  });
}


describe(
  "Configuration Analytics Report contract",
  () => {
    test(
      "creates one immutable aggregate report from a CLOSING Usage Epoch",
      () => {
        const value =
          report();


        expect(
          value
        ).toMatchObject({
          schema:
            CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA,

          schemaId:
            CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1,

          stage:
            "prod",

          platformReleaseId:
            "plr_report_001",

          profileVariantId:
            "prv_report_001",

          interval: {
            startedAt:
              "2026-08-24T01:00:00.000Z",

            endedAt:
              "2026-08-24T02:00:00.000Z",
          },

          openedBy: {
            kind:
              "platform_deployment",

            occurrenceId:
              "pdep_report_001",
          },

          closedBy: {
            kind:
              "profile_activation",

            occurrenceId:
              "act_report_close_001",
          },
        });


        expect(
          value.reportId
        ).toMatch(
          /^car_[a-f0-9]{64}$/
        );


        expect(
          Object.prototype
            .hasOwnProperty
            .call(
              value,
              "generatedAt"
            )
        ).toBe(false);


        expect(
          Object.prototype
            .hasOwnProperty
            .call(
              value,
              "finalizedAt"
            )
        ).toBe(false);
      }
    );


    test(
      "report identity is deterministic from schema + stage + Usage Epoch only",
      () => {
        const epoch =
          closingEpoch();

        const first =
          computeConfigurationAnalyticsReportId({
            stage:
              epoch.stage,

            usageEpochId:
              epoch.usageEpochId,
          });

        const second =
          computeConfigurationAnalyticsReportId({
            stage:
              epoch.stage,

            usageEpochId:
              epoch.usageEpochId,
          });


        expect(
          second
        ).toBe(
          first
        );


        expect(
          computeConfigurationAnalyticsReportId({
            stage:
              "dev",

            usageEpochId:
              epoch.usageEpochId,
          })
        ).not.toBe(
          first
        );


        expect(
          createConfigurationAnalyticsReportObjectKey(
            first
          )
        ).toBe(
          `reports/${first}.json`
        );
      }
    );


    test(
      "OPEN and CLOSED Usage Epochs cannot construct a historical report",
      () => {
        expect(
          () =>
            createConfigurationAnalyticsReportDocument({
              epoch:
                openEpoch(),

              analytics:
                analytics(),
            })
        ).toThrow(
          /CLOSING Usage Epoch/
        );


        const closing =
          closingEpoch();

        const closed =
          finalizeUsageEpochDocument({
            epoch:
              closing,

            reportId:
              "car_existing_report",

            reportSha256:
              "b".repeat(
                64
              ),

            finalizedAt:
              "2026-08-24T02:05:00.000Z",
          });


        expect(
          () =>
            createConfigurationAnalyticsReportDocument({
              epoch:
                closed,

              analytics:
                analytics(),
            })
        ).toThrow(
          /CLOSING Usage Epoch/
        );
      }
    );


    test(
      "stored report identity tampering fails closed",
      () => {
        const value =
          report();


        expect(
          () =>
            normalizeAndValidateConfigurationAnalyticsReportDocument({
              ...value,

              reportId:
                `car_${"f".repeat(
                  64
                )}`,
            })
        ).toThrow(
          /reportId must be/
        );


        expect(
          () =>
            normalizeAndValidateConfigurationAnalyticsReportDocument({
              ...value,

              profileVariantId:
                "prv_forged",
            })
        ).toThrow(
          /deploymentConfigurationId must be/
        );


        expect(
          () =>
            normalizeAndValidateConfigurationAnalyticsReportDocument({
              ...value,

              usageEpochId:
                "uep_forged",
            })
        ).toThrow();
      }
    );


    test(
      "unknown report and archived analytics fields are rejected",
      () => {
        const value =
          report();


        expect(
          () =>
            normalizeAndValidateConfigurationAnalyticsReportDocument({
              ...value,

              generatedAt:
                "2026-08-24T02:05:00.000Z",
            })
        ).toThrow(
          "Configuration Analytics Report.generatedAt is not supported."
        );


        expect(
          () =>
            normalizeAndValidateConfigurationAnalyticsReportDocument({
              ...value,

              analytics: {
                ...value.analytics,

                sessionIntelligence:
                  [],
              },
            })
        ).toThrow(
          "analytics.sessionIntelligence is not supported."
        );


        expect(
          () =>
            normalizeAndValidateConfigurationAnalyticsReportDocument({
              ...value,

              analytics: {
                ...value.analytics,

                profileVersions:
                  [],
              },
            })
        ).toThrow(
          "analytics.profileVersions is not supported."
        );
      }
    );


    test(
      "archived analytics accepts JSON data only",
      () => {
        const value =
          report();


        expect(
          () =>
            normalizeAndValidateConfigurationAnalyticsReportDocument({
              ...value,

              analytics: {
                ...value.analytics,

                overview: {
                  bad:
                    new Date(
                      "2026-08-24T02:00:00.000Z"
                    ),
                },
              },
            })
        ).toThrow(
          /JSON-safe values/
        );


        expect(
          () =>
            normalizeAndValidateConfigurationAnalyticsReportDocument({
              ...value,

              analytics: {
                ...value.analytics,

                overview: {
                  bad:
                    Number.POSITIVE_INFINITY,
                },
              },
            })
        ).toThrow(
          /finite JSON numbers/
        );
      }
    );
  }
);