// infra/cdk/test/historical-evidence-classification.test.ts


import {
  HISTORICAL_EVIDENCE_BASIS,
  HISTORICAL_EVIDENCE_CLASSIFICATION,
  HISTORICAL_EVIDENCE_CLASSIFICATION_SCHEMA,
  HISTORICAL_EVIDENCE_CLASSIFICATION_SCHEMA_ID_V1,
  HISTORICAL_EVIDENCE_SOURCE_KIND,
  HISTORICAL_FORMAL_IDENTITY_KIND,
  classifyHistoricalEvidence,
} from "../lambda/historical-evidence-classification";


describe(
  "historical-evidence-classification",
  () => {
    test(
      "classifies a canonical formal record as FORMAL while preserving legacy provenance",
      () => {
        const result =
          classifyHistoricalEvidence({
            sourceKind:
              HISTORICAL_EVIDENCE_SOURCE_KIND
                .FORMAL,

            formalIdentity: {
              kind:
                HISTORICAL_FORMAL_IDENTITY_KIND
                  .PLATFORM_RELEASE,

              id:
                "plr_gha_100_1",
            },

            legacyEvidence: {
              profileVersionId:
                "pv_c341be8",

              gitSha:
                "a".repeat(
                  40
                ),
            },
          });


        expect(
          result
        ).toEqual({
          schema:
            HISTORICAL_EVIDENCE_CLASSIFICATION_SCHEMA,

          schemaId:
            HISTORICAL_EVIDENCE_CLASSIFICATION_SCHEMA_ID_V1,

          classification:
            HISTORICAL_EVIDENCE_CLASSIFICATION
              .FORMAL,

          basis:
            HISTORICAL_EVIDENCE_BASIS
              .CANONICAL_FORMAL_RECORD,

          sourceKind:
            HISTORICAL_EVIDENCE_SOURCE_KIND
              .FORMAL,

          formalIdentity: {
            kind:
              HISTORICAL_FORMAL_IDENTITY_KIND
                .PLATFORM_RELEASE,

            id:
              "plr_gha_100_1",
          },

          candidateFormalIdentities: [
            {
              kind:
                HISTORICAL_FORMAL_IDENTITY_KIND
                  .PLATFORM_RELEASE,

              id:
                "plr_gha_100_1",
            },
          ],

          legacyEvidence: {
            profileVersionId:
              "pv_c341be8",

            gitSha:
              "a".repeat(
                40
              ),
          },

          invalidReasons:
            [],
        });
      }
    );


    test(
      "classifies a legacy record with one explicit authoritative link as LEGACY_LINKED",
      () => {
        const result =
          classifyHistoricalEvidence({
            sourceKind:
              HISTORICAL_EVIDENCE_SOURCE_KIND
                .LEGACY,

            legacyEvidence: {
              profileVersionId:
                "pv_c341be8",

              checkpointTag:
                "checkpoint-legacy",
            },

            authoritativeFormalLinks: [
              {
                kind:
                  HISTORICAL_FORMAL_IDENTITY_KIND
                    .PLATFORM_RELEASE,

                id:
                  "plr_gha_100_1",
              },
            ],
          });


        expect(
          result.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_LINKED
        );


        expect(
          result.basis
        ).toBe(
          HISTORICAL_EVIDENCE_BASIS
            .EXPLICIT_AUTHORITATIVE_LINK
        );


        expect(
          result.formalIdentity
        ).toEqual({
          kind:
            HISTORICAL_FORMAL_IDENTITY_KIND
              .PLATFORM_RELEASE,

          id:
            "plr_gha_100_1",
        });
      }
    );


    test(
      "classifies legacy evidence with no authoritative link as LEGACY_UNMAPPED",
      () => {
        const result =
          classifyHistoricalEvidence({
            sourceKind:
              HISTORICAL_EVIDENCE_SOURCE_KIND
                .LEGACY,

            legacyEvidence: {
              profileVersionId:
                "pv_legacy",

              gitSha:
                "b".repeat(
                  40
                ),
            },
          });


        expect(
          result.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_UNMAPPED
        );


        expect(
          result.basis
        ).toBe(
          HISTORICAL_EVIDENCE_BASIS
            .NO_AUTHORITATIVE_LINK
        );


        expect(
          result.formalIdentity
        ).toBeNull();


        expect(
          result
            .candidateFormalIdentities
        ).toEqual(
          []
        );
      }
    );


    test(
      "classifies multiple distinct authoritative candidates as AMBIGUOUS and selects none",
      () => {
        const result =
          classifyHistoricalEvidence({
            sourceKind:
              HISTORICAL_EVIDENCE_SOURCE_KIND
                .LEGACY,

            legacyEvidence: {
              profileVersionId:
                "pv_shared",
            },

            authoritativeFormalLinks: [
              {
                kind:
                  HISTORICAL_FORMAL_IDENTITY_KIND
                    .PLATFORM_RELEASE,

                id:
                  "plr_gha_100_1",
              },

              {
                kind:
                  HISTORICAL_FORMAL_IDENTITY_KIND
                    .PLATFORM_RELEASE,

                id:
                  "plr_gha_101_1",
              },
            ],
          });


        expect(
          result.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .AMBIGUOUS
        );


        expect(
          result.basis
        ).toBe(
          HISTORICAL_EVIDENCE_BASIS
            .MULTIPLE_AUTHORITATIVE_LINKS
        );


        expect(
          result.formalIdentity
        ).toBeNull();


        expect(
          result
            .candidateFormalIdentities
        ).toHaveLength(
          2
        );
      }
    );


    test(
      "keeps compatible authoritative links of different formal kinds as LEGACY_LINKED",
      () => {
        const result =
          classifyHistoricalEvidence({
            sourceKind:
              HISTORICAL_EVIDENCE_SOURCE_KIND
                .LEGACY,

            legacyEvidence: {
              profileVersionId:
                "pv_linked_deploy",

              gitSha:
                "c".repeat(
                  40
                ),

              deployedAt:
                "2026-08-24T10:00:00.000Z",

              source:
                "promote",
            },

            authoritativeFormalLinks: [
              {
                kind:
                  HISTORICAL_FORMAL_IDENTITY_KIND
                    .PLATFORM_RELEASE,

                id:
                  "plr_gha_100_1",
              },

              {
                kind:
                  HISTORICAL_FORMAL_IDENTITY_KIND
                    .PLATFORM_DEPLOYMENT,

                id:
                  "pdep_gha_100_1",
              },
            ],
          });


        expect(
          result.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_LINKED
        );


        expect(
          result.basis
        ).toBe(
          HISTORICAL_EVIDENCE_BASIS
            .EXPLICIT_AUTHORITATIVE_LINK
        );


        expect(
          result.formalIdentity
        ).toBeNull();


        expect(
          result
            .candidateFormalIdentities
        ).toEqual([
          {
            kind:
              HISTORICAL_FORMAL_IDENTITY_KIND
                .PLATFORM_DEPLOYMENT,

            id:
              "pdep_gha_100_1",
          },

          {
            kind:
              HISTORICAL_FORMAL_IDENTITY_KIND
                .PLATFORM_RELEASE,

            id:
              "plr_gha_100_1",
          },
        ]);
      }
    );


    test(
      "deduplicates repeated copies of the same authoritative link",
      () => {
        const link = {
          kind:
            HISTORICAL_FORMAL_IDENTITY_KIND
              .PROFILE_VARIANT,

          id:
            "prv_exact",
        };


        const result =
          classifyHistoricalEvidence({
            sourceKind:
              HISTORICAL_EVIDENCE_SOURCE_KIND
                .LEGACY,

            authoritativeFormalLinks: [
              link,
              {
                ...link,
              },
            ],
          });


        expect(
          result.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_LINKED
        );


        expect(
          result
            .candidateFormalIdentities
        ).toEqual([
          link,
        ]);
      }
    );


    test(
      "classifies explicitly inconsistent evidence as INVALID without selecting formal truth",
      () => {
        const result =
          classifyHistoricalEvidence({
            sourceKind:
              HISTORICAL_EVIDENCE_SOURCE_KIND
                .LEGACY,

            legacyEvidence: {
              profileVersionId:
                "pv_conflict",
            },

            authoritativeFormalLinks: [
              {
                kind:
                  HISTORICAL_FORMAL_IDENTITY_KIND
                    .PLATFORM_RELEASE,

                id:
                  "plr_candidate",
              },
            ],

            invalidReasons: [
              "Stored legacy evidence is internally inconsistent.",
            ],
          });


        expect(
          result.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .INVALID
        );


        expect(
          result.basis
        ).toBe(
          HISTORICAL_EVIDENCE_BASIS
            .INVALID_EVIDENCE
        );


        expect(
          result.formalIdentity
        ).toBeNull();


        expect(
          result.invalidReasons
        ).toEqual([
          "Stored legacy evidence is internally inconsistent.",
        ]);
      }
    );


    test(
      "classifies a formal source without canonical identity as INVALID",
      () => {
        const result =
          classifyHistoricalEvidence({
            sourceKind:
              HISTORICAL_EVIDENCE_SOURCE_KIND
                .FORMAL,
          });


        expect(
          result.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .INVALID
        );


        expect(
          result.formalIdentity
        ).toBeNull();


        expect(
          result.invalidReasons
        ).toContain(
          "Formal source record is missing canonical formalIdentity."
        );
      }
    );


    test(
      "rejects a direct formalIdentity assertion on a legacy source",
      () => {
        expect(
          () =>
            classifyHistoricalEvidence({
              sourceKind:
                HISTORICAL_EVIDENCE_SOURCE_KIND
                  .LEGACY,

              legacyEvidence: {
                profileVersionId:
                  "pv_legacy",
              },

              formalIdentity: {
                kind:
                  HISTORICAL_FORMAL_IDENTITY_KIND
                    .PLATFORM_RELEASE,

                id:
                  "plr_inferred",
              },
            })
        ).toThrow(
          "Legacy source records cannot assert formalIdentity directly"
        );
      }
    );


    test(
      "rejects formal control-plane identities inside legacyEvidence",
      () => {
        expect(
          () =>
            classifyHistoricalEvidence({
              sourceKind:
                HISTORICAL_EVIDENCE_SOURCE_KIND
                  .LEGACY,

              legacyEvidence: {
                profileVersionId:
                  "pv_legacy",

                platformReleaseId:
                  "plr_smuggled",
              },
            })
        ).toThrow(
          "legacyEvidence.platformReleaseId is not supported."
        );


        expect(
          () =>
            classifyHistoricalEvidence({
              sourceKind:
                HISTORICAL_EVIDENCE_SOURCE_KIND
                  .LEGACY,

              legacyEvidence: {
                deploymentConfigurationId:
                  "cfg_smuggled",
              },
            })
        ).toThrow(
          "legacyEvidence.deploymentConfigurationId is not supported."
        );


        expect(
          () =>
            classifyHistoricalEvidence({
              sourceKind:
                HISTORICAL_EVIDENCE_SOURCE_KIND
                  .LEGACY,

              legacyEvidence: {
                usageEpochId:
                  "uep_smuggled",
              },
            })
        ).toThrow(
          "legacyEvidence.usageEpochId is not supported."
        );
      }
    );
  }
);