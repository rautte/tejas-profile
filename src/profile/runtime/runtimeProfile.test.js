import {
  buildProfileContent,
} from "../content";

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
} from "../../utils/profileVariant";

import {
  PROFILE_RUNTIME_SOURCE,
  createActiveRuntimeProfile,
  createRepositoryRuntimeProfile,
  resolveRuntimeProfileAsset,
} from "./runtimeProfile";


const HASH =
  "a".repeat(
    64
  );


function activeResponse() {
  return {
    active: {
      revision:
        1,

      activationId:
        "act_test",

      profileVariantId:
        "prv_test",

      activatedAt:
        "2026-08-22T10:00:00.000Z",

      contentSchemaVersion:
        CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,

      contentHash:
        HASH,
    },

    deployment: {
      platformReleaseId:
        "plr_test",

      deploymentConfigurationId:
        "cfg_test",
    },

    variant: {
      schemaId:
        "tejas-profile.profile-variant.v1",

      contentSchemaVersion:
        CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,

      profileVariantId:
        "prv_test",

      contentHash:
        HASH,

      createdAt:
        "2026-08-22T09:00:00.000Z",

      targeting: {
        location:
          "Dubai",

        jobRole:
          "Software Engineer",
      },

      content:
        buildProfileContent(),

      assets: [
        {
          id:
            "profile.primary",

          kind:
            "profile_photo",

          sha256:
            "b".repeat(
              64
            ),

          contentType:
            "image/jpeg",

          url:
            "https://assets.example/profile.jpg",
        },
      ],
    },
  };
}


describe(
  "Profile runtime contract",
  () => {
    test(
      "repository runtime starts from canonical ProfileContent",
      () => {
        const runtime =
          createRepositoryRuntimeProfile();


        expect(
          runtime.source
        ).toBe(
          PROFILE_RUNTIME_SOURCE
            .REPOSITORY
        );


        expect(
          runtime.content
        ).toEqual(
          buildProfileContent()
        );

        expect(
          runtime
            .platformReleaseId
        ).toBeNull();


        expect(
          runtime
            .deploymentConfigurationId
        ).toBeNull();

      }
    );


    test(
      "repository runtime resolves current local Profile assets",
      () => {
        const runtime =
          createRepositoryRuntimeProfile();


        expect(
          resolveRuntimeProfileAsset(
            runtime,
            "profile.primary"
          )
        ).toBeTruthy();


        expect(
          resolveRuntimeProfileAsset(
            runtime,
            "resume.primary"
          )
        ).toContain(
          "Tejas_Resume.pdf"
        );
      }
    );


    test(
      "active runtime uses immutable Profile Variant content and URLs",
      () => {
        const runtime =
          createActiveRuntimeProfile(
            activeResponse()
          );


        expect(
          runtime.source
        ).toBe(
          PROFILE_RUNTIME_SOURCE
            .ACTIVE
        );


        expect(
          runtime.profileVariantId
        ).toBe(
          "prv_test"
        );

        expect(
          runtime
            .platformReleaseId
        ).toBe(
          "plr_test"
        );


        expect(
          runtime
            .deploymentConfigurationId
        ).toBe(
          "cfg_test"
        );

        expect(
          resolveRuntimeProfileAsset(
            runtime,
            "profile.primary"
          )
        ).toBe(
          "https://assets.example/profile.jpg"
        );
      }
    );


    test(
      "active Profile remains valid with null deployment identity before P5F establishes the first Platform pointer",
      () => {
        const response =
          activeResponse();


        response.deployment =
          null;


        const runtime =
          createActiveRuntimeProfile(
            response
          );


        expect(
          runtime
            .platformReleaseId
        ).toBeNull();


        expect(
          runtime
            .deploymentConfigurationId
        ).toBeNull();
      }
    );


    test(
      "partial Platform deployment identity fails closed",
      () => {
        const response =
          activeResponse();


        response.deployment = {
          platformReleaseId:
            "plr_test",
        };


        expect(
          () =>
            createActiveRuntimeProfile(
              response
            )
        ).toThrow(
          "deploymentConfigurationId is invalid"
        );
      }
    );


    test(
      "active runtime never silently falls back to repository assets",
      () => {
        const runtime =
          createActiveRuntimeProfile(
            activeResponse()
          );


        expect(
          resolveRuntimeProfileAsset(
            runtime,
            "resume.primary"
          )
        ).toBeNull();
      }
    );


    test(
      "pointer and variant identity disagreement fails closed",
      () => {
        const response =
          activeResponse();


        response
          .active
          .profileVariantId =
          "prv_other";


        expect(
          () =>
            createActiveRuntimeProfile(
              response
            )
        ).toThrow(
          "Variant ID does not match"
        );
      }
    );


    test(
      "unsupported content schema fails closed",
      () => {
        const response =
          activeResponse();


        response
          .variant
          .contentSchemaVersion =
          CURRENT_PROFILE_CONTENT_SCHEMA_VERSION +
          1;


        expect(
          () =>
            createActiveRuntimeProfile(
              response
            )
        ).toThrow(
          "not compatible"
        );
      }
    );
  }
);