// infra/cdk/lambda/configuration-analytics-report-store.ts

import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  base64Sha256ToHex,
  canonicalJsonStringify,
  hexSha256ToBase64,
  sha256Hex,
} from "./profile-variants-contract";

import {
  createConfigurationAnalyticsReportObjectKey,
  normalizeAndValidateConfigurationAnalyticsReportDocument,
} from "./configuration-analytics-report-contract";


type S3Sender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


export class ConfigurationAnalyticsReportConflictError
  extends Error {
  readonly code =
    "CONFIGURATION_ANALYTICS_REPORT_CONFLICT";


  constructor(
    message =
      "Configuration Analytics Report immutable write conflict."
  ) {
    super(
      message
    );

    this.name =
      "ConfigurationAnalyticsReportConflictError";
  }
}


function requireBucketName(
  value:
    unknown
) {
  const normalized =
    String(
      value ?? ""
    ).trim();


  if (!normalized) {
    throw new Error(
      "Configuration Analytics Reports bucket name is required."
    );
  }


  return normalized;
}


/**
 * S3 cannot tell a caller "this key doesn't exist" (404) from "you're
 * not allowed to know" (403) unless the caller also holds
 * s3:ListBucket -- and AWS's internal check for that disambiguation
 * evaluates s3:ListBucket without an s3:prefix context, so even a
 * correctly prefix-scoped ListBucket grant would never satisfy it
 * (confirmed empirically via iam:SimulatePrincipalPolicy while
 * diagnosing the identical failure mode in snapshots-handler.ts).
 * This bucket is deliberately GetObject/PutObject-only with no
 * ListBucket grant, so a missing report object always surfaces as
 * AccessDenied, never NoSuchKey.
 *
 * Safe to fold into isNotFound() here (unlike the shared
 * isS3NotFound() in snapshots-handler.ts) because this is the only
 * GetObject call site in this file, and s3:GetObject is verifiably
 * granted for the exact key pattern used.
 */
function isNotFound(
  error:
    any
) {
  return (
    error?.name ===
      "NoSuchKey" ||
    error?.name ===
      "NotFound" ||
    error?.$metadata
      ?.httpStatusCode ===
      404 ||
    (
      error?.name ===
        "AccessDenied" &&
      error?.$metadata
        ?.httpStatusCode ===
        403
    )
  );
}


function isPreconditionFailed(
  error:
    any
) {
  return (
    error?.name ===
      "PreconditionFailed" ||
    error?.$metadata
      ?.httpStatusCode ===
      412
  );
}


async function bodyToString(
  body:
    any
) {
  if (
    typeof body ===
      "string"
  ) {
    return body;
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
        "utf8"
      );
  }


  if (
    body &&
    typeof body
      .transformToString ===
      "function"
  ) {
    return await body
      .transformToString();
  }


  if (
    body &&
    typeof body[
      Symbol.asyncIterator
    ] ===
      "function"
  ) {
    const chunks:
      Buffer[] =
        [];


    for await (
      const chunk of
        body
    ) {
      chunks.push(
        Buffer.isBuffer(
          chunk
        )
          ? chunk
          : Buffer.from(
              chunk
            )
      );
    }


    return Buffer
      .concat(
        chunks
      )
      .toString(
        "utf8"
      );
  }


  throw new Error(
    "Configuration Analytics Report object body is unreadable."
  );
}


