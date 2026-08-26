import {
  createPlatformReleaseDocument,
  createPlatformReleaseDocumentV2,
  createPlatformReleaseObjectKey,
  normalizeAndValidatePlatformReleaseDocument,
  PLATFORM_RELEASE_SCHEMA_ID_V1,
  PLATFORM_RELEASE_SCHEMA_ID_V2,
} from "../lambda/platform-release-contract";


const GIT_SHA =
  "1".repeat(
    40
  );

const FRONTEND_HASH =
  "a".repeat(
    64
  );

const REPO_HASH =
  "b".repeat(
    64
  );


function validRelease(
  platformReleaseId =
    "plr_test_001"
) {
  return createPlatformReleaseDocument({
    platformReleaseId,

    stage:
      "prod",

    createdAt:
      "2026-08-23T01:00:00.000Z",

    source: {
      repository:
        "rautte/tejas-profile",

      gitSha:
        GIT_SHA,

      gitRef:
        "refs/heads/main",

      checkpointTag:
        "checkpoint-test",
    },

    build: {
      buildTime:
        "2026-08-23T00:59:00.000Z",

      frontendArtifactSha256:
        FRONTEND_HASH,

      githubRunId:
        "12345",

      repoArtifactKey:
        "profiles/legacy/repo/test.zip",

      repoArtifactSha256:
        REPO_HASH,

      diffFiles: {
        infra: [],

        data: [],

        uiux: [
          "src/App.js",
        ],

        githubWorkflow: [],
      },

      diffTagValue:
        "uiux",
    },

    legacy: {
      profileVersionId:
        "pv_1234567",
    },
  });
}


function validReleaseV2(
  platformReleaseId =
    "plr_test_v2_001",
  ppsVersion =
    1
) {
  return createPlatformReleaseDocumentV2({
    platformReleaseId,

    stage:
      "prod",

    createdAt:
      "2026-08-23T01:00:00.000Z",

    source: {
      repository:
        "rautte/tejas-profile",

      gitSha:
        GIT_SHA,

      gitRef:
        "refs/heads/main",

      checkpointTag:
        "checkpoint-test",
    },

    build: {
      buildTime:
        "2026-08-23T00:59:00.000Z",

      frontendArtifactSha256:
        FRONTEND_HASH,

      githubRunId:
        "12345",

      repoArtifactKey:
        "profiles/legacy/repo/test.zip",

      repoArtifactSha256:
        REPO_HASH,

      diffFiles: {
        infra:
          [],

        data:
          [],

        uiux: [
          "src/App.js",
        ],

        githubWorkflow:
          [],
      },

      diffTagValue:
        "uiux",
    },

    profileRuntime: {
      ppsVersion,
    },

    legacy: {
      profileVersionId:
        "pv_1234567",
    },
  });
}


