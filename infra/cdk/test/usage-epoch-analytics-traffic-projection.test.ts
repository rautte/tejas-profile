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
  USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V1,
  USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V2,
  createUsageEpochAnalyticsEventRecord,
} from "../lambda/usage-epoch-analytics-projection";

import {
  aggregateUsageEpochAnalyticsEvents,
} from "../lambda/usage-epoch-analytics-aggregator";

import {
  TRAFFIC_EVIDENCE,
} from "../lambda/traffic-classification";


function configuration() {
  const stage =
    "prod" as const;

  const platformReleaseId =
    "plr_traffic_projection";

  const profileVariantId =
    "prv_traffic_projection";

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
      "2026-08-31T00:00:00.000Z",

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
          "Bangalore, India",

        jobRole:
          "Backend / Infrastructure Engineer",
      },
    },
  });
}


function epochs() {
  const open =
    createOpenUsageEpochDocument({
      startedAt:
        "2026-08-31T10:00:00.000Z",

      deploymentConfiguration:
        configuration(),

      openedBy: {
        kind:
          USAGE_EPOCH_TRANSITION_KIND
            .PLATFORM_DEPLOYMENT,

        occurrenceId:
          "pdep_traffic_projection",
      },
    });


  const closing =
    createClosingUsageEpochDocument({
      epoch:
        open,

      endedAt:
        "2026-08-31T11:00:00.000Z",

      closedBy: {
        kind:
          USAGE_EPOCH_TRANSITION_KIND
            .PROFILE_ACTIVATION,

        occurrenceId:
          "act_traffic_projection_close",
      },
    });


  return {
    open,
    closing,
  };
}


function attribution(
  epoch:
    any
) {
  return {
    usageEpochId:
      epoch.usageEpochId,

    stage:
      epoch.stage,

    deploymentConfigurationId:
      epoch.deploymentConfigurationId,

    platformReleaseId:
      epoch.platformReleaseId,

    profileVariantId:
      epoch.profileVariantId,

    startedAt:
      epoch.startedAt,

    endedAt:
      null,
  };
}


function projectedRecord({
  eventId,
  ts,
  visitorHash,
  sessionHash,
  trafficEvidence =
    [],
}: {
  eventId:
    string;

  ts:
    number;

  visitorHash:
    string;

  sessionHash:
    string;

  trafficEvidence?:
    string[];
}) {
  const {
    open,
  } =
    epochs();


  return createUsageEpochAnalyticsEventRecord({
    attribution:
      attribution(
        open
      ),

    event: {
      eventId,

      ts,

      visitorHash,

      sessionHash,

      type:
        "session_start",

      trafficEvidence,
    },

    geo: {
      countryCode:
        "US",

      regionCode:
        "VA",

      city:
        "Dulles",
    },
  });
}


describe(
  "Usage Epoch Analytics traffic projection migration",
  () => {
    test(
      "new projection rows use V2 and retain only canonical privacy-safe traffic evidence",
      () => {
        const record =
          projectedRecord({
            eventId:
              "event-v2",

            ts:
              Date.parse(
                "2026-08-31T10:10:00.000Z"
              ),

            visitorHash:
              "visitor-v2",

            sessionHash:
              "session-v2",

            trafficEvidence: [
              TRAFFIC_EVIDENCE
                .TRUSTED_POINTER_INPUT,

              "raw-user-agent-value",

              TRAFFIC_EVIDENCE
                .TRUSTED_POINTER_INPUT,
            ],
          });


        expect(
          record.schemaId
        ).toBe(
          USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V2
        );


        expect(
          record.trafficEvidence
        ).toEqual([
          TRAFFIC_EVIDENCE
            .TRUSTED_POINTER_INPUT,
        ]);


        expect(
          JSON.stringify(
            record
          )
        ).not.toContain(
          "raw-user-agent-value"
        );
      }
    );


    test(
      "one closing Usage Epoch can aggregate immutable V1 and V2 projection rows together",
      () => {
        const {
          closing,
        } =
          epochs();


        const legacy: any =
          projectedRecord({
            eventId:
              "legacy-v1-event",

            ts:
              Date.parse(
                "2026-08-31T10:15:00.000Z"
              ),

            visitorHash:
              "visitor-v1",

            sessionHash:
              "session-v1",
          });


        legacy.schemaId =
          USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V1;

        delete legacy
          .trafficEvidence;


        const modern =
          projectedRecord({
            eventId:
              "modern-v2-event",

            ts:
              Date.parse(
                "2026-08-31T10:20:00.000Z"
              ),

            visitorHash:
              "visitor-v2",

            sessionHash:
              "session-v2",

            trafficEvidence: [
              TRAFFIC_EVIDENCE
                .KNOWN_AUTOMATION_USER_AGENT,
            ],
          });


        const analytics =
          aggregateUsageEpochAnalyticsEvents({
            epoch:
              closing,

            events: [
              legacy,
              modern,
            ],
          });


        expect(
          analytics.overview
        ).toMatchObject({
          uniqueVisitors:
            2,

          sessions:
            2,

          eventCount:
            2,
        });
      }
    );


    test(
      "V2 projection validation fails closed on non-canonical traffic evidence",
      () => {
        const {
          closing,
        } =
          epochs();


        const corrupt: any =
          projectedRecord({
            eventId:
              "corrupt-v2-event",

            ts:
              Date.parse(
                "2026-08-31T10:30:00.000Z"
              ),

            visitorHash:
              "visitor-corrupt",

            sessionHash:
              "session-corrupt",
          });


        corrupt.trafficEvidence = [
          "raw-browser-fingerprint",
        ];


        expect(
          () =>
            aggregateUsageEpochAnalyticsEvents({
              epoch:
                closing,

              events: [
                corrupt,
              ],
            })
        ).toThrow(
          /traffic evidence is invalid/
        );
      }
    );
  }
);
