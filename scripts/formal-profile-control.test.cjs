// scripts/formal-profile-control.test.cjs

const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const {
  activateFormalProfileComposition,
  buildFormalProfilePublication,
  configureFormalProfileComposition,
  publishFormalProfilePublication,
} =
  require(
    "./formal-profile-control.cjs"
  );


const {
  createProfileOwnerCompositionApi,
} =
  require(
    "./lib/profile-owner-composition-api.cjs"
  );


const ROOT =
  process.cwd();

const BASE_INPUT = {
  root:
    ROOT,

  profileVariantId:
    "prv_p11c1h_test",

  targetingLocation:
    "Test Location",

  targetingJobRole:
    "Backend Engineer",

  gitSha:
    "e795e5cc3fdd63d4843a7fa05f119539aaeeaf0e",

  checkpointTag:
    "checkpoint-2026-08-30_11-58-08",

  createdAt:
    "2026-08-30T12:45:00.000Z",
};


test(
  "builds the canonical immutable repository Profile publication deterministically",
  async () => {
    const first =
      await buildFormalProfilePublication(
        BASE_INPUT
      );

    const second =
      await buildFormalProfilePublication(
        BASE_INPUT
      );


    assert.equal(
      first
        .publication
        .assetUploads
        .length,
      6
    );


    assert.match(
      first
        .publication
        .contentHash,
      /^[a-f0-9]{64}$/
    );


    assert.match(
      first
        .publication
        .manifestUpload
        .sha256,
      /^[a-f0-9]{64}$/
    );


    assert.equal(
      first
        .publication
        .manifestUpload
        .body,
      second
        .publication
        .manifestUpload
        .body
    );


    assert.equal(
      first
        .publication
        .manifestUpload
        .sha256,
      second
        .publication
        .manifestUpload
        .sha256
    );
  }
);


test(
  "requires explicit targeting and never invents production targeting metadata",
  async () => {
    await assert.rejects(
      () =>
        buildFormalProfilePublication({
          ...BASE_INPUT,

          targetingLocation:
            "",
        }),
      /PROFILE_TARGETING_LOCATION is required/
    );


    await assert.rejects(
      () =>
        buildFormalProfilePublication({
          ...BASE_INPUT,

          targetingJobRole:
            "",
        }),
      /PROFILE_TARGETING_JOB_ROLE is required/
    );
  }
);


test(
  "publishes through injected immutable-Variant API without activation",
  async () => {
    const build =
      await buildFormalProfilePublication(
        BASE_INPUT
      );

    const publication =
      build.publication;

    const calls = [];


    const api = {
      async presignProfileVariantAssetPut({
        sha256,
        contentType,
      }) {
        calls.push(
          "presign"
        );


        const asset =
          publication
            .assetUploads
            .find(
              (
                candidate
              ) =>
                candidate
                  .sha256 ===
                  sha256 &&
                candidate
                  .contentType ===
                  contentType
            );


        assert.ok(
          asset
        );


        return {
          ok:
            true,

          key:
            asset.objectKey,

          alreadyExists:
            true,
        };
      },


      async uploadProfileVariantAssetToS3() {
        calls.push(
          "upload"
        );

        throw new Error(
          "Existing immutable test assets must not upload."
        );
      },


      async publishProfileVariant(
        variant
      ) {
        calls.push(
          "publish"
        );


        assert.deepEqual(
          variant,
          publication.variant
        );


        return {
          ok:
            true,

          alreadyPublished:
            false,

          profileVariantId:
            publication
              .profileVariantId,

          contentHash:
            publication
              .contentHash,

          key:
            publication
              .manifestUpload
              .objectKey,

          manifestSha256:
            publication
              .manifestUpload
              .sha256,
        };
      },


      async getProfileVariant(
        profileVariantId
      ) {
        calls.push(
          "get"
        );


        assert.equal(
          profileVariantId,
          publication
            .profileVariantId
        );


        return {
          ok:
            true,

          key:
            publication
              .manifestUpload
              .objectKey,

          manifestSha256:
            publication
              .manifestUpload
              .sha256,

          variant:
            publication.variant,
        };
      },
    };


    assert.equal(
      Object.prototype
        .hasOwnProperty
        .call(
          api,
          "activateProfileVariant"
        ),
      false
    );


    const result =
      await publishFormalProfilePublication({
        build,
        api,
      });


    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result
        .profileVariantId,
      publication
        .profileVariantId
    );

    assert.equal(
      calls.filter(
        (
          call
        ) =>
          call ===
          "presign"
      ).length,
      6
    );

    assert.equal(
      calls.includes(
        "upload"
      ),
      false
    );

    assert.deepEqual(
      calls.slice(
        -2
      ),
      [
        "publish",
        "get",
      ]
    );
  }
);

