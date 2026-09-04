// infra/cdk/test/effective-deployment-configuration-reader.test.ts

import {
  Readable,
} from "node:stream";

import {
  marshall,
} from "@aws-sdk/util-dynamodb";

import {
  buildProfileActivationTransition,
} from "../lambda/profile-activation-contract";

import {
  buildPlatformDeploymentTransition,
} from "../lambda/platform-deployment-contract";

import {
  createPlatformReleaseDocument,
  createPlatformReleaseDocumentV2,
} from "../lambda/platform-release-contract";

import {
  createDeploymentConfigurationDocument,
  computeDeploymentConfigurationId,
} from "../lambda/deployment-configuration-contract";

import {
  canonicalJsonStringify,
  computeProfileVariantContentHash,
  hexSha256ToBase64,
  sha256Hex,
} from "../lambda/profile-variants-contract";

import {
  readEffectiveDeploymentConfiguration,
} from "../lambda/effective-deployment-configuration-reader";


function profileContent(
  name =
    "Profile A"
) {
  return {
    hero: {
      name,
    },

    aboutMe:
      {},

    experience:
      [],

    education:
      [],

    skills:
      [],

    resume:
      {},

    projects:
      [],

    codeLab:
      [],

    funZone:
      {},

    timeline:
      [],

    contactLinks:
      [],
  };
}


function validVariant({
  profileVariantId =
    "prv_runtime_001",

  name =
    "Profile A",
}: {
  profileVariantId?:
    string;

  name?:
    string;
} = {}) {
  const variant:
    any = {
      schema:
        "tejas-profile.profile-variant",

      schemaId:
        "tejas-profile.profile-variant.v1",

      contentSchemaVersion:
        1,

      profileVariantId,

      contentHash:
        "",

      createdAt:
        "2026-08-23T10:00:00.000Z",

      targeting: {
        location:
          "Austin",

        jobRole:
          "Backend Engineer",
      },

      provenance: {
        gitSha:
          "1".repeat(
            40
          ),
      },

      content:
        profileContent(
          name
        ),

      assets:
        [],
    };


  variant.contentHash =
    computeProfileVariantContentHash(
      variant
    );


  return variant;
}


