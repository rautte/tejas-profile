// infra/cdk/lambda/historical-evidence-classification.ts


export const HISTORICAL_EVIDENCE_CLASSIFICATION_SCHEMA =
  "tejas-profile.historical-evidence-classification";


export const HISTORICAL_EVIDENCE_CLASSIFICATION_SCHEMA_ID_V1 =
  "tejas-profile.historical-evidence-classification.v1";


export const HISTORICAL_EVIDENCE_CLASSIFICATION = {
  FORMAL:
    "FORMAL",

  LEGACY_LINKED:
    "LEGACY_LINKED",

  LEGACY_UNMAPPED:
    "LEGACY_UNMAPPED",

  AMBIGUOUS:
    "AMBIGUOUS",

  INVALID:
    "INVALID",
} as const;


export const HISTORICAL_EVIDENCE_SOURCE_KIND = {
  FORMAL:
    "formal",

  LEGACY:
    "legacy",
} as const;


export const HISTORICAL_FORMAL_IDENTITY_KIND = {
  PROFILE_VARIANT:
    "profile_variant",

  PLATFORM_RELEASE:
    "platform_release",

  PLATFORM_DEPLOYMENT:
    "platform_deployment",

  DEPLOYMENT_CONFIGURATION:
    "deployment_configuration",

  USAGE_EPOCH:
    "usage_epoch",
} as const;


export const HISTORICAL_EVIDENCE_BASIS = {
  CANONICAL_FORMAL_RECORD:
    "canonical_formal_record",

  EXPLICIT_AUTHORITATIVE_LINK:
    "explicit_authoritative_link",

  NO_AUTHORITATIVE_LINK:
    "no_authoritative_link",

  MULTIPLE_AUTHORITATIVE_LINKS:
    "multiple_authoritative_links",

  INVALID_EVIDENCE:
    "invalid_evidence",
} as const;


type PlainObject =
  Record<
    string,
    any
  >;


export type HistoricalEvidenceClassification =
  typeof HISTORICAL_EVIDENCE_CLASSIFICATION[
    keyof typeof HISTORICAL_EVIDENCE_CLASSIFICATION
  ];


export type HistoricalEvidenceSourceKind =
  typeof HISTORICAL_EVIDENCE_SOURCE_KIND[
    keyof typeof HISTORICAL_EVIDENCE_SOURCE_KIND
  ];


export type HistoricalFormalIdentityKind =
  typeof HISTORICAL_FORMAL_IDENTITY_KIND[
    keyof typeof HISTORICAL_FORMAL_IDENTITY_KIND
  ];


export type HistoricalEvidenceBasis =
  typeof HISTORICAL_EVIDENCE_BASIS[
    keyof typeof HISTORICAL_EVIDENCE_BASIS
  ];


export type HistoricalFormalIdentity = {
  kind:
    HistoricalFormalIdentityKind;

  id:
    string;
};


export type HistoricalLegacyEvidence = {
  profileVersionId?:
    string;

  gitSha?:
    string;

  gitRef?:
    string;

  repository?:
    string;

  checkpointTag?:
    string;

  githubRunId?:
    string;

  buildTime?:
    string;

  createdAt?:
    string;

  deployedAt?:
    string;

  source?:
    string;

  snapshotKey?:
    string;

  sourceSnapshotKey?:
    string;

  repoArtifactKey?:
    string;

  repoArtifactSha256?:
    string;
};


const ID_RE =
  /^[A-Za-z0-9._:-]+$/;


const LEGACY_EVIDENCE_FIELDS =
  new Set([
    "profileVersionId",
    "gitSha",
    "gitRef",
    "repository",
    "checkpointTag",
    "githubRunId",
    "buildTime",
    "createdAt",
    "deployedAt",
    "source",
    "snapshotKey",
    "sourceSnapshotKey",
    "repoArtifactKey",
    "repoArtifactSha256",
  ]);


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


function assertAllowedKeys(
  value:
    PlainObject,

  allowed:
    Set<string>,

  field:
    string
) {
  for (
    const key of
      Object.keys(
        value
      )
  ) {
    if (
      !allowed.has(
        key
      )
    ) {
      throw new Error(
        `${field}.${key} is not supported.`
      );
    }
  }
}