test(
  "configures an exact composition without publishing or activating",
  async () => {
    const calls = [];


    const api = {
      async createDeploymentConfiguration({
        platformReleaseId,
        profileVariantId,
      }) {
        calls.push({
          platformReleaseId,
          profileVariantId,
        });


        return {
          ok:
            true,

          alreadyCreated:
            false,

          deploymentConfigurationId:
            "cfg_test_composition",

          configuration: {
            platformReleaseId,
            profileVariantId,
          },
        };
      },
    };


    assert.equal(
      Object.prototype
        .hasOwnProperty
        .call(
          api,
          "publishProfileVariant"
        ),
      false
    );


    assert.equal(
      Object.prototype
        .hasOwnProperty
        .call(
          api,
          "activateProfileVariant"
        ),
      false
    );


    const result =
      await configureFormalProfileComposition({
        platformReleaseId:
          "plr_test_composition",

        profileVariantId:
          "prv_test_composition",

        api,
      });


    assert.equal(
      result
        .deploymentConfigurationId,
      "cfg_test_composition"
    );


    assert.deepEqual(
      calls,
      [
        {
          platformReleaseId:
            "plr_test_composition",

          profileVariantId:
            "prv_test_composition",
        },
      ]
    );
  }
);


test(
  "formal activation requires explicit optimistic concurrency and preserves revision zero",
  async () => {
    const calls = [];


    const api = {
      async activateProfileVariant({
        profileVariantId,
        expectedRevision,
      }) {
        calls.push({
          profileVariantId,
          expectedRevision,
        });


        return {
          ok:
            true,

          active: {
            profileVariantId,
            revision:
              1,
          },
        };
      },
    };


    await assert.rejects(
      () =>
        activateFormalProfileComposition({
          profileVariantId:
            "prv_first_formal",

          api,
        }),
      /PROFILE_EXPECTED_REVISION is required/
    );


    assert.equal(
      calls.length,
      0
    );


    const result =
      await activateFormalProfileComposition({
        profileVariantId:
          "prv_first_formal",

        expectedRevision:
          0,

        api,
      });


    assert.deepEqual(
      calls,
      [
        {
          profileVariantId:
            "prv_first_formal",

          expectedRevision:
            0,
        },
      ]
    );


    assert.equal(
      result
        .active
        .revision,
      1
    );
  }
);


test(
  "composition owner API sends identities only and has no publication surface",
  async () => {
    const calls = [];


    const fetchImpl =
      async (
        url,
        options
      ) => {
        calls.push({
          url,
          options,
        });


        return {
          ok:
            true,

          status:
            201,

          json:
            async () => ({
              ok:
                true,

              alreadyCreated:
                false,

              deploymentConfigurationId:
                "cfg_transport_test",

              configuration: {
                platformReleaseId:
                  "plr_transport_test",

                profileVariantId:
                  "prv_transport_test",
              },
            }),
        };
      };


    const api =
      createProfileOwnerCompositionApi({
        snapshotsApiUrl:
          "https://api.example.test/",

        ownerToken:
          "owner-test-token",

        fetchImpl,
      });


    assert.equal(
      Object.prototype
        .hasOwnProperty
        .call(
          api,
          "publishProfileVariant"
        ),
      false
    );


    assert.equal(
      Object.prototype
        .hasOwnProperty
        .call(
          api,
          "presignProfileVariantAssetPut"
        ),
      false
    );


    const result =
      await api
        .createDeploymentConfiguration({
          platformReleaseId:
            "plr_transport_test",

          profileVariantId:
            "prv_transport_test",
        });


    assert.equal(
      result
        .deploymentConfigurationId,
      "cfg_transport_test"
    );


    assert.equal(
      calls.length,
      1
    );


    assert.equal(
      calls[0]
        .url,
      "https://api.example.test/deployment-configurations/create"
    );


    assert.deepEqual(
      JSON.parse(
        calls[0]
          .options
          .body
      ),
      {
        platformReleaseId:
          "plr_transport_test",

        profileVariantId:
          "prv_transport_test",
      }
    );
  }
);


test(
  "composition owner API surfaces activation 409 as an optimistic-concurrency conflict",
  async () => {
    const fetchImpl =
      async () => ({
        ok:
          false,

        status:
          409,

        json:
          async () => ({
            ok:
              false,

            error:
              "Activation revision conflict.",
          }),
      });


    const api =
      createProfileOwnerCompositionApi({
        snapshotsApiUrl:
          "https://api.example.test",

        ownerToken:
          "owner-test-token",

        fetchImpl,
      });


    let caught =
      null;


    try {
      await api
        .activateProfileVariant({
          profileVariantId:
            "prv_conflict_test",

          expectedRevision:
            0,
        });
    } catch (
      error
    ) {
      caught =
        error;
    }


    assert.ok(
      caught
    );


    assert.equal(
      caught
        .status,
      409
    );


    assert.equal(
      caught
        .code,
      "PROFILE_ACTIVATION_CONFLICT"
    );


    assert.match(
      caught
        .message,
      /Activation revision conflict/
    );
  }
);
