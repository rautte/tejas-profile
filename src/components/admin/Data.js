// src/components/admin/Data.js

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FaDatabase,
} from "react-icons/fa";

import SectionHeader from "../shared/SectionHeader";

import {
  getProfileEditorMetadata,
} from "../../profile/editor/metadata";

import {
  getProfileVariant,
} from "../../utils/snapshots/snapshotsApi";

import ProfileVariantPublicationPanel from "./ProfileVariantPublicationPanel";

import {
  PROFILE_DRAFT_STATUS,
  useProfileDraftSession,
} from "../../profile/draft";

import {
  PUBLIC_SECTION_ORDER,
} from "../../data/App";

import {
  SITE_STRUCTURE_GROUP_IDS,
  resolveSiteStructure,
} from "../../data/structure";

import {
  EDITABLE_SCALAR_KINDS,
  ScalarField,
} from "./data-editor/ScalarField";

import {
  TagEditor,
} from "./data-editor/TagEditor";

import {
  ArrayItemControls,
} from "./data-editor/ArrayItemControls";

import {
  createEmptyCollectionItem,
  moveArrayIndex,
  removeArrayIndex,
} from "./data-editor/arrayUtils";

import PublishReviewPanel from "./data-editor/PublishReviewPanel";

import {
  sha256BytesHex,
} from "../../utils/profileVariant";

import {
  createContentAddressedProfileAssetObjectKey,
} from "../../profile/publish";

import {
  cx,
} from "../../utils/cx";

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../../utils/ui";


function cleanString(
  value
) {
  return String(
    value || ""
  ).trim();
}


function randomAssetIdSuffix() {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto
      .randomUUID ===
      "function"
  ) {
    return crypto
      .randomUUID()
      .replace(
        /-/g,
        ""
      )
      .slice(
        0,
        10
      );
  }

  return Math.random()
    .toString(16)
    .slice(2, 12);
}


function getByPath(
  source,
  path
) {
  if (!path) {
    return source;
  }

  return path
    .split(".")
    .reduce(
      (
        acc,
        key
      ) =>
        acc == null
          ? undefined
          : acc[
              key
            ],
      source
    );
}


/**
 * Immutable set at an arbitrary path of string keys / array
 * indices. updateProfileDraft() only merges shallowly at the
 * top-level content section, so editing a nested field requires
 * reconstructing the whole section value with every sibling
 * preserved — this does that, one level at a time.
 */
function setDeepValue(
  source,
  path,
  value
) {
  if (
    path.length ===
    0
  ) {
    return value;
  }

  const [
    head,
    ...rest
  ] =
    path;

  if (
    Array.isArray(
      source
    )
  ) {
    const clone =
      source.slice();

    clone[
      head
    ] =
      setDeepValue(
        clone[
          head
        ],
        rest,
        value
      );

    return clone;
  }

  const clone = {
    ...(source ||
      {}),
  };

  clone[
    head
  ] =
    setDeepValue(
      clone[
        head
      ],
      rest,
      value
    );

  return clone;
}


function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(
      value
    ).toLocaleString(
      undefined,
      {
        dateStyle:
          "medium",

        timeStyle:
          "short",
      }
    );
  } catch {
    return String(
      value
    );
  }
}


const DRAFT_STATUS_LABELS =
  {
    [PROFILE_DRAFT_STATUS.CLEAN]:
      "No draft",

    [PROFILE_DRAFT_STATUS.DRAFT]:
      "Draft — incomplete",

    [PROFILE_DRAFT_STATUS.DRAFT_WITH_ERRORS]:
      "Draft — has errors",

    [PROFILE_DRAFT_STATUS.READY]:
      "Draft — ready",

    [PROFILE_DRAFT_STATUS.STALE]:
      "Draft — stale",

    [PROFILE_DRAFT_STATUS.PUBLISHING]:
      "Publishing…",

    [PROFILE_DRAFT_STATUS.PUBLISHED]:
      "Published",
  };


const DRAFT_STATUS_BADGE_CLASS =
  {
    default:
      "border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 text-gray-600 dark:text-gray-400",

    [PROFILE_DRAFT_STATUS.DRAFT]:
      "border-purple-200/70 dark:border-purple-400/20 bg-purple-50/70 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300",

    [PROFILE_DRAFT_STATUS.DRAFT_WITH_ERRORS]:
      "border-red-200/70 dark:border-red-400/20 bg-red-50/70 dark:bg-red-500/10 text-red-700 dark:text-red-300",

    [PROFILE_DRAFT_STATUS.READY]:
      "border-emerald-200/70 dark:border-emerald-400/20 bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",

    [PROFILE_DRAFT_STATUS.STALE]:
      "border-amber-200/70 dark:border-amber-400/20 bg-amber-50/70 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
  };


function isPlainRecord(
  value
) {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );
}


/**
 * A short tag-style value (Tags, Technology, Skills, ...). Rounded
 * just enough to read as a tag, not full-pill -- a full-pill shape
 * looks broken once its text wraps to a second line, which is
 * exactly what happens for the longer entries this same chip
 * renders (a multi-word technology name, a longer skill label).
 */
