// src/components/admin/LegacyHistoricalTruth.js


import {
  Badge,
  MetadataRow,
} from "./controlPlaneCatalogUi";


const LEGACY_CLASSIFICATION =
  Object.freeze({
    LINKED:
      "LEGACY_LINKED",

    UNMAPPED:
      "LEGACY_UNMAPPED",

    AMBIGUOUS:
      "AMBIGUOUS",

    INVALID:
      "INVALID",
  });


const FORMAL_KIND_PRESENTATION =
  Object.freeze({
    profile_variant: {
      label:
        "Profile Variant",
    },

    platform_release: {
      label:
        "Platform Release",
    },

    platform_deployment: {
      label:
        "Platform Deployment",
    },

    deployment_configuration: {
      label:
        "Deployment Configuration",
    },

    usage_epoch: {
      label:
        "Usage Epoch",
    },
  });


function cleanString(
  value
) {
  return String(
    value ??
      ""
  ).trim();
}


function isPlainObject(
  value
) {
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


function invalidPresentation(
  reason
) {
  return {
    classification:
      LEGACY_CLASSIFICATION
        .INVALID,

    label:
      "Legacy · Invalid",

    tone:
      "danger",

    formalLinks:
      [],

    invalidReasons:
      reason
        ? [
            reason,
          ]
        : [],
  };
}


function normalizeFormalLinks(
  value
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }


  const links =
    [];


  const seen =
    new Set();


  for (
    const candidate of
      value
  ) {
    if (
      !isPlainObject(
        candidate
      )
    ) {
      continue;
    }


    const kind =
      cleanString(
        candidate.kind
      );


    const id =
      cleanString(
        candidate.id
      );


    const presentation =
      FORMAL_KIND_PRESENTATION[
        kind
      ];


    if (
      !presentation ||
      !id
    ) {
      continue;
    }


    const key =
      `${kind}\n${id}`;


    if (
      seen.has(
        key
      )
    ) {
      continue;
    }


    seen.add(
      key
    );


    links.push({
      kind,

      id,

      label:
        presentation.label,
    });
  }


  return links;
}


/**
 * Presentation-only adapter for P9B/P9C historical truth.
 *
 * IMPORTANT:
 *
 * This function does not derive or repair historical identity.
 *
 * It only renders the classification supplied by the backend.
 *
 * Missing/malformed information fails closed visually instead of
 * being converted into formal history.
 */
export function buildLegacyHistoricalTruthPresentation(
  historicalTruth
) {
  if (
    !isPlainObject(
      historicalTruth
    )
  ) {
    return {
      classification:
        null,

      label:
        "Legacy · Unclassified",

      tone:
        "danger",

      formalLinks:
        [],

      invalidReasons: [
        "Historical truth classification is unavailable.",
      ],
    };
  }


  const sourceKind =
    cleanString(
      historicalTruth
        .sourceKind
    );


  if (
    sourceKind !==
      "legacy"
  ) {
    return invalidPresentation(
      "Legacy history received a non-legacy truth classification."
    );
  }


  const classification =
    cleanString(
      historicalTruth
        .classification
    );


  const formalLinks =
    normalizeFormalLinks(
      historicalTruth
        .candidateFormalIdentities
    );


  const invalidReasons =
    Array.isArray(
      historicalTruth
        .invalidReasons
    )
      ? historicalTruth
          .invalidReasons
          .map(
            cleanString
          )
          .filter(
            Boolean
          )
      : [];


  if (
    classification ===
      LEGACY_CLASSIFICATION
        .UNMAPPED
  ) {
    /**
     * An unmapped legacy record must not simultaneously advertise
     * canonical formal candidates.
     */
    if (
      formalLinks.length >
        0
    ) {
      return invalidPresentation(
        "LEGACY_UNMAPPED history unexpectedly contains formal links."
      );
    }


    return {
      classification,

      label:
        "Legacy · Unmapped",

      tone:
        "warning",

      formalLinks:
        [],

      invalidReasons:
        [],
    };
  }


  if (
    classification ===
      LEGACY_CLASSIFICATION
        .LINKED
  ) {
    /**
     * A linked record without a formal candidate is malformed.
     *
     * Never manufacture one client-side.
     */
    if (
      formalLinks.length ===
        0
    ) {
      return invalidPresentation(
        "LEGACY_LINKED history is missing its authoritative formal link."
      );
    }


    return {
      classification,

      label:
        "Legacy · Linked",

      tone:
        "purple",

      formalLinks,

      invalidReasons:
        [],
    };
  }


  if (
    classification ===
      LEGACY_CLASSIFICATION
        .AMBIGUOUS
  ) {
    if (
      formalLinks.length <
        2
    ) {
      return invalidPresentation(
        "AMBIGUOUS history does not contain multiple formal candidates."
      );
    }


    return {
      classification,

      label:
        "Legacy · Ambiguous",

      tone:
        "warning",

      formalLinks,

      invalidReasons:
        [],
    };
  }


  if (
    classification ===
      LEGACY_CLASSIFICATION
        .INVALID
  ) {
    return {
      classification,

      label:
        "Legacy · Invalid",

      tone:
        "danger",

      formalLinks,

      invalidReasons,
    };
  }


  /**
   * FORMAL is deliberately not accepted here.
   *
   * This component renders the legacy compatibility archive.
   * Canonical FORMAL history belongs in the immutable catalogs above.
   */
  return invalidPresentation(
    classification ===
      "FORMAL"
      ? "Canonical FORMAL history cannot be rendered as legacy Snapshot history."
      : "Historical truth classification is unsupported."
  );
}


