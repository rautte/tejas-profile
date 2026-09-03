// src/components/admin/data-editor/PublishReviewPanel.js

import {
  useMemo,
  useState,
} from "react";

import {
  diffProfileContentValues,
  formatDiffPath,
} from "../../../profile/draft";

import {
  buildProfilePublicationPackage,
  publishProfilePublication,
} from "../../../profile/publish";

import {
  suggestProfileVariantId,
} from "../../../utils/snapshots/profileVariantId";

import {
  cx,
} from "../../../utils/cx";

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../../../utils/ui";


function previewValue(
  value
) {
  if (
    value ===
      undefined
  ) {
    return "(none)";
  }

  if (
    value === null
  ) {
    return "(empty)";
  }

  if (
    typeof value ===
    "string"
  ) {
    return value ===
      ""
      ? "(empty)"
      : value;
  }

  if (
    typeof value ===
      "object"
  ) {
    const json =
      JSON.stringify(
        value
      );

    return json.length >
      160
      ? `${json.slice(
          0,
          160
        )}…`
      : json;
  }

  return String(
    value
  );
}


function readAssetBytesUnsupported() {
  throw new Error(
    "Publishing a draft requires every referenced asset to already exist in storage."
  );
}


function formatByteSize(
  bytes
) {
  const n =
    Number(
      bytes
    ) ||
    0;

  if (
    n <
    1024
  ) {
    return `${n} B`;
  }

  if (
    n <
    1024 *
      1024
  ) {
    return `${(
      n /
      1024
    ).toFixed(
      1
    )} KB`;
  }

  return `${(
    n /
    (1024 *
      1024)
  ).toFixed(
    1
  )} MB`;
}


/**
 * Combines the base variant's unchanged assets with any staged
 * uploads into the final immutable asset manifest for the new
 * variant -- a staged entry replaces its slot by assetId (bytes
 * changed, id unchanged) or is appended (a brand-new asset id).
 */
function resolveAssetUploads({
  baseAssets,
  stagedAssets,
}) {
  const staged =
    Object.values(
      stagedAssets ||
        {}
    );

  const byId =
    new Map(
      (
        baseAssets ||
        []
      ).map(
        (
          asset
        ) => [
          asset.id,
          asset,
        ]
      )
    );

  for (
    const entry of
      staged
  ) {
    byId.set(
      entry.assetId,
      {
        id:
          entry.assetId,

        kind:
          entry.kind,

        objectKey:
          entry.objectKey,

        sha256:
          entry.sha256,

        contentType:
          entry.contentType,
      }
    );
  }

  return Array.from(
    byId.values()
  );
}


/**
 * Review-then-confirm gate in front of the one irreversible step in
 * the whole draft lifecycle: minting a new immutable Profile
 * Variant. Targeting is never edited from Admin -> Data (that stays
 * Snapshots' domain). Content changes and staged asset
 * uploads/replacements are both reviewed here.
 */