function TagChip({
  value,
}) {
  return (
    <span className="inline-block rounded-lg border border-indigo-200/70 dark:border-indigo-400/20 bg-indigo-50/70 dark:bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-800 dark:text-indigo-300 break-words">
      {typeof value ===
      "object"
        ? JSON.stringify(
            value
          )
        : String(
            value
          )}
    </span>
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


function AssetUploadControl({
  hasExisting,
  staged,
  busy,
  error,
  onSelectFile,
  onUndo,
}) {
  return (
    <div className="mt-1 space-y-1">
      <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-purple-600 dark:text-purple-300 hover:underline cursor-pointer">
        {busy
          ? "Processing…"
          : hasExisting
            ? "Replace file"
            : "Upload file"}

        <input
          type="file"
          className="hidden"
          disabled={
            busy
          }
          onChange={(
            e
          ) => {
            const file =
              e.target
                .files?.[0];

            e.target.value =
              "";

            if (
              file
            ) {
              onSelectFile(
                file
              );
            }
          }}
        />
      </label>

      {staged ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
          <span>
            New file staged: {staged.fileName} (
            {formatByteSize(
              staged.size
            )}
            ) -- uploaded when you publish.
          </span>

          <button
            type="button"
            onClick={
              onUndo
            }
            className="text-red-600 dark:text-red-400 hover:underline"
          >
            Undo
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="text-[11px] text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
          {
            error
          }
        </div>
      ) : null}
    </div>
  );
}


function AssetFieldValue({
  assetId,
  assets,
  onAssetUpload,
  onUndoAssetUpload,
  stagedAsset,
}) {
  const [
    busy,
    setBusy,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const asset =
    assetId
      ? (
          assets ||
          []
        ).find(
          (
            item
          ) =>
            item
              ?.id ===
            assetId
        )
      : null;

  async function handleSelectFile(
    file
  ) {
    setError(
      ""
    );

    setBusy(
      true
    );

    try {
      await onAssetUpload(
        file
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
    <div className="space-y-1">
      {assetId ? (
        <div className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
          {
            assetId
          }
        </div>
      ) : (
        <span className="text-gray-400 dark:text-gray-500">
          —
        </span>
      )}

      {asset ? (
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          {
            asset.kind
          }{" "}
          ·{" "}
          {
            asset.contentType
          }{" "}
          ·{" "}
          <span className="font-mono">
            {String(
              asset.sha256 ||
                ""
            ).slice(
              0,
              12
            )}
            …
          </span>
        </div>
      ) : assetId ? (
        <div className="text-[11px] text-amber-600 dark:text-amber-400">
          Referenced but not found among this variant's published assets.
        </div>
      ) : null}

      {typeof onAssetUpload ===
      "function" ? (
        <AssetUploadControl
          hasExisting={Boolean(
            assetId
          )}
          staged={
            stagedAsset
          }
          busy={
            busy
          }
          error={
            error
          }
          onSelectFile={
            handleSelectFile
          }
          onUndo={
            onUndoAssetUpload
          }
        />
      ) : null}
    </div>
  );
}


/**
 * Read-only field metadata → value renderer, with an editable
 * escape hatch for plain scalar kinds once a draft is active.
 * Deliberately generic over every kind in PROFILE_EDITOR_FIELD_KINDS
 * so new sections/fields need no new renderer code.
 */
function ScalarFieldValue({
  field,
  value,
  assets,
  onChange,
  onAssetUpload,
  onUndoAssetUpload,
  stagedAsset,
}) {
  // System-generated identifiers (Project ID, Snippet ID, ...) stay
  // display-only even while a draft is active, regardless of kind.
  const effectiveOnChange =
    field.readOnly
      ? undefined
      : onChange;

  if (
    typeof effectiveOnChange ===
      "function" &&
    EDITABLE_SCALAR_KINDS.has(
      field.kind
    )
  ) {
    return (
      <ScalarField
        field={
          field
        }
        value={
          value
        }
        onChange={
          effectiveOnChange
        }
      />
    );
  }

  if (
    field.kind ===
      "string-list" &&
    typeof effectiveOnChange ===
      "function"
  ) {
    return (
      <TagEditor
        items={
          Array.isArray(
            value
          )
            ? value
            : []
        }
        onChange={
          effectiveOnChange
        }
      />
    );
  }

  if (
    field.kind ===
    "asset"
  ) {
    return (
      <AssetFieldValue
        assetId={cleanString(
          value
        )}
        assets={
          assets
        }
        onAssetUpload={
          field.readOnly
            ? undefined
            : onAssetUpload
        }
        onUndoAssetUpload={
          field.readOnly
            ? undefined
            : onUndoAssetUpload
        }
        stagedAsset={
          stagedAsset
        }
      />
    );
  }

  if (
    field.kind ===
      "code" &&
    value
  ) {
    return (
      <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">
        {String(
          value
        )}
      </pre>
    );
  }

  if (
    field.kind ===
    "boolean"
  ) {
    return (
      <span>
        {value
          ? "Yes"
          : "No"}
      </span>
    );
  }

  if (
    field.kind ===
    "datetime"
  ) {
    return (
      <span>
        {formatDateTime(
          value
        )}
      </span>
    );
  }

  if (
    field.kind ===
      "url" &&
    value
  ) {
    return (
      <a
        href={
          value
        }
        target="_blank"
        rel="noreferrer"
        className="text-purple-600 dark:text-purple-300 underline break-all"
      >
        {
          value
        }
      </a>
    );
  }

  if (
    field.kind ===
      "email" &&
    value
  ) {
    return (
      <a
        href={`mailto:${value}`}
        className="text-purple-600 dark:text-purple-300 underline break-all"
      >
        {
          value
        }
      </a>
    );
  }

  if (
    field.kind ===
    "string-list"
  ) {
    const items =
      Array.isArray(
        value
      )
        ? value
        : [];

    if (
      items.length ===
      0
    ) {
      return (
        <span className="text-gray-400 dark:text-gray-500">
          —
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map(
          (
            item,
            index
          ) => (
            <TagChip
              key={
                index
              }
              value={
                item
              }
            />
          )
        )}
      </div>
    );
  }

  if (
    field.kind ===
    "record-string-list"
  ) {
    const groups =
      isPlainRecord(
        value
      )
        ? Object.entries(
            value
          )
        : [];

    if (
      groups.length ===
      0
    ) {
      return (
        <span className="text-gray-400 dark:text-gray-500">
          —
        </span>
      );
    }

    return (
      <div className="space-y-2">
        {groups.map(
          ([
            groupName,
            groupItems,
          ]) => (
            <div
              key={
                groupName
              }
            >
              <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                {
                  groupName
                }
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  Array.isArray(
                    groupItems
                  )
                    ? groupItems
                    : []
                ).map(
                  (
                    item,
                    index
                  ) => (
                    <TagChip
                      key={
                        index
                      }
                      value={
                        item
                      }
                    />
                  )
                )}
              </div>
            </div>
          )
        )}
      </div>
    );
  }

  if (
    value == null ||
    value === ""
  ) {
    return (
      <span className="text-gray-400 dark:text-gray-500">
        —
      </span>
    );
  }

  if (
    typeof value ===
    "object"
  ) {
    return (
      <pre className="text-[11px] whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">
        {JSON.stringify(
          value,
          null,
          2
        )}
      </pre>
    );
  }

  return (
    <span className="whitespace-pre-wrap break-words">
      {String(
        value
      )}
    </span>
  );
}


/**
 * Renders one collection's items (each composed from FieldRow) plus
 * add/remove/move-up/move-down controls when editable. Shared
 * between a top-level Content group (Experience, Education, ...)
 * and a nested field-level collection (e.g. hero.rotatingTitles) so
 * the array-mutation logic exists exactly once.
 */
function CollectionEditor({
  items,
  itemFields,
  itemKey,
  assets,
  arrayPath,
  onFieldChange,
  onAssetUpload,
  onUndoAssetUpload,
  stagedAssets,
  itemClassName =
    "rounded-lg border border-gray-200/70 dark:border-white/10 p-3 space-y-2",
  emptyLabel =
    "No entries.",
}) {
  const editable =
    typeof onFieldChange ===
    "function";

  function updateArray(
    nextItems
  ) {
    onFieldChange(
      arrayPath,
      nextItems
    );
  }

  return (
    <div className="space-y-3">
      {items.length ===
      0 ? (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {
            emptyLabel
          }
        </div>
      ) : (
        items.map(
          (
            item,
            index
          ) => (
            <div
              key={
                item?.[
                  itemKey
                ] ??
                index
              }
              className={
                itemClassName
              }
            >
              {itemFields.map(
                (
                  itemField
                ) => (
                  <FieldRow
                    key={
                      itemField.path
                    }
                    field={
                      itemField
                    }
                    containerValue={
                      item
                    }
                    assets={
                      assets
                    }
                    pathPrefix={[
                      ...arrayPath,
                      index,
                    ]}
                    onFieldChange={
                      editable
                        ? onFieldChange
                        : undefined
                    }
                    onAssetUpload={
                      onAssetUpload
                    }
                    onUndoAssetUpload={
                      onUndoAssetUpload
                    }
                    stagedAssets={
                      stagedAssets
                    }
                  />
                )
              )}

              {editable ? (
                <ArrayItemControls
                  index={
                    index
                  }
                  count={
                    items.length
                  }
                  onMoveUp={() =>
                    updateArray(
                      moveArrayIndex(
                        items,
                        index,
                        -1
                      )
                    )
                  }
                  onMoveDown={() =>
                    updateArray(
                      moveArrayIndex(
                        items,
                        index,
                        1
                      )
                    )
                  }
                  onRemove={() =>
                    updateArray(
                      removeArrayIndex(
                        items,
                        index
                      )
                    )
                  }
                />
              ) : null}
            </div>
          )
        )
      )}

      {editable ? (
        <button
          type="button"
          onClick={() =>
            updateArray(
              [
                ...items,
                createEmptyCollectionItem(
                  itemFields,
                  itemKey
                ),
              ]
            )
          }
          className="text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
        >
          + Add entry
        </button>
      ) : null}
    </div>
  );
}


function FieldRow({
  field,
  containerValue,
  assets,
  pathPrefix =
    [],
  onFieldChange,
  onAssetUpload,
  onUndoAssetUpload,
  stagedAssets,
}) {
  const value =
    getByPath(
      containerValue,
      field.path
    );

  const fullPath =
    [
      ...pathPrefix,
      field.path,
    ];

  if (
    field.kind ===
      "object" &&
    Array.isArray(
      field.fields
    )
  ) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {
            field.label
          }
        </div>

        <div className="pl-3 border-l-2 border-gray-200/70 dark:border-white/10 space-y-2">
          {field.fields.map(
            (
              sub
            ) => (
              <FieldRow
                key={
                  sub.path
                }
                field={
                  sub
                }
                containerValue={
                  value
                }
                assets={
                  assets
                }
                pathPrefix={
                  fullPath
                }
                onFieldChange={
                  onFieldChange
                }
                onAssetUpload={
                  onAssetUpload
                }
                onUndoAssetUpload={
                  onUndoAssetUpload
                }
                stagedAssets={
                  stagedAssets
                }
              />
            )
          )}
        </div>
      </div>
    );
  }

  if (
    field.kind ===
      "collection" &&
    Array.isArray(
      field.itemFields
    )
  ) {
    const items =
      Array.isArray(
        value
      )
        ? value
        : [];

    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {
            field.label
          }{" "}
          (
          {
            items.length
          }
          )
        </div>

        <CollectionEditor
          items={
            items
          }
          itemFields={
            field.itemFields
          }
          itemKey={
            field.itemKey
          }
          assets={
            assets
          }
          arrayPath={
            fullPath
          }
          onFieldChange={
            onFieldChange
          }
          onAssetUpload={
            onAssetUpload
          }
          onUndoAssetUpload={
            onUndoAssetUpload
          }
          stagedAssets={
            stagedAssets
          }
        />
      </div>
    );
  }

  const stagedAsset =
    stagedAssets?.[
      fullPath.join(
        "."
      )
    ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-1 sm:gap-3">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        {
          field.label
        }
      </div>

      <div className="text-xs text-gray-800 dark:text-gray-200 min-w-0">
        <ScalarFieldValue
          field={
            field
          }
          value={
            value
          }
          assets={
            assets
          }
          onChange={
            onFieldChange
              ? (
                  nextValue
                ) =>
                  onFieldChange(
                    fullPath,
                    nextValue
                  )
              : undefined
          }
          onAssetUpload={
            onAssetUpload
              ? (
                  file
                ) =>
                  onAssetUpload(
                    fullPath,
                    field,
                    file
                  )
              : undefined
          }
          onUndoAssetUpload={
            onUndoAssetUpload
              ? () =>
                  onUndoAssetUpload(
                    fullPath
                  )
              : undefined
          }
          stagedAsset={
            stagedAsset
          }
        />
      </div>
    </div>
  );
}