function normalizeSourceKind(
  value:
    unknown
): HistoricalEvidenceSourceKind {
  const normalized =
    cleanString(
      value
    );


  if (
    normalized !==
      HISTORICAL_EVIDENCE_SOURCE_KIND
        .FORMAL &&
    normalized !==
      HISTORICAL_EVIDENCE_SOURCE_KIND
        .LEGACY
  ) {
    throw new Error(
      "sourceKind must be formal or legacy."
    );
  }


  return normalized as
    HistoricalEvidenceSourceKind;
}


function normalizeFormalIdentity(
  value:
    unknown,

  field:
    string
): HistoricalFormalIdentity {
  if (
    !isPlainObject(
      value
    )
  ) {
    throw new Error(
      `${field} must be an object.`
    );
  }


  assertAllowedKeys(
    value,
    new Set([
      "kind",
      "id",
    ]),
    field
  );


  const kind =
    cleanString(
      value.kind
    );


  if (
    kind !==
      HISTORICAL_FORMAL_IDENTITY_KIND
        .PROFILE_VARIANT &&
    kind !==
      HISTORICAL_FORMAL_IDENTITY_KIND
        .PLATFORM_RELEASE &&
    kind !==
      HISTORICAL_FORMAL_IDENTITY_KIND
        .PLATFORM_DEPLOYMENT &&
    kind !==
      HISTORICAL_FORMAL_IDENTITY_KIND
        .DEPLOYMENT_CONFIGURATION &&
    kind !==
      HISTORICAL_FORMAL_IDENTITY_KIND
        .USAGE_EPOCH
  ) {
    throw new Error(
      `${field}.kind is invalid.`
    );
  }


  const id =
    cleanString(
      value.id
    );


  if (
    !id ||
    id.length >
      200 ||
    !ID_RE.test(
      id
    )
  ) {
    throw new Error(
      `${field}.id is invalid.`
    );
  }


  return {
    kind:
      kind as
        HistoricalFormalIdentityKind,

    id,
  };
}


function normalizeFormalIdentityList(
  value:
    unknown
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return [];
  }


  if (
    !Array.isArray(
      value
    )
  ) {
    throw new Error(
      "authoritativeFormalLinks must be an array."
    );
  }


  const byIdentity =
    new Map<
      string,
      HistoricalFormalIdentity
    >();


  value.forEach(
    (
      candidate,
      index
    ) => {
      const normalized =
        normalizeFormalIdentity(
          candidate,
          `authoritativeFormalLinks[${index}]`
        );


      const key =
        `${normalized.kind}\n${normalized.id}`;


      byIdentity.set(
        key,
        normalized
      );
    }
  );


  return [
    ...byIdentity.values(),
  ].sort(
    (
      a,
      b
    ) => {
      const kindCompare =
        a.kind.localeCompare(
          b.kind
        );


      if (
        kindCompare !==
        0
      ) {
        return kindCompare;
      }


      return a.id.localeCompare(
        b.id
      );
    }
  );
}


function normalizeLegacyEvidence(
  value:
    unknown
): HistoricalLegacyEvidence {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return {};
  }


  if (
    !isPlainObject(
      value
    )
  ) {
    throw new Error(
      "legacyEvidence must be an object."
    );
  }


  /**
   * Deliberately strict.
   *
   * Formal identities are NOT allowed inside legacyEvidence.
   *
   * In particular, fields such as:
   * - profileVariantId
   * - platformReleaseId
   * - deploymentConfigurationId
   * - usageEpochId
   *
   * are intentionally unsupported here.
   *
   * A legacy record may reference formal truth only through
   * authoritativeFormalLinks.
   */
  assertAllowedKeys(
    value,
    LEGACY_EVIDENCE_FIELDS,
    "legacyEvidence"
  );


  const normalized:
    HistoricalLegacyEvidence =
    {};


  for (
    const field of
      LEGACY_EVIDENCE_FIELDS
  ) {
    const clean =
      cleanString(
        value[field]
      );


    if (
      clean
    ) {
      (
        normalized as
          Record<
            string,
            string
          >
      )[field] =
        clean;
    }
  }


  return normalized;
}


