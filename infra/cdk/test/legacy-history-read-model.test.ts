// infra/cdk/test/legacy-history-read-model.test.ts


import {
  HISTORICAL_EVIDENCE_CLASSIFICATION,
  HISTORICAL_FORMAL_IDENTITY_KIND,
} from "../lambda/historical-evidence-classification";

import {
  buildLegacyDeployHistoryRecordHistoricalTruth,
  buildLegacySnapshotHistoricalTruth,
  enrichLegacyDeployHistory,
} from "../lambda/legacy-history-read-model";


describe(
  "legacy-history-read-model",
  () => {
    test(
      "classifies a legacy Snapshot as unmapped without inventing formal identity",
      () => {
        const truth =
          buildLegacySnapshotHistoricalTruth({
            snapshotKey:
              "snapshots/ci_deploy/from_a_to_b/example.json",

            createdAt:
              "2026-08-20T10:00:00.000Z",

            meta: {
              profileVersionId:
                "pv_legacy",

              gitSha:
                "a".repeat(
                  40
                ),

              checkpointTag:
                "checkpoint-legacy",

              repoArtifactKey:
                "profiles/pv_legacy/repo/example.zip",

              repoArtifactSha256:
                "b".repeat(
                  64
                ),
            },
          });


        expect(
          truth.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_UNMAPPED
        );


        expect(
          truth.formalIdentity
        ).toBeNull();


        expect(
          truth
            .candidateFormalIdentities
        ).toEqual(
          []
        );


        expect(
          truth.legacyEvidence
        ).toMatchObject({
          profileVersionId:
            "pv_legacy",

          gitSha:
            "a".repeat(
              40
            ),

          checkpointTag:
            "checkpoint-legacy",
        });
      }
    );


    test(
      "classifies a P9E Snapshot with explicit formal control-plane links as LEGACY_LINKED",
      () => {
        const truth =
          buildLegacySnapshotHistoricalTruth({
            snapshotKey:
              "snapshots/ci_deploy/from_a_to_b/linked.json",

            createdAt:
              "2026-08-24T10:00:00.000Z",

            meta: {
              profileVersionId:
                "pv_linked",

              gitSha:
                "a".repeat(
                  40
                ),

              checkpointTag:
                "gha_500",

              repoArtifactKey:
                "profiles/pv_linked/repo/profile_repo.zip",

              repoArtifactSha256:
                "b".repeat(
                  64
                ),

              platformReleaseId:
                "plr_gha_500_1",

              platformDeploymentId:
                "pdep_gha_500_1",
            },
          });


        expect(
          truth.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_LINKED
        );


        /**
         * The legacy Snapshot as a whole does not become a canonical
         * formal object. It simply has multiple compatible formal
         * links.
         */
        expect(
          truth.formalIdentity
        ).toBeNull();


        expect(
          truth
            .candidateFormalIdentities
        ).toEqual([
          {
            kind:
              HISTORICAL_FORMAL_IDENTITY_KIND
                .PLATFORM_DEPLOYMENT,

            id:
              "pdep_gha_500_1",
          },

          {
            kind:
              HISTORICAL_FORMAL_IDENTITY_KIND
                .PLATFORM_RELEASE,

            id:
              "plr_gha_500_1",
          },
        ]);


        expect(
          truth.legacyEvidence
        ).toMatchObject({
          profileVersionId:
            "pv_linked",

          gitSha:
            "a".repeat(
              40
            ),
        });


        /**
         * Formal IDs must never leak into legacyEvidence itself.
         */
        expect(
          truth.legacyEvidence
        ).not.toHaveProperty(
          "platformReleaseId"
        );


        expect(
          truth.legacyEvidence
        ).not.toHaveProperty(
          "platformDeploymentId"
        );
      }
    );


    test(
      "classifies an old deploy-history record with no explicit formal IDs as unmapped",
      () => {
        const truth =
          buildLegacyDeployHistoryRecordHistoricalTruth({
            gitSha:
              "c".repeat(
                40
              ),

            profileVersionId:
              "pv_old",

            deployedAt:
              "2026-08-01T10:00:00.000Z",

            source:
              "promote",
          });


        expect(
          truth.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_UNMAPPED
        );


        expect(
          truth.formalIdentity
        ).toBeNull();
      }
    );


    test(
      "uses explicit modern deploy-history formal IDs as compatible authoritative links",
      () => {
        const truth =
          buildLegacyDeployHistoryRecordHistoricalTruth({
            gitSha:
              "d".repeat(
                40
              ),

            profileVersionId:
              "pv_modern",

            deployedAt:
              "2026-08-24T10:00:00.000Z",

            source:
              "promote",

            platformReleaseId:
              "plr_gha_200_1",

            deploymentId:
              "pdep_gha_200_1",
          });


        expect(
          truth.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_LINKED
        );


        expect(
          truth.formalIdentity
        ).toBeNull();


        expect(
          truth
            .candidateFormalIdentities
        ).toEqual([
          {
            kind:
              HISTORICAL_FORMAL_IDENTITY_KIND
                .PLATFORM_DEPLOYMENT,

            id:
              "pdep_gha_200_1",
          },

          {
            kind:
              HISTORICAL_FORMAL_IDENTITY_KIND
                .PLATFORM_RELEASE,

            id:
              "plr_gha_200_1",
          },
        ]);
      }
    );


    test(
      "does not derive a missing deployment identity from Platform Release or Git evidence",
      () => {
        const truth =
          buildLegacyDeployHistoryRecordHistoricalTruth({
            gitSha:
              "e".repeat(
                40
              ),

            profileVersionId:
              "pv_partial",

            platformReleaseId:
              "plr_explicit",
          });


        expect(
          truth.classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_LINKED
        );


        expect(
          truth.formalIdentity
        ).toEqual({
          kind:
            HISTORICAL_FORMAL_IDENTITY_KIND
              .PLATFORM_RELEASE,

          id:
            "plr_explicit",
        });


        expect(
          truth
            .candidateFormalIdentities
        ).toHaveLength(
          1
        );
      }
    );


    test(
      "enriches active previous and timeline records without replacing existing legacy fields",
      () => {
        const history = {
          active: {
            gitSha:
              "1".repeat(
                40
              ),

            profileVersionId:
              "pv_active",

            deployedAt:
              "2026-08-24T10:00:00.000Z",

            source:
              "promote",

            platformReleaseId:
              "plr_active",

            deploymentId:
              "pdep_active",
          },

          previous: {
            gitSha:
              "2".repeat(
                40
              ),

            profileVersionId:
              "pv_previous",

            deployedAt:
              "2026-08-20T10:00:00.000Z",

            source:
              "promote",
          },

          timeline: [
            {
              gitSha:
                "1".repeat(
                  40
                ),

              profileVersionId:
                "pv_active",

              platformReleaseId:
                "plr_active",

              deploymentId:
                "pdep_active",
            },

            {
              gitSha:
                "3".repeat(
                  40
                ),

              profileVersionId:
                "pv_legacy",
            },
          ],
        };


        const enriched =
          enrichLegacyDeployHistory(
            history
          ) as any;


        expect(
          enriched.active.gitSha
        ).toBe(
          history.active.gitSha
        );


        expect(
          enriched.active.platformReleaseId
        ).toBe(
          "plr_active"
        );


        expect(
          enriched
            .active
            .historicalTruth
            .classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_LINKED
        );


        expect(
          enriched
            .previous
            .historicalTruth
            .classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_UNMAPPED
        );


        expect(
          enriched
            .timeline[0]
            .historicalTruth
            .classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_LINKED
        );


        expect(
          enriched
            .timeline[1]
            .historicalTruth
            .classification
        ).toBe(
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .LEGACY_UNMAPPED
        );
      }
    );


    test(
      "preserves null deploy history",
      () => {
        expect(
          enrichLegacyDeployHistory(
            null
          )
        ).toBeNull();
      }
    );
  }
);