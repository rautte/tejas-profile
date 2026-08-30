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
  buildFormalProfilePublication,
  publishFormalProfilePublication,
} =
  require(
    "./formal-profile-control.cjs"
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
