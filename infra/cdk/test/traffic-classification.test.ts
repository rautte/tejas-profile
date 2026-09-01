import {
  TRAFFIC_CLASSIFICATION,
  TRAFFIC_CLASSIFIER_VERSION,
  TRAFFIC_CONFIDENCE,
  TRAFFIC_EVIDENCE,
  classifyTrafficSession,
  deriveBehavioralTrafficEvidence,
  deriveUserAgentTrafficEvidence,
  normalizeTrafficClassificationFilter,
  normalizeTrafficEvidence,
  trafficClassificationMatchesFilter,
} from "../lambda/traffic-classification";


describe(
  "traffic classification domain",
  () => {
    test(
      "known crawler user-agent is likely automated with high confidence",
      () => {
        const evidence =
          deriveUserAgentTrafficEvidence(
            "Mozilla/5.0 compatible Googlebot/2.1"
          );


        expect(
          evidence
        ).toContain(
          TRAFFIC_EVIDENCE
            .KNOWN_AUTOMATION_USER_AGENT
        );


        expect(
          classifyTrafficSession({
            evidence,
          })
        ).toEqual({
          classifierVersion:
            TRAFFIC_CLASSIFIER_VERSION,

          classification:
            TRAFFIC_CLASSIFICATION
              .LIKELY_AUTOMATED,

          confidence:
            TRAFFIC_CONFIDENCE
              .HIGH,

          reasonCodes: [
            TRAFFIC_EVIDENCE
              .KNOWN_AUTOMATION_USER_AGENT,
          ],
        });
      }
    );


    test(
      "headless/WebDriver evidence overrides human-like input evidence",
      () => {
        expect(
          classifyTrafficSession({
            evidence: [
              TRAFFIC_EVIDENCE
                .WEBDRIVER_DETECTED,

              TRAFFIC_EVIDENCE
                .TRUSTED_POINTER_INPUT,
            ],
          })
        ).toMatchObject({
          classification:
            TRAFFIC_CLASSIFICATION
              .LIKELY_AUTOMATED,

          confidence:
            TRAFFIC_CONFIDENCE
              .HIGH,
        });
      }
    );


    test(
      "trusted browser input is likely human with high confidence",
      () => {
        expect(
          classifyTrafficSession({
            evidence: [
              TRAFFIC_EVIDENCE
                .TRUSTED_POINTER_INPUT,

              TRAFFIC_EVIDENCE
                .TRUSTED_WHEEL_INPUT,
            ],

            eventCount:
              3,

            activeMs:
              5_000,

            sectionCount:
              1,
          })
        ).toEqual({
          classifierVersion:
            TRAFFIC_CLASSIFIER_VERSION,

          classification:
            TRAFFIC_CLASSIFICATION
              .LIKELY_HUMAN,

          confidence:
            TRAFFIC_CONFIDENCE
              .HIGH,

          reasonCodes: [
            TRAFFIC_EVIDENCE
              .TRUSTED_POINTER_INPUT,

            TRAFFIC_EVIDENCE
              .TRUSTED_WHEEL_INPUT,
          ],
        });
      }
    );


    test(
      "meaningful engagement is a medium-confidence human fallback",
      () => {
        const result =
          classifyTrafficSession({
            eventCount:
              8,

            activeMs:
              45_000,

            sectionCount:
              3,

            journeyEventCount:
              3,
          });


        expect(
          result
        ).toEqual({
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
        });
      }
    );


    test(
      "short passive machine-like behavior remains uncertain instead of being falsely called a bot",
      () => {
        const behavior =
          deriveBehavioralTrafficEvidence({
            eventCount:
              6,

            activeMs:
              13_000,

            sectionCount:
              2,

            journeyEventCount:
              2,
          });


        expect(
          behavior
        ).toContain(
          TRAFFIC_EVIDENCE
            .PASSIVE_SHORT_SESSION
        );


        expect(
          classifyTrafficSession({
            eventCount:
              6,

            activeMs:
              13_000,

            sectionCount:
              2,

            journeyEventCount:
              2,
          })
        ).toEqual({
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
        });
      }
    );


    test(
      "no evidence remains explicitly uncertain",
      () => {
        expect(
          classifyTrafficSession()
        ).toEqual({
          classifierVersion:
            TRAFFIC_CLASSIFIER_VERSION,

          classification:
            TRAFFIC_CLASSIFICATION
              .UNCERTAIN,

          confidence:
            TRAFFIC_CONFIDENCE
              .LOW,

          reasonCodes:
            [],
        });
      }
    );


    test(
      "missing user-agent is suspicious but not high-confidence automation",
      () => {
        const evidence =
          deriveUserAgentTrafficEvidence(
            ""
          );


        expect(
          classifyTrafficSession({
            evidence,
          })
        ).toEqual({
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
        });
      }
    );


    test(
      "evidence normalization is bounded to the explicit privacy-safe vocabulary",
      () => {
        expect(
          normalizeTrafficEvidence([
            TRAFFIC_EVIDENCE
              .TRUSTED_POINTER_INPUT,

            "raw-user-agent-value",

            TRAFFIC_EVIDENCE
              .TRUSTED_POINTER_INPUT,

            "192.0.2.10",
          ])
        ).toEqual([
          TRAFFIC_EVIDENCE
            .TRUSTED_POINTER_INPUT,
        ]);
      }
    );


    test(
      "traffic filter accepts the four canonical query scopes and rejects unknown values",
      () => {
        expect(
          normalizeTrafficClassificationFilter(
            undefined
          )
        ).toBe(
          "all"
        );


        expect(
          normalizeTrafficClassificationFilter(
            "LIKELY_HUMAN"
          )
        ).toBe(
          TRAFFIC_CLASSIFICATION
            .LIKELY_HUMAN
        );


        expect(
          normalizeTrafficClassificationFilter(
            "likely_automated"
          )
        ).toBe(
          TRAFFIC_CLASSIFICATION
            .LIKELY_AUTOMATED
        );


        expect(
          normalizeTrafficClassificationFilter(
            "uncertain"
          )
        ).toBe(
          TRAFFIC_CLASSIFICATION
            .UNCERTAIN
        );


        expect(
          normalizeTrafficClassificationFilter(
            "definitely_a_robot"
          )
        ).toBeNull();


        expect(
          trafficClassificationMatchesFilter(
            TRAFFIC_CLASSIFICATION
              .LIKELY_HUMAN,

            "all"
          )
        ).toBe(true);


        expect(
          trafficClassificationMatchesFilter(
            TRAFFIC_CLASSIFICATION
              .LIKELY_HUMAN,

            "likely_human"
          )
        ).toBe(true);


        expect(
          trafficClassificationMatchesFilter(
            TRAFFIC_CLASSIFICATION
              .UNCERTAIN,

            "likely_human"
          )
        ).toBe(false);
      }
    );
  }
);