describe(
  "Platform Release contract",
  () => {
    test(
      "builds a normalized immutable software-release identity",
      () => {
        const release =
          validRelease();


        expect(
          release
        ).toMatchObject({
          schema:
            "tejas-profile.platform-release",

          schemaId:
            "tejas-profile.platform-release.v1",

          platformReleaseId:
            "plr_test_001",

          stage:
            "prod",

          source: {
            gitSha:
              GIT_SHA,
          },

          build: {
            frontendArtifactSha256:
              FRONTEND_HASH,

            diffTagValue:
              "uiux",
          },

          legacy: {
            profileVersionId:
              "pv_1234567",
          },
        });
      }
    );


    test(
      "preserves Platform Release v1 as an unqualified historical document",
      () => {
        const release =
          validRelease();


        expect(
          release.schemaId
        ).toBe(
          PLATFORM_RELEASE_SCHEMA_ID_V1
        );


        expect(
          Object.prototype.hasOwnProperty.call(
            release,
            "profileRuntime"
          )
        ).toBe(
          false
        );
      }
    );


    test(
      "builds an explicitly PPS-qualified Platform Release v2",
      () => {
        const release =
          validReleaseV2();


        expect(
          release
        ).toMatchObject({
          schema:
            "tejas-profile.platform-release",

          schemaId:
            PLATFORM_RELEASE_SCHEMA_ID_V2,

          platformReleaseId:
            "plr_test_v2_001",

          profileRuntime: {
            ppsVersion:
              1,
          },
        });
      }
    );


    test(
      "requires an explicit profileRuntime declaration for Platform Release v2",
      () => {
        const v1 =
          validRelease();


        expect(
          () =>
            normalizeAndValidatePlatformReleaseDocument({
              ...v1,

              schemaId:
                PLATFORM_RELEASE_SCHEMA_ID_V2,
            })
        ).toThrow(
          /profileRuntime must be an object/
        );
      }
    );


    test(
      "Platform Release v1 rejects PPS qualification instead of silently reinterpreting history",
      () => {
        const v1 =
          validRelease();


        expect(
          () =>
            normalizeAndValidatePlatformReleaseDocument({
              ...v1,

              profileRuntime: {
                ppsVersion:
                  1,
              },
            })
        ).toThrow(
          /Platform Release\.profileRuntime is not supported/
        );
      }
    );


    test(
      "Platform Release v2 requires a positive PPS version but does not hardcode the current evaluator version",
      () => {
        expect(
          () =>
            validReleaseV2(
              "plr_bad_pps",
              0
            )
        ).toThrow(
          /profileRuntime\.ppsVersion must be a positive integer/
        );


        const future =
          validReleaseV2(
            "plr_future_pps",
            2
          );


        expect(
          future
            .profileRuntime
            .ppsVersion
        ).toBe(
          2
        );
      }
    );


    test(
      "requires an explicit platformReleaseId instead of deriving identity from Git",
      () => {
        expect(
          () =>
            validRelease(
              ""
            )
        ).toThrow(
          /platformReleaseId is required/
        );
      }
    );


    test(
      "creates the immutable object key from explicit Platform Release identity",
      () => {
        expect(
          createPlatformReleaseObjectKey(
            "plr_test_001"
          )
        ).toBe(
          "releases/plr_test_001.json"
        );


        expect(
          () =>
            createPlatformReleaseObjectKey(
              "../bad"
            )
        ).toThrow(
          /platformReleaseId is invalid/
        );
      }
    );


    test(
      "the same Git commit may belong to distinct Platform Releases",
      () => {
        const first =
          validRelease(
            "plr_first"
          );

        const second =
          validRelease(
            "plr_second"
          );


        expect(
          first.source.gitSha
        ).toBe(
          second.source.gitSha
        );

        expect(
          first.platformReleaseId
        ).not.toBe(
          second.platformReleaseId
        );
      }
    );


    test(
      "rejects Profile-content identity inside Platform Release",
      () => {
        const release =
          validRelease();


        expect(
          () =>
            normalizeAndValidatePlatformReleaseDocument({
              ...release,

              profileVariantId:
                "prv_should_not_be_here",
            })
        ).toThrow(
          /profileVariantId is not supported/
        );
      }
    );


    test(
      "requires exact Git and frontend artifact digests",
      () => {
        const release =
          validRelease();


        expect(
          () =>
            normalizeAndValidatePlatformReleaseDocument({
              ...release,

              source: {
                ...release.source,

                gitSha:
                  "abc1234",
              },
            })
        ).toThrow(
          /exact 40-character Git SHA/
        );


        expect(
          () =>
            normalizeAndValidatePlatformReleaseDocument({
              ...release,

              build: {
                ...release.build,

                frontendArtifactSha256:
                  "abc",
              },
            })
        ).toThrow(
          /64-character SHA-256/
        );
      }
    );


    test(
      "diffTagValue must agree with the immutable diffFiles record",
      () => {
        const release =
          validRelease();


        expect(
          () =>
            normalizeAndValidatePlatformReleaseDocument({
              ...release,

              build: {
                ...release.build,

                diffTagValue:
                  "infra",
              },
            })
        ).toThrow(
          /diffTagValue must be "uiux"/
        );
      }
    );


    test(
      "repo artifact key and digest are an atomic metadata pair",
      () => {
        const release =
          validRelease();


        expect(
          () =>
            normalizeAndValidatePlatformReleaseDocument({
              ...release,

              build: {
                ...release.build,

                repoArtifactSha256:
                  null,
              },
            })
        ).toThrow(
          /must be provided together/
        );
      }
    );
  }
);