function normalizeInvalidReasons(
  value:
    unknown
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return [];
  }


  if (
    !Array.isArray(
      value
    )
  ) {
    throw new Error(
      "invalidReasons must be an array."
    );
  }


  const reasons =
    value.map(
      (
        reason,
        index
      ) => {
        if (
          typeof reason !==
            "string"
        ) {
          throw new Error(
            `invalidReasons[${index}] must be a string.`
          );
        }


        const normalized =
          cleanString(
            reason
          );


        if (
          !normalized
        ) {
          throw new Error(
            `invalidReasons[${index}] must not be empty.`
          );
        }


        if (
          normalized.length >
            500
        ) {
          throw new Error(
            `invalidReasons[${index}] is too long.`
          );
        }


        return normalized;
      }
    );


  return [
    ...new Set(
      reasons
    ),
  ];
}


function classificationDocument({
  classification,
  basis,
  sourceKind,
  formalIdentity,
  candidateFormalIdentities,
  legacyEvidence,
  invalidReasons,
}: {
  classification:
    HistoricalEvidenceClassification;

  basis:
    HistoricalEvidenceBasis;

  sourceKind:
    HistoricalEvidenceSourceKind;

  formalIdentity:
    HistoricalFormalIdentity |
    null;

  candidateFormalIdentities:
    HistoricalFormalIdentity[];

  legacyEvidence:
    HistoricalLegacyEvidence;

  invalidReasons:
    string[];
}) {
  return {
    schema:
      HISTORICAL_EVIDENCE_CLASSIFICATION_SCHEMA,

    schemaId:
      HISTORICAL_EVIDENCE_CLASSIFICATION_SCHEMA_ID_V1,

    classification,

    basis,

    sourceKind,

    formalIdentity,

    candidateFormalIdentities,

    legacyEvidence,

    invalidReasons,
  };
}


/**
 * Classify already-observed historical evidence.
 *
 * This function deliberately performs NO matching and NO inference.
 *
 * It never:
 * - derives Profile Variant identity from Git/profileVersion
 * - derives Platform Release identity from Git/profileVersion
 * - recomputes a Deployment Configuration from legacy evidence
 * - manufactures a Usage Epoch from timestamps or configuration
 *
 * A caller may provide a formal link only when some external,
 * authoritative record has already established that link.
 */
