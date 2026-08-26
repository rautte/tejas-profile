// infra/cdk/lambda/legacy-history-read-model.ts


import {
  HISTORICAL_EVIDENCE_SOURCE_KIND,
  HISTORICAL_FORMAL_IDENTITY_KIND,
  classifyHistoricalEvidence,
} from "./historical-evidence-classification";


type PlainObject =
  Record<
    string,
    any
  >;


function cleanString(
  value:
    unknown
) {
  return String(
    value ??
      ""
  ).trim();
}


function isPlainObject(
  value:
    unknown
): value is PlainObject {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return false;
  }


  const proto =
    Object.getPrototypeOf(
      value
    );


  return (
    proto ===
      Object.prototype ||
    proto ===
      null
  );
}


function compactLegacyEvidence(
  input:
    PlainObject
) {
  const result:
    PlainObject =
    {};


  for (
    const [
      key,
      value,
    ] of
      Object.entries(
        input
      )
  ) {
    const normalized =
      cleanString(
        value
      );


    if (
      normalized
    ) {
      result[key] =
        normalized;
    }
  }


  return result;
}


/**
 * Snapshot history remains legacy evidence.
 *
 * Historical Snapshot records without explicit formal links remain
 * LEGACY_UNMAPPED.
 *
 * P9E-era Snapshot records may carry explicit Platform Release and
 * Platform Deployment IDs persisted by the successful control-plane
 * workflow that created the Snapshot.
 *
 * Those stored IDs may be treated as authoritative links.
 *
 * Git SHA / profileVersionId are still never converted into Profile
 * Variant, Platform Release, Deployment Configuration, Platform
 * Deployment or Usage Epoch identities.
 */
export function buildLegacySnapshotHistoricalTruth({
  snapshotKey,
  createdAt,
  meta,
}: {
  snapshotKey:
    unknown;

  createdAt?:
    unknown;

  meta?:
    unknown;
}) {
  const normalizedMeta =
    isPlainObject(
      meta
    )
      ? meta
      : {};

  const authoritativeFormalLinks:
    Array<{
      kind:
        typeof HISTORICAL_FORMAL_IDENTITY_KIND[
          keyof typeof HISTORICAL_FORMAL_IDENTITY_KIND
        ];

      id:
        string;
    }> =
    [];


  const platformReleaseId =
    cleanString(
      normalizedMeta
        .platformReleaseId
    );


  if (
    platformReleaseId
  ) {
    authoritativeFormalLinks.push({
      kind:
        HISTORICAL_FORMAL_IDENTITY_KIND
          .PLATFORM_RELEASE,

      id:
        platformReleaseId,
    });
  }


  const platformDeploymentId =
    cleanString(
      normalizedMeta
        .platformDeploymentId
    );


  if (
    platformDeploymentId
  ) {
    authoritativeFormalLinks.push({
      kind:
        HISTORICAL_FORMAL_IDENTITY_KIND
          .PLATFORM_DEPLOYMENT,

      id:
        platformDeploymentId,
    });
  }


  return classifyHistoricalEvidence({
    sourceKind:
      HISTORICAL_EVIDENCE_SOURCE_KIND
        .LEGACY,

    legacyEvidence:
      compactLegacyEvidence({
        snapshotKey,

        createdAt,

        profileVersionId:
          normalizedMeta
            .profileVersionId,

        gitSha:
          normalizedMeta
            .gitSha,

        checkpointTag:
          normalizedMeta
            .checkpointTag,

        repoArtifactKey:
          normalizedMeta
            .repoArtifactKey,

        repoArtifactSha256:
          normalizedMeta
            .repoArtifactSha256,
      }),

    /**
     * Explicit stored formal links only.
     *
     * No candidate is created from legacy evidence.
     */
    authoritativeFormalLinks,
  });
}


/**
 * A deploy/history.json record is also legacy compatibility data.
 *
 * Modern records may contain explicit formal IDs written only after
 * the formal Platform Deployment commit succeeds:
 *
 * - platformReleaseId
 * - deploymentId
 *
 * Those fields are accepted as authoritative links because they are
 * explicitly stored facts.
 *
 * Missing formal fields remain LEGACY_UNMAPPED.
 *
 * Git SHA/profileVersionId are never used to manufacture links.
 */
export function buildLegacyDeployHistoryRecordHistoricalTruth(
  record:
    unknown
) {
  if (
    !isPlainObject(
      record
    )
  ) {
    return classifyHistoricalEvidence({
      sourceKind:
        HISTORICAL_EVIDENCE_SOURCE_KIND
          .LEGACY,

      invalidReasons: [
        "Legacy deploy-history record is not an object.",
      ],
    });
  }


  const authoritativeFormalLinks:
    Array<{
      kind:
        typeof HISTORICAL_FORMAL_IDENTITY_KIND[
          keyof typeof HISTORICAL_FORMAL_IDENTITY_KIND
        ];

      id:
        string;
    }> =
    [];


  const platformReleaseId =
    cleanString(
      record
        .platformReleaseId
    );


  if (
    platformReleaseId
  ) {
    authoritativeFormalLinks.push({
      kind:
        HISTORICAL_FORMAL_IDENTITY_KIND
          .PLATFORM_RELEASE,

      id:
        platformReleaseId,
    });
  }


  const deploymentId =
    cleanString(
      record
        .deploymentId
    );


  if (
    deploymentId
  ) {
    authoritativeFormalLinks.push({
      kind:
        HISTORICAL_FORMAL_IDENTITY_KIND
          .PLATFORM_DEPLOYMENT,

      id:
        deploymentId,
    });
  }


  return classifyHistoricalEvidence({
    sourceKind:
      HISTORICAL_EVIDENCE_SOURCE_KIND
        .LEGACY,

    legacyEvidence:
      compactLegacyEvidence({
        profileVersionId:
          record
            .profileVersionId,

        gitSha:
          record
            .gitSha,

        deployedAt:
          record
            .deployedAt,

        source:
          record
            .source,
      }),

    authoritativeFormalLinks,
  });
}


function enrichLegacyDeployHistoryRecord(
  record:
    unknown
) {
  if (
    !isPlainObject(
      record
    )
  ) {
    return record;
  }


  return {
    ...record,

    historicalTruth:
      buildLegacyDeployHistoryRecordHistoricalTruth(
        record
      ),
  };
}


/**
 * Build a read-only model over deploy/history.json.
 *
 * The stored S3 object is never modified.
 *
 * Existing fields are preserved byte-for-byte at the JSON-value
 * level; historicalTruth is additive read metadata only.
 */
export function enrichLegacyDeployHistory(
  history:
    unknown
) {
  if (
    history ===
      null ||
    history ===
      undefined
  ) {
    return null;
  }


  if (
    !isPlainObject(
      history
    )
  ) {
    return history;
  }


  const result:
    PlainObject = {
      ...history,
    };


  if (
    isPlainObject(
      history.active
    )
  ) {
    result.active =
      enrichLegacyDeployHistoryRecord(
        history.active
      );
  }


  if (
    isPlainObject(
      history.previous
    )
  ) {
    result.previous =
      enrichLegacyDeployHistoryRecord(
        history.previous
      );
  }


  if (
    Array.isArray(
      history.timeline
    )
  ) {
    result.timeline =
      history.timeline.map(
        enrichLegacyDeployHistoryRecord
      );
  }


  return result;
}