export async function readConfigurationAnalyticsReport({
  client,

  bucketName,

  reportId,
}: {
  client:
    S3Sender;

  bucketName:
    string;

  reportId:
    string;
}) {
  const bucket =
    requireBucketName(
      bucketName
    );

  const key =
    createConfigurationAnalyticsReportObjectKey(
      reportId
    );


  let out:
    any;


  try {
    out =
      await client.send(
        new GetObjectCommand({
          Bucket:
            bucket,

          Key:
            key,

          ChecksumMode:
            "ENABLED",
        })
      );
  } catch (
    error:
      any
  ) {
    if (
      isNotFound(
        error
      )
    ) {
      return null;
    }


    throw error;
  }


  const rawBody =
    await bodyToString(
      out.Body
    );


  let parsed:
    any;


  try {
    parsed =
      JSON.parse(
        rawBody
      );
  } catch {
    throw new Error(
      "Stored Configuration Analytics Report is not valid JSON."
    );
  }


  const report =
    normalizeAndValidateConfigurationAnalyticsReportDocument(
      parsed
    );


  if (
    report.reportId !==
      reportId
  ) {
    throw new Error(
      "Stored Configuration Analytics Report identity does not match object key."
    );
  }


  const canonicalBody =
    canonicalJsonStringify(
      report
    );


  if (
    rawBody !==
      canonicalBody
  ) {
    throw new Error(
      "Stored Configuration Analytics Report is not canonical JSON."
    );
  }


  const reportSha256 =
    sha256Hex(
      canonicalBody
    );


  if (
    out.ChecksumSHA256
  ) {
    const storedChecksum =
      base64Sha256ToHex(
        String(
          out.ChecksumSHA256
        )
      );


    if (
      storedChecksum !==
        reportSha256
    ) {
      throw new Error(
        "Stored Configuration Analytics Report checksum does not match its body."
      );
    }
  }


  return {
    key,

    body:
      canonicalBody,

    report,

    reportSha256,
  };
}


export async function writeImmutableConfigurationAnalyticsReport({
  client,

  bucketName,

  report:
    inputReport,
}: {
  client:
    S3Sender;

  bucketName:
    string;

  report:
    unknown;
}) {
  const bucket =
    requireBucketName(
      bucketName
    );

  const report =
    normalizeAndValidateConfigurationAnalyticsReportDocument(
      inputReport
    );

  const key =
    createConfigurationAnalyticsReportObjectKey(
      report.reportId
    );

  const body =
    canonicalJsonStringify(
      report
    );

  const reportSha256 =
    sha256Hex(
      body
    );

  const checksum =
    hexSha256ToBase64(
      reportSha256
    );


  const existing =
    await readConfigurationAnalyticsReport({
      client,

      bucketName:
        bucket,

      reportId:
        report.reportId,
    });


  if (
    existing
  ) {
    if (
      existing.body ===
        body &&
      existing.reportSha256 ===
        reportSha256
    ) {
      return {
        alreadyExists:
          true,

        key,

        report,

        reportSha256,
      };
    }


    throw new ConfigurationAnalyticsReportConflictError(
      `Configuration Analytics Report "${report.reportId}" already exists with different immutable content.`
    );
  }


  try {
    await client.send(
      new PutObjectCommand({
        Bucket:
          bucket,

        Key:
          key,

        Body:
          body,

        ContentType:
          "application/json",

        ChecksumSHA256:
          checksum,

        IfNoneMatch:
          "*",
      })
    );


    return {
      alreadyExists:
        false,

      key,

      report,

      reportSha256,
    };
  } catch (
    error:
      any
  ) {
    if (
      !isPreconditionFailed(
        error
      )
    ) {
      throw error;
    }
  }


  /**
   * Another worker may have won the create race after our initial
   * read but before PutObject.
   *
   * Re-read the winner. Identical canonical content is an
   * idempotent success. Different content is an immutable conflict.
   */
  const winner =
    await readConfigurationAnalyticsReport({
      client,

      bucketName:
        bucket,

      reportId:
        report.reportId,
    });


  if (
    winner &&
    winner.body ===
      body &&
    winner.reportSha256 ===
      reportSha256
  ) {
    return {
      alreadyExists:
        true,

      key,

      report,

      reportSha256,
    };
  }


  throw new ConfigurationAnalyticsReportConflictError(
    `Configuration Analytics Report "${report.reportId}" lost an immutable create race to different content.`
  );
}