function validRelease({
  platformReleaseId =
    "plr_runtime_001",

  stage =
    "prod",

  ppsVersion =
    1,
}: {
  platformReleaseId?:
    string;

  stage?:
    "dev" |
    "prod";

  ppsVersion?:
    number;
} = {}) {
  return createPlatformReleaseDocumentV2({
    platformReleaseId,

    stage,

    createdAt:
      "2026-08-23T09:00:00.000Z",

    source: {
      repository:
        "rautte/tejas-profile",

      gitSha:
        "2".repeat(
          40
        ),

      gitRef:
        "refs/heads/main",

      checkpointTag:
        "checkpoint-test",
    },

    build: {
      buildTime:
        "2026-08-23T08:59:00.000Z",

      frontendArtifactSha256:
        "a".repeat(
          64
        ),

      githubRunId:
        "12345",

      repoArtifactKey:
        "profiles/legacy/repo/test.zip",

      repoArtifactSha256:
        "b".repeat(
          64
        ),

      diffFiles: {
        infra:
          [],

        data:
          [],

        uiux:
          [],

        githubWorkflow:
          [],
      },

      diffTagValue:
        "none",
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

function validReleaseV1({
  platformReleaseId =
    "plr_runtime_v1",

  stage =
    "prod",
}: {
  platformReleaseId?:
    string;

  stage?:
    "dev" |
    "prod";
} = {}) {
  const qualified =
    validRelease({
      platformReleaseId,

      stage,
    });


  return createPlatformReleaseDocument({
    platformReleaseId:
      qualified
        .platformReleaseId,

    stage:
      qualified.stage,

    createdAt:
      qualified.createdAt,

    source:
      qualified.source,

    build:
      qualified.build,

    legacy:
      qualified.legacy,
  });
}


function storedResponse(
  value:
    any
) {
  const body =
    canonicalJsonStringify(
      value
    );


  return {
    Body:
      Readable.from([
        Buffer.from(
          body,
          "utf8"
        ),
      ]),

    ContentType:
      "application/json",

    ChecksumSHA256:
      hexSha256ToBase64(
        sha256Hex(
          body
        )
      ),
  };
}


function activeProfilePointer(
  variant =
    validVariant()
) {
  return buildProfileActivationTransition({
    activationId:
      "act_runtime_001",

    profileVariantId:
      variant
        .profileVariantId,

    activatedAt:
      "2026-08-23T11:00:00.000Z",

    contentSchemaVersion:
      variant
        .contentSchemaVersion,

    contentHash:
      variant
        .contentHash,
  }).pointer;
}


function publicActiveProfileIdentity(
  variant =
    validVariant()
) {
  const pointer =
    activeProfilePointer(
      variant
    );


  /**
   * Exact runtime-safe shape returned by readPublicActiveProfile().
   *
   * DynamoDB storage keys deliberately do not cross this boundary.
   */
  return {
    revision:
      pointer.revision,

    activationId:
      pointer.activationId,

    profileVariantId:
      pointer.profileVariantId,

    activatedAt:
      pointer.activatedAt,

    contentSchemaVersion:
      pointer.contentSchemaVersion,

    contentHash:
      pointer.contentHash,
  };
}


function activePlatformPointer(
  release:
    | ReturnType<
        typeof createPlatformReleaseDocument
      >
    | ReturnType<
        typeof createPlatformReleaseDocumentV2
      > =
      validRelease()
) {
  const releaseBody =
    canonicalJsonStringify(
      release
    );


  return buildPlatformDeploymentTransition({
    deploymentId:
      "pdep_runtime_001",

    platformReleaseId:
      release
        .platformReleaseId,

    deployedAt:
      "2026-08-23T12:00:00.000Z",

    platformReleaseSha256:
      sha256Hex(
        releaseBody
      ),
  }).pointer;
}


function configuration({
  release =
    validRelease(),

  variant =
    validVariant(),

  stage =
    "prod",
}: {
  release?:
    any;

  variant?:
    any;

  stage?:
    "dev" |
    "prod";
} = {}) {
  return createDeploymentConfigurationDocument({
    stage,

    createdAt:
      "2026-08-23T12:01:00.000Z",

    platformRelease:
      release,

    profileVariant:
      variant,
  });
}


function noSuchKey() {
  return {
    name:
      "NoSuchKey",

    $metadata: {
      httpStatusCode:
        404,
    },
  };
}


/**
 * The shape S3 actually returns for a GetObject on a missing key
 * when the caller lacks s3:ListBucket -- masks the true NotFound as
 * AccessDenied instead. Both buckets this reader touches are
 * deliberately GetObject-only for the public runtime role, with no
 * ListBucket grant, so this is the real-world error shape for a
 * missing object, not noSuchKey() above.
 */
function accessDeniedMaskingMissingKey() {
  return {
    name:
      "AccessDenied",

    $metadata: {
      httpStatusCode:
        403,
    },
  };
}


describe(
  "effective Deployment Configuration reader",
  () => {
    test(
      "returns null while no formal Active Platform pointer exists",
      async () => {
        const variant =
          validVariant();

        const platformSend =
          jest.fn()
            .mockResolvedValueOnce(
              {}
            );

        const s3Send =
          jest.fn();


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              activeProfilePointer(
                variant
              ),
          })
        ).resolves.toBeNull();


        expect(
          s3Send
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "accepts the runtime-safe Active Profile identity returned by the public Profile reader",
      async () => {
        const variant =
          validVariant();

        const release =
          validRelease();

        const platformPointer =
          activePlatformPointer(
            release
          );

        const config =
          configuration({
            release,
            variant,
          });


        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  platformPointer
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            )
            .mockResolvedValueOnce(
              storedResponse(
                config
              )
            );


        const result =
          await readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              publicActiveProfileIdentity(
                variant
              ),
          });


        expect(
          result
            ?.deploymentConfigurationId
        ).toBe(
          computeDeploymentConfigurationId({
            stage:
              "prod",

            platformReleaseId:
              release
                .platformReleaseId,

            profileVariantId:
              variant
                .profileVariantId,
          })
        );
      }
    );


    test(
      "fails closed on malformed runtime-safe Active Profile identity before reading Platform state",
      async () => {
        const variant =
          validVariant();

        const platformSend =
          jest.fn();

        const s3Send =
          jest.fn();


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer: {
              ...publicActiveProfileIdentity(
                variant
              ),

              profileVariantId:
                "",
            },
          })
        ).rejects.toThrow(
          "Active Profile runtime identity profileVariantId is invalid."
        );


        expect(
          platformSend
        ).not.toHaveBeenCalled();

        expect(
          s3Send
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "resolves a verified effective configuration from exact Active Platform and Active Profile identities",
      async () => {
        const variant =
          validVariant();

        const release =
          validRelease();

        const platformPointer =
          activePlatformPointer(
            release
          );

        const config =
          configuration({
            release,
            variant,
          });


        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  platformPointer
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            )
            .mockResolvedValueOnce(
              storedResponse(
                config
              )
            );


        const result =
          await readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              activeProfilePointer(
                variant
              ),
          });


        expect(
          result
        ).toMatchObject({
          activePlatform: {
            deploymentId:
              "pdep_runtime_001",

            platformReleaseId:
              "plr_runtime_001",
          },

          platformReleaseId:
            "plr_runtime_001",

          deploymentConfigurationId:
            computeDeploymentConfigurationId({
              stage:
                "prod",

              platformReleaseId:
                "plr_runtime_001",

              profileVariantId:
                "prv_runtime_001",
            }),
        });


        expect(
          result
            ?.platformReleaseSha256
        ).toMatch(
          /^[a-f0-9]{64}$/
        );


        expect(
          result
            ?.configurationSha256
        ).toMatch(
          /^[a-f0-9]{64}$/
        );
      }
    );


    test(
      "rejects an Active Platform pointer whose immutable release digest does not match",
      async () => {
        const variant =
          validVariant();

        const release =
          validRelease();

        const pointer =
          buildPlatformDeploymentTransition({
            deploymentId:
              "pdep_runtime_001",

            platformReleaseId:
              release
                .platformReleaseId,

            deployedAt:
              "2026-08-23T12:00:00.000Z",

            platformReleaseSha256:
              "f".repeat(
                64
              ),
          }).pointer;


        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  pointer
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            );


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              activeProfilePointer(
                variant
              ),
          })
        ).rejects.toThrow(
          /digest does not match active pointer/
        );
      }
    );


    test(
      "rejects an Active Platform Release from another stage",
      async () => {
        const variant =
          validVariant();

        const release =
          validRelease({
            stage:
              "dev",
          });


        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  activePlatformPointer(
                    release
                  )
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            );


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              activeProfilePointer(
                variant
              ),
          })
        ).rejects.toThrow(
          /different stage/
        );
      }
    );


    test(
      "rejects a Deployment Configuration that does not describe the active composition",
      async () => {
        const variant =
          validVariant();

        const release =
          validRelease();

        const wrongRelease =
          validRelease({
            platformReleaseId:
              "plr_other",
          });

        const wrongConfiguration =
          configuration({
            release:
              wrongRelease,

            variant,
          });


        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  activePlatformPointer(
                    release
                  )
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            )
            .mockResolvedValueOnce(
              storedResponse(
                wrongConfiguration
              )
            );


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              activeProfilePointer(
                variant
              ),
          })
        ).rejects.toThrow(
          /ID does not match active composition/
        );
      }
    );


    test(
      "rejects configuration Profile evidence that disagrees with the active Profile pointer",
      async () => {
        const activeVariant =
          validVariant({
            name:
              "Active content",
          });

        const conflictingVariant =
          validVariant({
            /**
             * Same explicit Variant identity, but different immutable
             * content used here only to simulate corrupted historical
             * configuration evidence.
             */
            profileVariantId:
              activeVariant
                .profileVariantId,

            name:
              "Different content",
          });

        const release =
          validRelease();

        const conflictingConfiguration =
          configuration({
            release,

            variant:
              conflictingVariant,
          });


        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  activePlatformPointer(
                    release
                  )
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            )
            .mockResolvedValueOnce(
              storedResponse(
                conflictingConfiguration
              )
            );


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              activeProfilePointer(
                activeVariant
              ),
          })
        ).rejects.toThrow(
          /contentHash does not match active Profile/
        );
      }
    );


    test(
      "fails closed when both active pointers exist but the expected immutable configuration is missing",
      async () => {
        const variant =
          validVariant();

        const release =
          validRelease();

        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  activePlatformPointer(
                    release
                  )
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            )
            .mockRejectedValueOnce(
              noSuchKey()
            );


        const expectedId =
          computeDeploymentConfigurationId({
            stage:
              "prod",

            platformReleaseId:
              release
                .platformReleaseId,

            profileVariantId:
              variant
                .profileVariantId,
          });


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              activeProfilePointer(
                variant
              ),
          })
        ).rejects.toThrow(
          `Effective Deployment Configuration "${expectedId}" does not exist.`
        );
      }
    );

    test(
      "recognizes a missing Deployment Configuration masked as S3 AccessDenied the same as NoSuchKey",
      async () => {
        const variant =
          validVariant();

        const release =
          validRelease();

        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  activePlatformPointer(
                    release
                  )
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            )
            .mockRejectedValueOnce(
              accessDeniedMaskingMissingKey()
            );


        const expectedId =
          computeDeploymentConfigurationId({
            stage:
              "prod",

            platformReleaseId:
              release
                .platformReleaseId,

            profileVariantId:
              variant
                .profileVariantId,
          });


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              activeProfilePointer(
                variant
              ),
          })
        ).rejects.toThrow(
          `Effective Deployment Configuration "${expectedId}" does not exist.`
        );
      }
    );

    test(
      "fails closed when historical Platform Release v1 is still active",
      async () => {
        const variant =
          validVariant();

        const release =
          validReleaseV1();

        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  activePlatformPointer(
                    release
                  )
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            );


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              activeProfilePointer(
                variant
              ),
          })
        ).rejects.toThrow(
          /does not explicitly declare a Profile Platform Specification/
        );


        /**
         * Qualification fails before any Deployment Configuration is
         * trusted or exposed.
         */
        expect(
          s3Send
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );

    test(
      "fails closed when active Platform Release declares an unsupported future PPS version",
      async () => {
        const variant =
          validVariant();

        const release =
          validRelease({
            platformReleaseId:
              "plr_runtime_future_pps",

            ppsVersion:
              2,
          });

        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  activePlatformPointer(
                    release
                  )
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            );


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              activeProfilePointer(
                variant
              ),
          })
        ).rejects.toThrow(
          /declares unsupported PPS v2/
        );


        expect(
          s3Send
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );

    test(
      "fails closed when verified active composition is incompatible with the declared PPS",
      async () => {
        const release =
          validRelease({
            platformReleaseId:
              "plr_runtime_incompatible",
          });

        const variant =
          validVariant({
            profileVariantId:
              "prv_runtime_incompatible",
          });

        const incompatibleConfiguration:
          any =
            configuration({
              release,

              variant,
            });


        /**
         * Simulate a future Profile content schema that remains a
         * structurally valid immutable composition but is unsupported
         * by PPS v1.
         */
        incompatibleConfiguration
          .profile =
          {
            ...incompatibleConfiguration
              .profile,

            contentSchemaVersion:
              2,
          };


        const incompatibleProfilePointer =
          buildProfileActivationTransition({
            activationId:
              "act_runtime_incompatible",

            profileVariantId:
              variant
                .profileVariantId,

            activatedAt:
              "2026-08-23T11:00:00.000Z",

            contentSchemaVersion:
              2,

            contentHash:
              incompatibleConfiguration
                .profile
                .contentHash,
          }).pointer;


        const platformSend =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  activePlatformPointer(
                    release
                  )
                ),
            });

        const s3Send =
          jest.fn()
            .mockResolvedValueOnce(
              storedResponse(
                release
              )
            )
            .mockResolvedValueOnce(
              storedResponse(
                incompatibleConfiguration
              )
            );


        await expect(
          readEffectiveDeploymentConfiguration({
            platformDeploymentClient: {
              send:
                platformSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            platformDeploymentTableName:
              "platform-deployments",

            platformReleasesBucket:
              "platform-releases",

            deploymentConfigurationsBucket:
              "deployment-configurations",

            stage:
              "prod",

            activeProfilePointer:
              incompatibleProfilePointer,
          })
        ).rejects.toThrow(
          /not compatible with PPS v1/
        );
      }
    );

  }
);