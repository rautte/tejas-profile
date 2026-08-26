// infra/cdk/lambda/active-profile-handler.ts

import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";

import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

import {
  readPublicActiveProfile,
} from "./active-profile-reader";

import {
  readEffectiveDeploymentConfiguration,
} from "./effective-deployment-configuration-reader";


type Event = {
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
  };

  rawPath?: string;

  headers?:
    Record<
      string,
      string
    >;
};


const dynamodb =
  new DynamoDBClient({});

const s3 =
  new S3Client({});


const PROFILE_ACTIVATION_TABLE =
  process.env
    .PROFILE_ACTIVATION_TABLE ||
  "";

const PROFILE_VARIANTS_BUCKET =
  process.env
    .PROFILE_VARIANTS_BUCKET ||
  "";

const PLATFORM_DEPLOYMENT_TABLE =
  process.env
    .PLATFORM_DEPLOYMENT_TABLE ||
  "";

const PLATFORM_RELEASES_BUCKET =
  process.env
    .PLATFORM_RELEASES_BUCKET ||
  "";

const DEPLOYMENT_CONFIGURATIONS_BUCKET =
  process.env
    .DEPLOYMENT_CONFIGURATIONS_BUCKET ||
  "";

const STAGE =
  String(
    process.env
      .STAGE ||
    ""
  ).trim();

const ASSET_URL_EXPIRES_IN_SECONDS =
  Math.max(
    60,
    Math.min(
      3600,
      Number(
        process.env
          .ACTIVE_PROFILE_ASSET_URL_TTL_SECONDS ||
        3600
      ) ||
        3600
    )
  );


const ALLOWED_ORIGINS =
  (
    process.env
      .ALLOWED_ORIGINS ||
    ""
  )
    .split(
      ","
    )
    .map(
      (
        value
      ) =>
        value.trim()
    )
    .filter(
      Boolean
    );


function getHeader(
  headers:
    Record<
      string,
      string
    > |
      undefined,

  key:
    string
) {
  if (!headers) {
    return "";
  }


  const actual =
    Object.keys(
      headers
    ).find(
      (
        header
      ) =>
        header
          .toLowerCase() ===
        key.toLowerCase()
    );


  return actual
    ? headers[
        actual
      ]
    : "";
}


function pickCorsOrigin(
  headers:
    Record<
      string,
      string
    > |
      undefined
) {
  const origin =
    getHeader(
      headers,
      "origin"
    );


  if (!origin) {
    return "";
  }


  return ALLOWED_ORIGINS
    .includes(
      origin
    )
      ? origin
      : "";
}


function json(
  statusCode:
    number,

  body:
    unknown,

  corsOrigin:
    string
) {
  const headers:
    Record<
      string,
      string
    > = {
    "content-type":
      "application/json",

    "cache-control":
      "no-store, max-age=0",

    pragma:
      "no-cache",

    vary:
      "Origin",

    "x-content-type-options":
      "nosniff",
  };


  if (corsOrigin) {
    headers[
      "access-control-allow-origin"
    ] =
      corsOrigin;
  }


  return {
    statusCode,

    headers,

    body:
      JSON.stringify(
        body
      ),
  };
}


export async function handler(
  event:
    Event
) {
  const path =
    event.rawPath ||
    event
      .requestContext
      ?.http
      ?.path ||
    "";

  const method =
    (
      event
        .requestContext
        ?.http
        ?.method ||
      ""
    )
      .toUpperCase();


  const corsOrigin =
    pickCorsOrigin(
      event.headers
    );

  const origin =
    getHeader(
      event.headers,
      "origin"
    );


  if (
    origin &&
    !corsOrigin
  ) {
    return json(
      403,
      {
        ok:
          false,

        error:
          "CORS origin not allowed",
      },
      ""
    );
  }


  if (
    method !==
      "GET" ||
    !path.endsWith(
      "/profile/active"
    )
  ) {
    return json(
      404,
      {
        ok:
          false,

        error:
          "Not found",
      },
      corsOrigin
    );
  }


  if (
    !PROFILE_ACTIVATION_TABLE ||
    !PROFILE_VARIANTS_BUCKET ||
    !PLATFORM_DEPLOYMENT_TABLE ||
    !PLATFORM_RELEASES_BUCKET ||
    !DEPLOYMENT_CONFIGURATIONS_BUCKET ||
    (
      STAGE !==
        "dev" &&
      STAGE !==
        "prod"
    )
  ) {
    return json(
      500,
      {
        ok:
          false,

        error:
          "Active runtime storage is not configured.",
      },
      corsOrigin
    );
  }


  try {
    const result =
      await readPublicActiveProfile({
        activationClient:
          dynamodb,

        s3Client:
          s3,

        activationTableName:
          PROFILE_ACTIVATION_TABLE,

        profileVariantsBucket:
          PROFILE_VARIANTS_BUCKET,

        presignAssetUrl:
          async ({
            objectKey,
          }) =>
            getSignedUrl(
              s3,

              new GetObjectCommand({
                Bucket:
                  PROFILE_VARIANTS_BUCKET,

                Key:
                  objectKey,

                ResponseCacheControl:
                  "public,max-age=3600,immutable",
              }),

              {
                expiresIn:
                  ASSET_URL_EXPIRES_IN_SECONDS,
              }
            ),
      });


    /**
     * No activation is a valid empty/bootstrap state.
     *
     * The public API returns that state explicitly. It must not
     * manufacture a Profile Variant or formal deployment identity.
     */
    if (!result) {
      return json(
        200,
        {
          ok:
            true,

          active:
            null,

          variant:
            null,

          deployment:
            null,
        },
        corsOrigin
      );
    }


    const effectiveDeployment =
      await readEffectiveDeploymentConfiguration({
        platformDeploymentClient:
          dynamodb,

        s3Client:
          s3,

        platformDeploymentTableName:
          PLATFORM_DEPLOYMENT_TABLE,

        platformReleasesBucket:
          PLATFORM_RELEASES_BUCKET,

        deploymentConfigurationsBucket:
          DEPLOYMENT_CONFIGURATIONS_BUCKET,

        stage:
          STAGE,

        /**
         * IMPORTANT:
         *
         * This is the exact strongly-consistent Profile pointer
         * already used to resolve the public Profile Variant.
         *
         * Do not independently re-read Profile activation state.
         */
        activeProfilePointer:
          result.active,
      });


    return json(
      200,
      {
        ok:
          true,

        ...result,

        /**
         * Public runtime identity deliberately exposes only the
         * formal software/configuration identities.
         *
         * Git/build/repository provenance stays control-plane only.
         */
        deployment:
          effectiveDeployment
            ? {
                platformReleaseId:
                  effectiveDeployment
                    .platformReleaseId,

                deploymentConfigurationId:
                  effectiveDeployment
                    .deploymentConfigurationId,
              }
            : null,
      },
      corsOrigin
    );
  } catch (
    error: any
  ) {
    console.error(
      "Public active Profile read failed",
      {
        error:
          String(
            error?.message ||
            error
          ),
      }
    );


    return json(
      500,
      {
        ok:
          false,

        error:
          "Failed to read active Profile.",
      },
      corsOrigin
    );
  }
}