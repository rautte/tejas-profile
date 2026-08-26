// infra/cdk/lambda/active-profile-reader.ts

import {
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import {
  readActiveProfilePointer,
} from "./profile-activation-store";

import {
  base64Sha256ToHex,
  createProfileVariantManifestKey,
  normalizeAndValidateProfileVariantDocument,
  sha256Hex,
} from "./profile-variants-contract";


type AwsSender = {
  send:
    (
      command: any
    ) => Promise<any>;
};


async function bodyToString(
  body: any
) {
  if (!body) {
    return "";
  }


  if (
    typeof body
      .transformToString ===
      "function"
  ) {
    return body
      .transformToString(
        "utf-8"
      );
  }


  if (
    body instanceof
      Uint8Array
  ) {
    return Buffer
      .from(
        body
      )
      .toString(
        "utf-8"
      );
  }


  if (
    typeof body.on ===
      "function"
  ) {
    return new Promise<string>(
      (
        resolve,
        reject
      ) => {
        const chunks:
          any[] = [];


        body.on(
          "data",
          (
            chunk: any
          ) =>
            chunks.push(
              chunk
            )
        );

        body.on(
          "error",
          reject
        );

        body.on(
          "end",
          () =>
            resolve(
              Buffer
                .concat(
                  chunks
                )
                .toString(
                  "utf-8"
                )
            )
        );
      }
    );
  }


  throw new Error(
    "Unsupported Profile Variant response body."
  );
}


export async function readPublicActiveProfile({
  activationClient,

  s3Client,

  activationTableName,

  profileVariantsBucket,

  presignAssetUrl,
}: {
  activationClient:
    AwsSender;

  s3Client:
    AwsSender;

  activationTableName:
    string;

  profileVariantsBucket:
    string;

  presignAssetUrl:
    (
      input: {
        assetId:
          string;

        objectKey:
          string;

        contentType:
          string;
      }
    ) => Promise<string>;
}) {
  const currentPointer =
    await readActiveProfilePointer({
      client:
        activationClient,

      tableName:
        activationTableName,
    });


  /**
   * Important for the migration period:
   *
   * infrastructure may exist before the first real activation.
   * P3.4 can safely fall back to repository ProfileContent.
   */
  if (!currentPointer) {
    return null;
  }


  const manifestKey =
    createProfileVariantManifestKey(
      currentPointer
        .profileVariantId
    );


  const stored =
    await s3Client.send(
      new GetObjectCommand({
        Bucket:
          profileVariantsBucket,

        Key:
          manifestKey,

        ChecksumMode:
          "ENABLED",
      })
    );


  const manifestBody =
    await bodyToString(
      stored.Body
    );


  if (!manifestBody) {
    throw new Error(
      "Active Profile Variant manifest is empty."
    );
  }


  let parsed:
    any;


  try {
    parsed =
      JSON.parse(
        manifestBody
      );
  } catch {
    throw new Error(
      "Active Profile Variant manifest is invalid JSON."
    );
  }


  const variant =
    normalizeAndValidateProfileVariantDocument(
      parsed
    );


  const manifestSha256 =
    sha256Hex(
      manifestBody
    );


  const storedChecksum =
    base64Sha256ToHex(
      String(
        stored
          .ChecksumSHA256 ||
        ""
      )
    );


  if (
    storedChecksum &&
    storedChecksum !==
      manifestSha256
  ) {
    throw new Error(
      "Active Profile Variant manifest checksum mismatch."
    );
  }


  /**
   * The mutable ACTIVE pointer and immutable manifest must agree.
   *
   * Any disagreement means control-plane corruption/stale state.
   */
  if (
    variant
      .profileVariantId !==
    currentPointer
      .profileVariantId
  ) {
    throw new Error(
      "Active Profile Variant ID does not match active pointer."
    );
  }


  if (
    variant
      .contentHash !==
    currentPointer
      .contentHash
  ) {
    throw new Error(
      "Active Profile Variant contentHash does not match active pointer."
    );
  }


  if (
    variant
      .contentSchemaVersion !==
    currentPointer
      .contentSchemaVersion
  ) {
    throw new Error(
      "Active Profile Variant content schema does not match active pointer."
    );
  }


  /**
   * Public response deliberately does NOT expose:
   *
   * - provenance
   * - repository SHA
   * - checkpoint metadata
   * - internal S3 object keys
   * - sourcePath
   *
   * Only active recruiter-facing data is returned.
   */
  const publicAssets =
    await Promise.all(
      variant.assets.map(
        async (
          asset: any
        ) => {
          const url =
            await presignAssetUrl({
              assetId:
                asset.id,

              objectKey:
                asset.objectKey,

              contentType:
                asset.contentType,
            });


          if (!url) {
            throw new Error(
              `Failed to resolve public URL for Profile asset "${asset.id}".`
            );
          }


          return {
            id:
              asset.id,

            kind:
              asset.kind,

            sha256:
              asset.sha256,

            contentType:
              asset.contentType,

            url,
          };
        }
      )
    );


  return {
    active: {
      revision:
        currentPointer
          .revision,

      activationId:
        currentPointer
          .activationId,

      profileVariantId:
        currentPointer
          .profileVariantId,

      activatedAt:
        currentPointer
          .activatedAt,

      contentSchemaVersion:
        currentPointer
          .contentSchemaVersion,

      contentHash:
        currentPointer
          .contentHash,
    },

    manifestSha256,

    variant: {
      schemaId:
        variant
          .schemaId,

      contentSchemaVersion:
        variant
          .contentSchemaVersion,

      profileVariantId:
        variant
          .profileVariantId,

      contentHash:
        variant
          .contentHash,

      createdAt:
        variant
          .createdAt,

      targeting:
        variant
          .targeting,

      content:
        variant
          .content,

      assets:
        publicAssets,
    },
  };
}