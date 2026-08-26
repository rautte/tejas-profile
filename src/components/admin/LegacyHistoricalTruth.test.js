// src/components/admin/LegacyHistoricalTruth.test.js


import {
  render,
  screen,
} from "@testing-library/react";

import {
  HistoricalTruthBadge,
  LegacyDeployHistoryTruthPanel,
  buildLegacyHistoricalTruthPresentation,
} from "./LegacyHistoricalTruth";


describe(
  "LegacyHistoricalTruth",
  () => {
    test(
      "renders truthful unmapped legacy state",
      () => {
        render(
          <HistoricalTruthBadge
            historicalTruth={{
              sourceKind:
                "legacy",

              classification:
                "LEGACY_UNMAPPED",

              candidateFormalIdentities:
                [],

              invalidReasons:
                [],
            }}
          />
        );


        expect(
          screen.getByText(
            "Legacy · Unmapped"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "renders an explicitly linked legacy state without deriving additional IDs",
      () => {
        const presentation =
          buildLegacyHistoricalTruthPresentation({
            sourceKind:
              "legacy",

            classification:
              "LEGACY_LINKED",

            candidateFormalIdentities: [
              {
                kind:
                  "platform_release",

                id:
                  "plr_gha_200_1",
              },

              {
                kind:
                  "platform_deployment",

                id:
                  "pdep_gha_200_1",
              },
            ],

            invalidReasons:
              [],
          });


        expect(
          presentation.label
        ).toBe(
          "Legacy · Linked"
        );


        expect(
          presentation
            .formalLinks
        ).toEqual([
          {
            kind:
              "platform_release",

            id:
              "plr_gha_200_1",

            label:
              "Platform Release",
          },

          {
            kind:
              "platform_deployment",

            id:
              "pdep_gha_200_1",

            label:
              "Platform Deployment",
          },
        ]);
      }
    );


    test(
      "renders ambiguous legacy history explicitly",
      () => {
        render(
          <HistoricalTruthBadge
            historicalTruth={{
              sourceKind:
                "legacy",

              classification:
                "AMBIGUOUS",

              candidateFormalIdentities: [
                {
                  kind:
                    "platform_release",

                  id:
                    "plr_a",
                },

                {
                  kind:
                    "platform_release",

                  id:
                    "plr_b",
                },
              ],

              invalidReasons:
                [],
            }}
          />
        );


        expect(
          screen.getByText(
            "Legacy · Ambiguous"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "fails closed when historical truth is missing",
      () => {
        render(
          <HistoricalTruthBadge />
        );


        expect(
          screen.getByText(
            "Legacy · Unclassified"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "rejects FORMAL classification on the legacy surface",
      () => {
        const presentation =
          buildLegacyHistoricalTruthPresentation({
            sourceKind:
              "formal",

            classification:
              "FORMAL",

            candidateFormalIdentities: [
              {
                kind:
                  "platform_release",

                id:
                  "plr_formal",
              },
            ],
          });


        expect(
          presentation.label
        ).toBe(
          "Legacy · Invalid"
        );


        expect(
          presentation.tone
        ).toBe(
          "danger"
        );
      }
    );


    test(
      "shows explicit formal links for modern legacy deploy-history records",
      () => {
        render(
          <LegacyDeployHistoryTruthPanel
            history={{
              active: {
                gitSha:
                  "a".repeat(
                    40
                  ),

                profileVersionId:
                  "pv_current",

                deployedAt:
                  "2026-08-24T10:00:00.000Z",

                platformReleaseId:
                  "plr_gha_300_1",

                deploymentId:
                  "pdep_gha_300_1",

                historicalTruth: {
                  sourceKind:
                    "legacy",

                  classification:
                    "LEGACY_LINKED",

                  candidateFormalIdentities: [
                    {
                      kind:
                        "platform_deployment",

                      id:
                        "pdep_gha_300_1",
                    },

                    {
                      kind:
                        "platform_release",

                      id:
                        "plr_gha_300_1",
                    },
                  ],

                  invalidReasons:
                    [],
                },
              },

              previous:
                null,
            }}
          />
        );


        expect(
          screen.getByText(
            "Legacy deploy-history truth"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "Legacy · Linked"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "plr_gha_300_1"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "pdep_gha_300_1"
          )
        ).toBeInTheDocument();
      }
    );
  }
);