function GroupPanel({
  group,
  variant,
  onFieldChange,
  onAssetUpload,
  onUndoAssetUpload,
  stagedAssets,
}) {
  if (!group) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Select a section from the left to view its content.
      </div>
    );
  }

  const containerValue =
    getByPath(
      variant,
      group.path
    );

  if (
    group.kind ===
      "collection" &&
    Array.isArray(
      group.itemFields
    )
  ) {
    const items =
      Array.isArray(
        containerValue
      )
        ? containerValue
        : [];

    return (
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {
            group.label
          }{" "}
          (
          {
            items.length
          }
          )
        </div>

        <CollectionEditor
          items={
            items
          }
          itemFields={
            group.itemFields
          }
          itemKey={
            group.itemKey
          }
          assets={
            variant
              ?.assets
          }
          arrayPath={
            topLevelContentKey(
              group
            )
          }
          onFieldChange={
            onFieldChange
          }
          onAssetUpload={
            onAssetUpload
          }
          onUndoAssetUpload={
            onUndoAssetUpload
          }
          stagedAssets={
            stagedAssets
          }
          itemClassName={cx(
            CARD_SURFACE,
            CARD_ROUNDED_2XL,
            "p-4 space-y-2"
          )}
          emptyLabel="No entries in this section yet."
        />
      </div>
    );
  }

  const reorderableFieldPaths =
    Array.isArray(
      group.reorderableFieldGroups
    )
      ? group.reorderableFieldGroups
      : [];

  const hasReorderableFields =
    reorderableFieldPaths.length >
      0 &&
    Boolean(
      group.fieldOrderPath
    );

  const allFields =
    group.fields ||
    [];

  const fixedFields =
    hasReorderableFields
      ? allFields.filter(
          (
            field
          ) =>
            !reorderableFieldPaths.includes(
              field.path
            )
        )
      : allFields;

  const orderableFieldsByPath =
    hasReorderableFields
      ? new Map(
          allFields
            .filter(
              (
                field
              ) =>
                reorderableFieldPaths.includes(
                  field.path
                )
            )
            .map(
              (
                field
              ) => [
                field.path,
                field,
              ]
            )
        )
      : new Map();

  const declaredOrder =
    hasReorderableFields &&
    Array.isArray(
      containerValue?.[
        group
          .fieldOrderPath
      ]
    )
      ? containerValue[
          group
            .fieldOrderPath
        ].filter(
          (
            key
          ) =>
            orderableFieldsByPath.has(
              key
            )
        )
      : [];

  const missingFromDeclared =
    reorderableFieldPaths.filter(
      (
        key
      ) =>
        !declaredOrder.includes(
          key
        )
    );

  const effectiveOrder =
    declaredOrder.length
      ? [
          ...declaredOrder,
          ...missingFromDeclared,
        ]
      : reorderableFieldPaths;

  const editable =
    typeof onFieldChange ===
    "function";

  function moveSection(
    path,
    direction
  ) {
    const index =
      effectiveOrder.indexOf(
        path
      );

    onFieldChange(
      [
        ...topLevelContentKey(
          group
        ),
        group.fieldOrderPath,
      ],
      moveArrayIndex(
        effectiveOrder,
        index,
        direction
      )
    );
  }

  return (
    <div className="space-y-3">
      {fixedFields.map(
        (
          field
        ) => (
          <FieldRow
            key={
              field.path
            }
            field={
              field
            }
            containerValue={
              containerValue
            }
            assets={
              variant
                ?.assets
            }
            pathPrefix={
              topLevelContentKey(
                group
              )
            }
            onFieldChange={
              onFieldChange
            }
            onAssetUpload={
              onAssetUpload
            }
            onUndoAssetUpload={
              onUndoAssetUpload
            }
            stagedAssets={
              stagedAssets
            }
          />
        )
      )}

      {hasReorderableFields &&
        effectiveOrder.map(
          (
            path,
            index
          ) => {
            const field =
              orderableFieldsByPath.get(
                path
              );

            if (!field) {
              return null;
            }

            return (
              <div
                key={
                  path
                }
                className={cx(
                  CARD_SURFACE,
                  CARD_ROUNDED_2XL,
                  "p-4 space-y-2"
                )}
              >
                <FieldRow
                  field={
                    field
                  }
                  containerValue={
                    containerValue
                  }
                  assets={
                    variant
                      ?.assets
                  }
                  pathPrefix={
                    topLevelContentKey(
                      group
                    )
                  }
                  onFieldChange={
                    onFieldChange
                  }
                  onAssetUpload={
                    onAssetUpload
                  }
                  onUndoAssetUpload={
                    onUndoAssetUpload
                  }
                  stagedAssets={
                    stagedAssets
                  }
                />

                {editable && (
                  <ArrayItemControls
                    index={
                      index
                    }
                    count={
                      effectiveOrder.length
                    }
                    onMoveUp={() =>
                      moveSection(
                        path,
                        -1
                      )
                    }
                    onMoveDown={() =>
                      moveSection(
                        path,
                        1
                      )
                    }
                    itemLabel={`the ${field.label} section`}
                  />
                )}
              </div>
            );
          }
        )}
    </div>
  );
}


