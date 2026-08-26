import {
  buildPlatformDeploymentTransition,
  createPlatformDeploymentLedgerSortKey,
  createPlatformDeploymentReleaseIndexPk,
  validateActivePlatformReleasePointer,
  validatePlatformDeploymentRecord,
} from "../lambda/platform-deployment-contract";


const RELEASE_SHA =
  "a".repeat(
    64
  );


describe(
  "Platform Deployment contract",
  () => {
    test(
      "builds the first Active Platform pointer and append-only deployment record",
      () => {
        const transition =
          buildPlatformDeploymentTransition({
            deploymentId:
              "pdep_first",

            platformReleaseId:
              "plr_release_001",

            deployedAt:
              "2026-08-23T12:00:00.000Z",

            platformReleaseSha256:
              RELEASE_SHA,
          });


        expect(
          transition
            .expectedPreviousRevision
        ).toBeNull();


        expect(
          transition.pointer
        ).toMatchObject({
          pk:
            "CONTROL",

          sk:
            "ACTIVE",

          schema:
            "tejas-profile.active-platform-release-pointer",

          pointerSchemaVersion:
            1,

          revision:
            1,

          deploymentId:
            "pdep_first",

          platformReleaseId:
            "plr_release_001",

          deployedAt:
            "2026-08-23T12:00:00.000Z",

          platformReleaseSha256:
            RELEASE_SHA,
        });


        expect(
          transition.ledger
        ).toMatchObject({
          pk:
            "DEPLOYMENT",

          revision:
            1,

          deploymentId:
            "pdep_first",

          platformReleaseId:
            "plr_release_001",

          previousDeploymentId:
            null,

          previousPlatformReleaseId:
            null,
        });


        expect(
          validateActivePlatformReleasePointer(
            transition.pointer
          )
        ).toBe(
          true
        );


        expect(
          validatePlatformDeploymentRecord(
            transition.ledger
          )
        ).toBe(
          true
        );
      }
    );


    test(
      "subsequent deployment preserves exact previous Platform state",
      () => {
        const first =
          buildPlatformDeploymentTransition({
            deploymentId:
              "pdep_first",

            platformReleaseId:
              "plr_release_001",

            deployedAt:
              "2026-08-23T12:00:00.000Z",

            platformReleaseSha256:
              RELEASE_SHA,
          });


        const second =
          buildPlatformDeploymentTransition({
            currentPointer:
              first.pointer,

            deploymentId:
              "pdep_second",

            platformReleaseId:
              "plr_release_002",

            deployedAt:
              "2026-08-23T13:00:00.000Z",

            platformReleaseSha256:
              "b".repeat(
                64
              ),
          });


        expect(
          second
            .expectedPreviousRevision
        ).toBe(
          1
        );


        expect(
          second.pointer
            .revision
        ).toBe(
          2
        );


        expect(
          second.ledger
        ).toMatchObject({
          revision:
            2,

          previousDeploymentId:
            "pdep_first",

          previousPlatformReleaseId:
            "plr_release_001",

          deploymentId:
            "pdep_second",

          platformReleaseId:
            "plr_release_002",
        });
      }
    );


    test(
      "redeploying the same immutable Platform Release is still a distinct deployment occurrence",
      () => {
        const first =
          buildPlatformDeploymentTransition({
            deploymentId:
              "pdep_first",

            platformReleaseId:
              "plr_same",

            deployedAt:
              "2026-08-23T12:00:00.000Z",

            platformReleaseSha256:
              RELEASE_SHA,
          });


        const second =
          buildPlatformDeploymentTransition({
            currentPointer:
              first.pointer,

            deploymentId:
              "pdep_redeploy",

            platformReleaseId:
              "plr_same",

            deployedAt:
              "2026-08-23T14:00:00.000Z",

            platformReleaseSha256:
              RELEASE_SHA,
          });


        expect(
          second.pointer
            .platformReleaseId
        ).toBe(
          first.pointer
            .platformReleaseId
        );


        expect(
          second.pointer
            .deploymentId
        ).not.toBe(
          first.pointer
            .deploymentId
        );


        expect(
          second.pointer
            .revision
        ).toBe(
          2
        );


        expect(
          second.ledger
            .previousDeploymentId
        ).toBe(
          "pdep_first"
        );
      }
    );


    test(
      "deployment ledger keys and Platform Release reverse index are canonical",
      () => {
        expect(
          createPlatformDeploymentLedgerSortKey(
            "2026-08-23T12:00:00.000Z",
            "pdep_001"
          )
        ).toBe(
          "2026-08-23T12:00:00.000Z#pdep_001"
        );


        expect(
          createPlatformDeploymentReleaseIndexPk(
            "plr_001"
          )
        ).toBe(
          "RELEASE#plr_001"
        );
      }
    );


    test(
      "rejects unsafe identities timestamps and Platform Release digests",
      () => {
        expect(
          () =>
            buildPlatformDeploymentTransition({
              deploymentId:
                "../bad",

              platformReleaseId:
                "plr_001",

              deployedAt:
                "2026-08-23T12:00:00.000Z",

              platformReleaseSha256:
                RELEASE_SHA,
            })
        ).toThrow(
          /deploymentId is invalid/
        );


        expect(
          () =>
            buildPlatformDeploymentTransition({
              deploymentId:
                "pdep_001",

              platformReleaseId:
                "plr_001",

              deployedAt:
                "August 23 2026",

              platformReleaseSha256:
                RELEASE_SHA,
            })
        ).toThrow(
          /canonical UTC ISO timestamp/
        );


        expect(
          () =>
            buildPlatformDeploymentTransition({
              deploymentId:
                "pdep_001",

              platformReleaseId:
                "plr_001",

              deployedAt:
                "2026-08-23T12:00:00.000Z",

              platformReleaseSha256:
                "bad",
            })
        ).toThrow(
          /64-character lowercase hexadecimal digest/
        );
      }
    );


    test(
      "subsequent ledger records require atomic previous deployment identity",
      () => {
        const first =
          buildPlatformDeploymentTransition({
            deploymentId:
              "pdep_first",

            platformReleaseId:
              "plr_first",

            deployedAt:
              "2026-08-23T12:00:00.000Z",

            platformReleaseSha256:
              RELEASE_SHA,
          });


        const second =
          buildPlatformDeploymentTransition({
            currentPointer:
              first.pointer,

            deploymentId:
              "pdep_second",

            platformReleaseId:
              "plr_second",

            deployedAt:
              "2026-08-23T13:00:00.000Z",

            platformReleaseSha256:
              "b".repeat(
                64
              ),
          });


        expect(
          () =>
            validatePlatformDeploymentRecord({
              ...second.ledger,

              previousPlatformReleaseId:
                null,
            })
        ).toThrow(
          /must be provided together/
        );
      }
    );
  }
);