export default function PublishReviewPanel({
  draft,
  baseVariant,
  stagedAssets,
  onPublished,
  onCancel,
}) {
  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");


  const changes =
    useMemo(
      () =>
        diffProfileContentValues(
          baseVariant
            ?.content ||
            {},

          draft
            ?.content ||
            {}
        ),
      [
        baseVariant,
        draft,
      ]
    );


  const stagedAssetList =
    useMemo(
      () =>
        Object.entries(
          stagedAssets ||
            {}
        ).map(
          ([
            pathKey,
            entry,
          ]) => ({
            pathKey,
            ...entry,
          })
        ),
      [
        stagedAssets,
      ]
    );

  const hasAnyChange =
    changes.length >
      0 ||
    stagedAssetList.length >
      0;


  async function handleConfirm() {
    if (
      !draft ||
      !baseVariant
    ) {
      return;
    }

    setBusy(
      true
    );

    setError(
      ""
    );

    try {
      const profileVariantId =
        suggestProfileVariantId(
          {
            location:
              draft
                .targeting
                .location,

            jobRole:
              draft
                .targeting
                .jobRole,
          }
        ) ||
        `prv_${Date.now().toString(
          36
        )}`;

      const assetUploads =
        resolveAssetUploads(
          {
            baseAssets:
              baseVariant.assets,

            stagedAssets,
          }
        );

      const stagedByAssetId =
        new Map(
          stagedAssetList.map(
            (
              entry
            ) => [
              entry.assetId,
              entry,
            ]
          )
        );

      function readStagedAssetBytes(
        asset
      ) {
        const staged =
          stagedByAssetId.get(
            asset?.id
          );

        if (
          !staged
        ) {
          return readAssetBytesUnsupported();
        }

        return staged.arrayBuffer;
      }

      const publication =
        await buildProfilePublicationPackage(
          {
            draft,

            profileVariantId,

            provenance:
              baseVariant.provenance ||
              {},

            assetUploads,

            readAssetBytes:
              readStagedAssetBytes,
          }
        );

      const result =
        await publishProfilePublication(
          {
            publication,

            readAssetBytes:
              readStagedAssetBytes,
          }
        );

      onPublished(
        result
      );
    } catch (
      err
    ) {
      setError(
        String(
          err
            ?.message ||
          err
        )
      );
    } finally {
      setBusy(
        false
      );
    }
  }


  return (
    <div
      className={cx(
        CARD_SURFACE,
        CARD_ROUNDED_2XL,
        "p-6 space-y-4"
      )}
    >
      <div>
        <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
          Review &amp; publish
        </h3>

        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-3xl">
          This mints a new immutable Profile Variant from this draft's content,
          targeting the same location/job role as{" "}
          <span className="font-mono">
            {
              baseVariant
                ?.profileVariantId
            }
          </span>
          . It does not activate it -- activate the resulting Profile Variant from Snapshots
          when you're ready to make it live.
        </p>
      </div>


      {!hasAnyChange ? (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          No content changes or staged file uploads detected.
        </div>
      ) : (
        <>
          {stagedAssetList.length >
          0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {
                  stagedAssetList.length
                }{" "}
                file
                {stagedAssetList.length ===
                1
                  ? ""
                  : "s"}{" "}
                to upload
              </div>

              <ul className="space-y-2">
                {stagedAssetList.map(
                  (
                    entry
                  ) => (
                    <li
                      key={
                        entry.pathKey
                      }
                      className="rounded-xl border border-emerald-200/70 dark:border-emerald-400/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-3 space-y-1"
                    >
                      <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                        {
                          entry.pathKey
                        }
                      </div>

                      <div className="text-xs text-emerald-700 dark:text-emerald-300 break-words">
                        {
                          entry.fileName
                        }{" "}
                        (
                        {formatByteSize(
                          entry.size
                        )}
                        )
                        {entry.wasNewlyMinted
                          ? " -- new asset"
                          : " -- replaces the current file"}
                      </div>
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : null}

          {changes.length >
          0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {
                  changes.length
                }{" "}
                field
                {changes.length ===
                1
                  ? ""
                  : "s"}{" "}
                changed
              </div>

              <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {changes.map(
                  (
                    change,
                    index
                  ) => (
                    <li
                      key={`${formatDiffPath(
                        change.path
                      )}-${index}`}
                      className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 p-3 space-y-1"
                    >
                      <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                        {formatDiffPath(
                          change.path
                        )}
                      </div>

                      <div className="text-xs text-red-700 dark:text-red-300 break-words">
                        <span className="font-semibold">
                          Before:
                        </span>{" "}
                        {previewValue(
                          change.before
                        )}
                      </div>

                      <div className="text-xs text-emerald-700 dark:text-emerald-300 break-words">
                        <span className="font-semibold">
                          After:
                        </span>{" "}
                        {previewValue(
                          change.after
                        )}
                      </div>
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : null}
        </>
      )}


      {error ? (
        <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
          {
            error
          }
        </div>
      ) : null}


      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={
            onCancel
          }
          disabled={
            busy
          }
          className={cx(
            "h-10 px-4 rounded-xl border text-xs font-semibold transition",
            "border-gray-300/70 dark:border-white/10",
            "bg-gray-50/80 dark:bg-white/10",
            "text-gray-800 dark:text-gray-100",
            "hover:bg-gray-100 dark:hover:bg-white/15",
            "disabled:opacity-60"
          )}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={
            handleConfirm
          }
          disabled={
            busy ||
            !hasAnyChange
          }
          className={cx(
            "h-10 px-4 rounded-xl border text-xs font-semibold transition",
            "border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-700",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {busy
            ? "Publishing…"
            : "Confirm & publish"}
        </button>
      </div>
    </div>
  );
}