function topLevelContentKey(
  group
) {
  const path =
    String(
      group
        ?.path ||
        ""
    );

  return path.startsWith(
    "content."
  )
    ? [
        path.slice(
          "content.".length
        ),
      ]
    : [
        path,
      ];
}


/**
 * Object-shaped groups only: a collection group (e.g. Education)
 * may hold many per-record assets, which stay visible in that
 * section's own content view rather than being flattened here.
 */
function collectAssetFieldRefs(
  groups
) {
  const refs =
    [];

  function walk(
    fields,
    group
  ) {
    for (
      const field of
        fields || []
    ) {
      if (
        field.kind ===
        "asset"
      ) {
        refs.push({
          groupId:
            group.id,

          groupLabel:
            group.label,

          field,
        });
      } else if (
        field.kind ===
          "object" &&
        Array.isArray(
          field.fields
        )
      ) {
        walk(
          field.fields,
          group
        );
      }
    }
  }

  for (
    const group of
      groups || []
  ) {
    if (
      group.kind ===
      "object"
    ) {
      walk(
        group.fields,
        group
      );
    }
  }

  return refs;
}


function AssetsPanel({
  assetFieldRefs,
  variant,
  onFieldChange,
  onAssetUpload,
  onUndoAssetUpload,
  stagedAssets,
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 dark:text-gray-400 max-w-2xl">
        Asset-backed fields from Content sections, consolidated. Per-record
        assets inside repeatable sections (e.g. an Education attachment) stay
        visible in their own section above instead of being duplicated here.
      </p>

      {assetFieldRefs.length ===
      0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          No asset-backed fields declared.
        </div>
      ) : (
        assetFieldRefs.map(
          (
            ref
          ) => {
            const containerValue =
              getByPath(
                variant,
                ref.groupPath
              );

            return (
              <div
                key={`${ref.groupId}.${ref.field.path}`}
                className={cx(
                  CARD_SURFACE,
                  CARD_ROUNDED_2XL,
                  "p-4 space-y-2"
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {
                    ref.groupLabel
                  }
                </div>

                <FieldRow
                  field={
                    ref.field
                  }
                  containerValue={
                    containerValue
                  }
                  assets={
                    variant
                      ?.assets
                  }
                  pathPrefix={topLevelContentKey(
                    {
                      path:
                        ref.groupPath,
                    }
                  )}
                  onFieldChange={
                    onFieldChange
                  }
                  onAssetUpload={
                    onAssetUpload
                  }
                  onUndoAssetUpload={
                    onUndoAssetUpload
                  }
                  stagedAssets={
                    stagedAssets
                  }
                />
              </div>
            );
          }
        )
      )}
    </div>
  );
}


const STRUCTURE_GROUP_LABELS =
  {
    pinned:
      "Pinned",

    recruiter:
      "Recruiter",

    hiringManager:
      "Hiring Manager",

    explore:
      "Explore",
  };


function structureSectionToGroup(
  structure
) {
  const map =
    new Map();

  for (
    const groupId of
      SITE_STRUCTURE_GROUP_IDS
  ) {
    for (
      const label of
        structure
          .groups[
          groupId
        ] ||
        []
    ) {
      map.set(
        label,
        groupId
      );
    }
  }

  return map;
}


function StructurePanel({
  structure,
  onChange,
}) {
  const editable =
    typeof onChange ===
    "function";

  const sectionToGroup =
    structureSectionToGroup(
      structure
    );

  const hiddenSections =
    PUBLIC_SECTION_ORDER.filter(
      (
        label
      ) =>
        !structure.order.includes(
          label
        )
    );

  function commit(
    nextRaw
  ) {
    onChange(
      resolveSiteStructure(
        nextRaw
      )
    );
  }

  function moveSection(
    label,
    direction
  ) {
    const index =
      structure.order.indexOf(
        label
      );

    commit(
      {
        ...structure,

        order:
          moveArrayIndex(
            structure.order,
            index,
            direction
          ),
      }
    );
  }

  function setSectionGroup(
    label,
    groupId
  ) {
    const nextGroups =
      {};

    for (
      const gid of
        SITE_STRUCTURE_GROUP_IDS
    ) {
      nextGroups[
        gid
      ] = (
        structure
          .groups[
          gid
        ] ||
        []
      ).filter(
        (
          existing
        ) =>
          existing !==
          label
      );
    }

    nextGroups[
      groupId
    ] = [
      ...nextGroups[
        groupId
      ],
      label,
    ];

    commit(
      {
        ...structure,

        groups:
          nextGroups,
      }
    );
  }

  function setDefaultSection(
    label
  ) {
    commit(
      {
        ...structure,

        defaultSection:
          label,
      }
    );
  }

  function hideSection(
    label
  ) {
    commit(
      {
        ...structure,

        order:
          structure.order.filter(
            (
              existing
            ) =>
              existing !==
              label
          ),
      }
    );
  }

  function showSection(
    label
  ) {
    commit(
      {
        ...structure,

        order: [
          ...structure.order,
          label,
        ],
      }
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 dark:text-gray-400 max-w-2xl">
        {editable
          ? "Reorder, recategorize, hide, or show sections of the public site's main navigation. This is separate from Resume's own internal section order."
          : "Section order, grouping, and visibility for the public site's main navigation. Start a draft to edit."}
      </p>

      <div
        className={cx(
          CARD_SURFACE,
          CARD_ROUNDED_2XL,
          "divide-y divide-gray-200/70 dark:divide-white/10"
        )}
      >
        {structure.order.map(
          (
            label,
            index
          ) => (
            <div
              key={
                label
              }
              className="p-4 flex flex-wrap items-center gap-3"
            >
              <div className="flex-1 min-w-[140px] text-sm font-semibold text-gray-800 dark:text-gray-200">
                {
                  label
                }

                {structure.defaultSection ===
                label ? (
                  <span className="ml-2 rounded-lg border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/70 dark:bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                    Default landing section
                  </span>
                ) : null}
              </div>

              {editable ? (
                <select
                  aria-label={`${label} category`}
                  value={
                    sectionToGroup.get(
                      label
                    ) ||
                    "explore"
                  }
                  onChange={(
                    e
                  ) =>
                    setSectionGroup(
                      label,
                      e
                        .target
                        .value
                    )
                  }
                  className="h-9 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-2 text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
                >
                  {SITE_STRUCTURE_GROUP_IDS.map(
                    (
                      groupId
                    ) => (
                      <option
                        key={
                          groupId
                        }
                        value={
                          groupId
                        }
                      >
                        {
                          STRUCTURE_GROUP_LABELS[
                            groupId
                          ]
                        }
                      </option>
                    )
                  )}
                </select>
              ) : (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {STRUCTURE_GROUP_LABELS[
                    sectionToGroup.get(
                      label
                    ) ||
                      "explore"
                  ]}
                </span>
              )}

              {editable && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={
                      index ===
                      0
                    }
                    onClick={() =>
                      moveSection(
                        label,
                        -1
                      )
                    }
                    className="text-xs text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-purple-600 dark:hover:text-purple-300"
                    aria-label={`Move ${label} up`}
                  >
                    ↑ Move up
                  </button>

                  <button
                    type="button"
                    disabled={
                      index ===
                      structure
                        .order
                        .length -
                        1
                    }
                    onClick={() =>
                      moveSection(
                        label,
                        1
                      )
                    }
                    className="text-xs text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-purple-600 dark:hover:text-purple-300"
                    aria-label={`Move ${label} down`}
                  >
                    ↓ Move down
                  </button>

                  {structure.defaultSection !==
                  label ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDefaultSection(
                          label
                        )
                      }
                      className="text-xs text-purple-600 dark:text-purple-300 hover:underline"
                    >
                      Set as default
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      hideSection(
                        label
                      )
                    }
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    aria-label={`Hide ${label}`}
                  >
                    Hide
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {hiddenSections.length >
      0 ? (
        <div
          className={cx(
            CARD_SURFACE,
            CARD_ROUNDED_2XL,
            "p-4 space-y-2"
          )}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Hidden from public navigation
          </div>

          <div className="flex flex-wrap gap-2">
            {hiddenSections.map(
              (
                label
              ) => (
                <div
                  key={
                    label
                  }
                  className="flex items-center gap-2 rounded-lg border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-300"
                >
                  {
                    label
                  }

                  {editable ? (
                    <button
                      type="button"
                      onClick={() =>
                        showSection(
                          label
                        )
                      }
                      className="text-purple-600 dark:text-purple-300 hover:underline"
                      aria-label={`Show ${label}`}
                    >
                      Show
                    </button>
                  ) : null}
                </div>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}


export default function AdminData({
  activeProfileVariantId =
    "",

  activeProfileTargeting =
    null,

  activeProfile =
    null,

  onRefreshActiveProfile,
}) {
  const editorMetadata =
    useMemo(
      () =>
        getProfileEditorMetadata(),
      []
    );

  const contentGroups =
    useMemo(
      () =>
        editorMetadata.groups.filter(
          (
            group
          ) =>
            group.id !==
            "targeting"
        ),
      [
        editorMetadata,
      ]
    );

  const assetFieldRefs =
    useMemo(
      () =>
        collectAssetFieldRefs(
          editorMetadata.groups
        ).map(
          (
            ref
          ) => ({
            ...ref,

            groupPath:
              editorMetadata.groups.find(
                (
                  group
                ) =>
                  group.id ===
                  ref.groupId
              )
                ?.path,
          })
        ),
      [
        editorMetadata,
      ]
    );

  const [
    variant,
    setVariant,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    view,
    setView,
  ] =
    useState(
      "content"
    );

  const [
    selectedGroupId,
    setSelectedGroupId,
  ] =
    useState(
      () =>
        contentGroups[0]
          ?.id ||
        ""
    );

  const [
    search,
    setSearch,
  ] =
    useState("");


  useEffect(
    () => {
      const id =
        cleanString(
          activeProfileVariantId
        );

      if (!id) {
        setVariant(
          null
        );

        return undefined;
      }

      let cancelled =
        false;

      setLoading(
        true
      );

      setError(
        ""
      );

      (async () => {
        try {
          const result =
            await getProfileVariant(
              id
            );

          if (
            !cancelled
          ) {
            setVariant(
              result.variant
            );
          }
        } catch (
          e
        ) {
          if (
            !cancelled
          ) {
            setError(
              String(
                e
                  ?.message ||
                e
              )
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            );
          }
        }
      })();

      return () => {
        cancelled =
          true;
      };
    },
    [
      activeProfileVariantId,
    ]
  );


  const {
    draft,
    resumableDraft,
    status:
      draftStatus,
    autosaveError,
    startDraft,
    resumeDraft,
    discardDraft,
    patchDraft,
  } =
    useProfileDraftSession(
      {
        baseProfileVariantId:
          variant
            ?.profileVariantId ||
          cleanString(
            activeProfileVariantId
          ),

        baseTargeting:
          variant
            ?.targeting,

        baseContent:
          variant
            ?.content,
      }
    );


  const [
    showPublishReview,
    setShowPublishReview,
  ] =
    useState(
      false
    );

  const [
    publishSuccess,
    setPublishSuccess,
  ] =
    useState(
      null
    );

  // Staged asset replacements/uploads, keyed by the dotted content
  // path of the field they belong to (e.g. "resume.pdfAssetId").
  // Transient, browser-memory only -- File/ArrayBuffer data isn't
  // JSON-serializable, so this can never be part of the persisted
  // draft. Lost on refresh, same as any other unsaved file picker.
  const [
    stagedAssets,
    setStagedAssets,
  ] =
    useState(
      {}
    );

  function handlePublished(
    result
  ) {
    discardDraft();

    setShowPublishReview(
      false
    );

    setPublishSuccess(
      result
    );

    setStagedAssets(
      {}
    );
  }


  async function handleAssetUpload(
    fullPath,
    field,
    file
  ) {
    const pathKey =
      fullPath.join(
        "."
      );

    const currentAssetId =
      cleanString(
        fullPath.reduce(
          (
            acc,
            key
          ) =>
            acc ==
            null
              ? undefined
              : acc[
                  key
                ],
          renderVariant
            ?.content
        )
      );

    const arrayBuffer =
      await file.arrayBuffer();

    const sha256 =
      await sha256BytesHex(
        arrayBuffer
      );

    const contentType =
      file.type ||
      "application/octet-stream";

    const objectKey =
      createContentAddressedProfileAssetObjectKey(
        {
          sha256,
          contentType,
        }
      );

    const wasNewlyMinted =
      !currentAssetId;

    const assetId =
      currentAssetId ||
      `${fullPath[0]}.${randomAssetIdSuffix()}`;

    const kind =
      Array.isArray(
        field.assetKinds
      ) &&
      field
        .assetKinds
        .length
        ? field
            .assetKinds[0]
        : "other";

    setStagedAssets(
      (
        prev
      ) => ({
        ...prev,

        [pathKey]: {
          assetId,
          fileName:
            file.name,
          size:
            file.size,
          contentType,
          sha256,
          objectKey,
          kind,
          arrayBuffer,
          wasNewlyMinted,
        },
      })
    );

    if (
      wasNewlyMinted
    ) {
      onFieldChange?.(
        fullPath,
        assetId
      );
    }
  }


  function handleUndoAssetUpload(
    fullPath
  ) {
    const pathKey =
      fullPath.join(
        "."
      );

    const entry =
      stagedAssets[
        pathKey
      ];

    setStagedAssets(
      (
        prev
      ) => {
        const next =
          {
            ...prev,
          };

        delete next[
          pathKey
        ];

        return next;
      }
    );

    if (
      entry
        ?.wasNewlyMinted
    ) {
      onFieldChange?.(
        fullPath,
        ""
      );
    }
  }


  const onFieldChange =
    useMemo(
      () =>
        draft
          ? (
              fullPath,
              nextValue
            ) => {
              const [
                sectionKey,
                ...rest
              ] =
                fullPath;

              const nextSectionValue =
                setDeepValue(
                  draft
                    .content
                    ?.[
                      sectionKey
                    ],
                  rest,
                  nextValue
                );

              patchDraft(
                {
                  content:
                    {
                      [sectionKey]:
                        nextSectionValue,
                    },
                }
              );
            }
          : undefined,
      [
        draft,
        patchDraft,
      ]
    );


  const renderVariant =
    useMemo(
      () =>
        variant
          ? {
              ...variant,

              content:
                draft
                  ? draft.content
                  : variant.content,

              targeting:
                draft
                  ? draft.targeting
                  : variant.targeting,
            }
          : null,
      [
        variant,
        draft,
      ]
    );


  const effectiveStructure =
    useMemo(
      () =>
        resolveSiteStructure(
          renderVariant
            ?.content
            ?.structure
        ),
      [
        renderVariant,
      ]
    );


  const filteredGroups =
    useMemo(
      () => {
        const q =
          search
            .trim()
            .toLowerCase();

        if (!q) {
          return contentGroups;
        }

        return contentGroups.filter(
          (
            group
          ) =>
            group.label
              .toLowerCase()
              .includes(
                q
              )
        );
      },
      [
        contentGroups,
        search,
      ]
    );

  const selectedGroup =
    contentGroups.find(
      (
        group
      ) =>
        group.id ===
        selectedGroupId
    ) ||
    null;

  const navItemClass = (
    active
  ) =>
    cx(
      "w-full text-left px-3 py-2 rounded-lg text-sm transition",
      active
        ? "bg-purple-600 text-white"
        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
    );


  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader
        icon={
          FaDatabase
        }
        title="Data"
      />

      <div className="px-6 space-y-6">
        <div className="mt-10">
          <div
            className={cx(
              CARD_SURFACE,
              CARD_ROUNDED_2XL,
              "px-6 py-4"
            )}
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>
                Target:{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {cleanString(
                    activeProfileTargeting
                      ?.location
                  ) ||
                    "—"}{" "}
                  ·{" "}
                  {cleanString(
                    activeProfileTargeting
                      ?.jobRole
                  ) ||
                    "—"}
                </span>
              </div>

              <div>
                Active variant:{" "}
                <span className="font-mono text-gray-900 dark:text-gray-100">
                  {cleanString(
                    activeProfileVariantId
                  ) ||
                    "—"}
                </span>
              </div>

              <div>
                Content schema:{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  v
                  {variant
                    ?.contentSchemaVersion ??
                    "—"}
                </span>
              </div>

              <div>
                Published:{" "}
                <span className="text-gray-900 dark:text-gray-100">
                  {formatDateTime(
                    variant
                      ?.createdAt
                  )}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className={cx(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  DRAFT_STATUS_BADGE_CLASS[
                    draftStatus
                  ] ||
                    DRAFT_STATUS_BADGE_CLASS.default
                )}
              >
                {DRAFT_STATUS_LABELS[
                  draftStatus
                ] ||
                  draftStatus}
              </span>

              {draft &&
              (draftStatus ===
                PROFILE_DRAFT_STATUS.READY ||
                Object.keys(
                  stagedAssets
                ).length >
                  0) ? (
                <button
                  type="button"
                  onClick={() =>
                    setShowPublishReview(
                      true
                    )
                  }
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
                >
                  Publish…
                </button>
              ) : null}

              {draft ? (
                <button
                  type="button"
                  onClick={() => {
                    setPublishSuccess(
                      null
                    );

                    setShowPublishReview(
                      false
                    );

                    setStagedAssets(
                      {}
                    );

                    discardDraft();
                  }}
                  className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                >
                  Discard draft
                </button>
              ) : variant &&
                !resumableDraft ? (
                <button
                  type="button"
                  onClick={() => {
                    setPublishSuccess(
                      null
                    );

                    setStagedAssets(
                      {}
                    );

                    startDraft();
                  }}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
                >
                  Start draft
                </button>
              ) : null}

              {autosaveError ? (
                <span className="text-xs text-red-600 dark:text-red-400">
                  Autosave failed:{" "}
                  {
                    autosaveError
                  }
                </span>
              ) : null}
            </div>

            {resumableDraft ? (
              <div className="mt-3 rounded-lg border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/60 dark:bg-purple-500/5 p-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  A saved draft from a previous session is available.
                </span>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={
                      resumeDraft
                    }
                    className="text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
                  >
                    Resume draft
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStagedAssets(
                        {}
                      );

                      discardDraft();
                    }}
                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : null}

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {draft
                ? "Editing a draft. Plain text/number/toggle fields save automatically; nothing here affects production until you publish."
                : "Read-only view of the active Profile Variant's content. Start a draft to begin editing — nothing here can change production."}
            </p>
          </div>
        </div>

        {publishSuccess ? (
          <div
            className={cx(
              CARD_SURFACE,
              CARD_ROUNDED_2XL,
              "border-emerald-200/70 dark:border-emerald-400/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-4 flex items-center justify-between gap-3"
            )}
          >
            <div className="text-xs text-gray-700 dark:text-gray-300">
              New Profile Variant{" "}
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {
                  publishSuccess.profileVariantId
                }
              </span>{" "}
              is now stored. See "Publish new Profile Variant" below to activate it.
            </div>

            <button
              type="button"
              onClick={() =>
                setPublishSuccess(
                  null
                )
              }
              className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {showPublishReview &&
        draft &&
        variant ? (
          <PublishReviewPanel
            draft={
              draft
            }
            baseVariant={
              variant
            }
            stagedAssets={
              stagedAssets
            }
            onPublished={
              handlePublished
            }
            onCancel={() =>
              setShowPublishReview(
                false
              )
            }
          />
        ) : null}

        <ProfileVariantPublicationPanel
          activeProfileVariantId={
            activeProfileVariantId
          }
          activeProfile={
            activeProfile
          }
          onRefreshActiveProfile={
            onRefreshActiveProfile
          }
          seedPublishResult={
            publishSuccess
          }
        />

        {!cleanString(
          activeProfileVariantId
        ) ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            No active Profile Variant is configured.
          </div>
        ) : loading &&
          !variant ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Loading active Profile content…
          </div>
        ) : error ? (
          <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
            {
              error
            }
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
            <div
              className={cx(
                CARD_SURFACE,
                CARD_ROUNDED_2XL,
                "p-4 space-y-4 h-fit"
              )}
            >
              <input
                type="text"
                value={
                  search
                }
                onChange={(
                  e
                ) =>
                  setSearch(
                    e
                      .target
                      .value
                  )
                }
                placeholder="Search sections…"
                className="w-full h-9 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
              />

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 px-1 mb-1">
                  Content
                </div>

                <div className="space-y-0.5">
                  {filteredGroups.map(
                    (
                      group
                    ) => (
                      <button
                        key={
                          group.id
                        }
                        type="button"
                        className={navItemClass(
                          view ===
                            "content" &&
                            selectedGroupId ===
                              group.id
                        )}
                        onClick={() => {
                          setView(
                            "content"
                          );

                          setSelectedGroupId(
                            group.id
                          );
                        }}
                      >
                        {
                          group.label
                        }
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 px-1 mb-1">
                  Structure
                </div>

                <button
                  type="button"
                  className={navItemClass(
                    view ===
                      "structure"
                  )}
                  onClick={() =>
                    setView(
                      "structure"
                    )
                  }
                >
                  Names, order & visibility
                </button>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 px-1 mb-1">
                  Assets
                </div>

                <button
                  type="button"
                  className={navItemClass(
                    view ===
                      "assets"
                  )}
                  onClick={() =>
                    setView(
                      "assets"
                    )
                  }
                >
                  Documents & images
                </button>
              </div>
            </div>

            <div
              className={cx(
                CARD_SURFACE,
                CARD_ROUNDED_2XL,
                "p-6"
              )}
            >
              {view ===
              "structure" ? (
                <StructurePanel
                  structure={
                    effectiveStructure
                  }
                  onChange={
                    onFieldChange
                      ? (
                          nextStructure
                        ) =>
                          onFieldChange(
                            [
                              "structure",
                            ],
                            nextStructure
                          )
                      : undefined
                  }
                />
              ) : view ===
                "assets" ? (
                <AssetsPanel
                  assetFieldRefs={
                    assetFieldRefs
                  }
                  variant={
                    renderVariant
                  }
                  onFieldChange={
                    onFieldChange
                  }
                  onAssetUpload={
                    onFieldChange
                      ? handleAssetUpload
                      : undefined
                  }
                  onUndoAssetUpload={
                    onFieldChange
                      ? handleUndoAssetUpload
                      : undefined
                  }
                  stagedAssets={
                    stagedAssets
                  }
                />
              ) : (
                <GroupPanel
                  group={
                    selectedGroup
                  }
                  variant={
                    renderVariant
                  }
                  onFieldChange={
                    onFieldChange
                  }
                  onAssetUpload={
                    onFieldChange
                      ? handleAssetUpload
                      : undefined
                  }
                  onUndoAssetUpload={
                    onFieldChange
                      ? handleUndoAssetUpload
                      : undefined
                  }
                  stagedAssets={
                    stagedAssets
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