export function classifyHistoricalEvidence(
  input:
    unknown
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "Historical evidence classification input must be an object."
    );
  }


  assertAllowedKeys(
    input,
    new Set([
      "sourceKind",
      "formalIdentity",
      "authoritativeFormalLinks",
      "legacyEvidence",
      "invalidReasons",
    ]),
    "Historical evidence classification input"
  );


  const sourceKind =
    normalizeSourceKind(
      input.sourceKind
    );


  const legacyEvidence =
    normalizeLegacyEvidence(
      input.legacyEvidence
    );


  const invalidReasons =
    normalizeInvalidReasons(
      input.invalidReasons
    );


  const authoritativeFormalLinks =
    normalizeFormalIdentityList(
      input.authoritativeFormalLinks
    );


  if (
    sourceKind ===
      HISTORICAL_EVIDENCE_SOURCE_KIND
        .FORMAL
  ) {
    if (
      authoritativeFormalLinks.length >
        0
    ) {
      throw new Error(
        "Formal source records must use formalIdentity, not authoritativeFormalLinks."
      );
    }


    if (
      input.formalIdentity ===
        undefined ||
      input.formalIdentity ===
        null
    ) {
      const reasons = [
        ...invalidReasons,
      ];


      if (
        !reasons.includes(
          "Formal source record is missing canonical formalIdentity."
        )
      ) {
        reasons.push(
          "Formal source record is missing canonical formalIdentity."
        );
      }


      return classificationDocument({
        classification:
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .INVALID,

        basis:
          HISTORICAL_EVIDENCE_BASIS
            .INVALID_EVIDENCE,

        sourceKind,

        formalIdentity:
          null,

        candidateFormalIdentities:
          [],

        legacyEvidence,

        invalidReasons:
          reasons,
      });
    }


    const formalIdentity =
      normalizeFormalIdentity(
        input.formalIdentity,
        "formalIdentity"
      );


    if (
      invalidReasons.length >
        0
    ) {
      return classificationDocument({
        classification:
          HISTORICAL_EVIDENCE_CLASSIFICATION
            .INVALID,

        basis:
          HISTORICAL_EVIDENCE_BASIS
            .INVALID_EVIDENCE,

        sourceKind,

        formalIdentity:
          null,

        candidateFormalIdentities: [
          formalIdentity,
        ],

        legacyEvidence,

        invalidReasons,
      });
    }


    return classificationDocument({
      classification:
        HISTORICAL_EVIDENCE_CLASSIFICATION
          .FORMAL,

      basis:
        HISTORICAL_EVIDENCE_BASIS
          .CANONICAL_FORMAL_RECORD,

      sourceKind,

      formalIdentity,

      candidateFormalIdentities: [
        formalIdentity,
      ],

      legacyEvidence,

      invalidReasons:
        [],
    });
  }


  /**
   * Legacy evidence is not allowed to assert a canonical identity
   * directly. That would make it too easy for callers to convert an
   * inferred Git/profileVersion match into purported formal truth.
   */
  if (
    input.formalIdentity !==
      undefined &&
    input.formalIdentity !==
      null
  ) {
    throw new Error(
      "Legacy source records cannot assert formalIdentity directly; use authoritativeFormalLinks only for explicitly proven links."
    );
  }


  if (
    invalidReasons.length >
      0
  ) {
    return classificationDocument({
      classification:
        HISTORICAL_EVIDENCE_CLASSIFICATION
          .INVALID,

      basis:
        HISTORICAL_EVIDENCE_BASIS
          .INVALID_EVIDENCE,

      sourceKind,

      formalIdentity:
        null,

      candidateFormalIdentities:
        authoritativeFormalLinks,

      legacyEvidence,

      invalidReasons,
    });
  }


  if (
    authoritativeFormalLinks.length ===
      0
  ) {
    return classificationDocument({
      classification:
        HISTORICAL_EVIDENCE_CLASSIFICATION
          .LEGACY_UNMAPPED,

      basis:
        HISTORICAL_EVIDENCE_BASIS
          .NO_AUTHORITATIVE_LINK,

      sourceKind,

      formalIdentity:
        null,

      candidateFormalIdentities:
        [],

      legacyEvidence,

      invalidReasons:
        [],
    });
  }


  const formalIdsByKind =
    new Map<
      HistoricalFormalIdentityKind,
      Set<string>
    >();


  for (
    const link of
      authoritativeFormalLinks
  ) {
    const ids =
      formalIdsByKind.get(
        link.kind
      ) ||
      new Set<string>();


    ids.add(
      link.id
    );


    formalIdsByKind.set(
      link.kind,
      ids
    );
  }


  const hasConflictingFormalKind =
    [
      ...formalIdsByKind.values(),
    ].some(
      (
        ids
      ) =>
        ids.size >
        1
    );


  /**
   * Ambiguity exists only when the same formal identity kind has
   * more than one authoritative candidate.
   *
   * Example:
   *
   *   platform_release -> plr_a
   *   platform_release -> plr_b
   *
   * is ambiguous.
   *
   * But:
   *
   *   platform_release    -> plr_a
   *   platform_deployment -> pdep_a
   *
   * is not ambiguous. Those are two compatible formal facts about
   * the same legacy record.
   */
  if (
    hasConflictingFormalKind
  ) {
    return classificationDocument({
      classification:
        HISTORICAL_EVIDENCE_CLASSIFICATION
          .AMBIGUOUS,

      basis:
        HISTORICAL_EVIDENCE_BASIS
          .MULTIPLE_AUTHORITATIVE_LINKS,

      sourceKind,

      formalIdentity:
        null,

      candidateFormalIdentities:
        authoritativeFormalLinks,

      legacyEvidence,

      invalidReasons:
        [],
    });
  }


  return classificationDocument({
    classification:
      HISTORICAL_EVIDENCE_CLASSIFICATION
        .LEGACY_LINKED,

    basis:
      HISTORICAL_EVIDENCE_BASIS
        .EXPLICIT_AUTHORITATIVE_LINK,

    sourceKind,

    /**
     * Only expose singular formalIdentity when exactly one formal
     * object is linked.
     *
     * Multiple compatible formal kinds remain explicit in
     * candidateFormalIdentities without pretending that one of them
     * is the canonical identity for the entire legacy record.
     */
    formalIdentity:
      authoritativeFormalLinks.length ===
        1
        ? authoritativeFormalLinks[0]
        : null,

    candidateFormalIdentities:
      authoritativeFormalLinks,

    legacyEvidence,

    invalidReasons:
      [],
  });
}