export function HistoricalTruthBadge({
  historicalTruth,
}) {
  const presentation =
    buildLegacyHistoricalTruthPresentation(
      historicalTruth
    );


  return (
    <Badge
      tone={
        presentation.tone
      }
    >
      {
        presentation.label
      }
    </Badge>
  );
}


function FormalLinks({
  links,
}) {
  if (
    !links.length
  ) {
    return (
      <MetadataRow
        label="Formal links"
        value="None"
      />
    );
  }


  return (
    <>
      {links.map(
        (
          link
        ) => (
          <MetadataRow
            key={
              `${link.kind}:${link.id}`
            }
            label={
              link.label
            }
            value={
              link.id
            }
            mono
          />
        )
      )}
    </>
  );
}


function LegacyDeployRecord({
  title,
  record,
}) {
  const presentation =
    buildLegacyHistoricalTruthPresentation(
      record
        ?.historicalTruth
    );


  return (
    <div
      className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 p-4 space-y-2"
      data-testid={
        `legacy-deploy-truth-${title.toLowerCase()}`
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {title}
        </div>


        <HistoricalTruthBadge
          historicalTruth={
            record
              ?.historicalTruth
          }
        />
      </div>


      <MetadataRow
        label="Profile version"
        value={
          record
            ?.profileVersionId
        }
        mono
      />


      <MetadataRow
        label="Git SHA"
        value={
          record
            ?.gitSha
        }
        mono
      />


      <MetadataRow
        label="Deployed at"
        value={
          record
            ?.deployedAt
        }
      />


      <FormalLinks
        links={
          presentation
            .formalLinks
        }
      />


      {presentation
        .invalidReasons
        .length ? (
        <div className="pt-1 space-y-1">
          {presentation
            .invalidReasons
            .map(
              (
                reason,
                index
              ) => (
                <div
                  key={
                    `${reason}:${index}`
                  }
                  className="text-[11px] text-red-700 dark:text-red-300"
                >
                  {reason}
                </div>
              )
            )}
        </div>
      ) : null}
    </div>
  );
}


/**
 * Read-only presentation of legacy deploy/history.json compatibility
 * records.
 *
 * The formal Platform Deployment ledger remains authoritative.
 */
export function LegacyDeployHistoryTruthPanel({
  history,
}) {
  const active =
    isPlainObject(
      history?.active
    )
      ? history.active
      : null;


  const previous =
    isPlainObject(
      history?.previous
    )
      ? history.previous
      : null;


  if (
    !active &&
    !previous
  ) {
    return null;
  }


  return (
    <div
      className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 p-5"
      data-testid="legacy-deploy-history-truth-panel"
    >
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Legacy deploy-history truth
      </div>


      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-3xl">
        Compatibility history only. Explicit formal IDs are shown as authoritative links when present.
        Git SHA and Profile Version are never converted into formal identities. The immutable Platform
        Deployment ledger above remains authoritative occurrence history.
      </p>


      <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
        {active ? (
          <LegacyDeployRecord
            title="Active"
            record={
              active
            }
          />
        ) : null}


        {previous ? (
          <LegacyDeployRecord
            title="Previous"
            record={
              previous
            }
          />
        ) : null}
      </div>
    </div>
  );
}