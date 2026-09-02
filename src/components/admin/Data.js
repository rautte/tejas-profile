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

import {
  SIDEBAR_GROUPS,
} from "../../data/App";

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


/**
 * Read-only field metadata → value renderer.
 *
 * Deliberately generic over every kind in PROFILE_EDITOR_FIELD_KINDS
 * so new sections/fields need no new renderer code — only editing
 * (a later phase) needs per-kind interactive controls.
 */
function ScalarFieldValue({
  field,
  value,
  assets,
}) {
  if (
    field.kind ===
    "asset"
  ) {
    const assetId =
      cleanString(
        value
      );

    if (!assetId) {
      return (
        <span className="text-gray-400 dark:text-gray-500">
          —
        </span>
      );
    }

    const asset =
      (
        assets || []
      ).find(
        (
          item
        ) =>
          item
            ?.id ===
          assetId
      );

    return (
      <div className="space-y-1">
        <div className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
          {
            assetId
          }
        </div>

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
        ) : (
          <div className="text-[11px] text-amber-600 dark:text-amber-400">
            Referenced but not found among this variant's published assets.
          </div>
        )}
      </div>
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
      "string-list" ||
    field.kind ===
      "record-string-list"
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
            <span
              key={
                index
              }
              className="rounded-full border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 px-2 py-0.5 text-[11px]"
            >
              {typeof item ===
              "object"
                ? JSON.stringify(
                    item
                  )
                : String(
                    item
                  )}
            </span>
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


function FieldRow({
  field,
  containerValue,
  assets,
}) {
  const value =
    getByPath(
      containerValue,
      field.path
    );

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

        {items.length ===
        0 ? (
          <div className="text-xs text-gray-400 dark:text-gray-500">
            No entries.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(
              (
                item,
                index
              ) => (
                <div
                  key={
                    item?.[
                      field
                        .itemKey
                    ] ??
                    index
                  }
                  className="rounded-lg border border-gray-200/70 dark:border-white/10 p-3 space-y-2"
                >
                  {field.itemFields.map(
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
                      />
                    )
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  }

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
        />
      </div>
    </div>
  );
}


function GroupPanel({
  group,
  variant,
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
      <div className="space-y-4">
        {items.length ===
        0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            No entries in this section yet.
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
                    group
                      .itemKey
                  ] ??
                  index
                }
                className={cx(
                  CARD_SURFACE,
                  CARD_ROUNDED_2XL,
                  "p-4 space-y-2"
                )}
              >
                {group.itemFields.map(
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
                        item
                      }
                      assets={
                        variant
                          ?.assets
                      }
                    />
                  )
                )}
              </div>
            )
          )
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(
        group.fields ||
        []
      ).map(
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
          />
        )
      )}
    </div>
  );
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
                />
              </div>
            );
          }
        )
      )}
    </div>
  );
}


function StructurePanel() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 dark:text-gray-400 max-w-2xl">
        Section order, grouping, and visibility are read-only for now — they
        are not yet part of the published Profile schema. Owner-editable
        structure arrives in a later phase.
      </p>

      <div className="space-y-3">
        {Object.entries(
          SIDEBAR_GROUPS
        )
          .filter(
            (
              [
                groupKey,
              ]
            ) =>
              groupKey !==
              "admin"
          )
          .map(
            (
              [
                groupKey,
                sections,
              ]
            ) => (
              <div
                key={
                  groupKey
                }
                className={cx(
                  CARD_SURFACE,
                  CARD_ROUNDED_2XL,
                  "p-4"
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  {
                    groupKey
                  }
                </div>

                <ol className="space-y-1 text-sm text-gray-800 dark:text-gray-200 list-decimal list-inside">
                  {sections.map(
                    (
                      section
                    ) => (
                      <li
                        key={
                          section
                        }
                      >
                        {
                          section
                        }
                      </li>
                    )
                  )}
                </ol>
              </div>
            )
          )}
      </div>
    </div>
  );
}


export default function AdminData({
  activeProfileVariantId =
    "",

  activeProfileTargeting =
    null,
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

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Read-only view of the active Profile Variant's content. Editing
              arrives in a later phase — nothing here can change production.
            </p>
          </div>
        </div>

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
                <StructurePanel />
              ) : view ===
                "assets" ? (
                <AssetsPanel
                  assetFieldRefs={
                    assetFieldRefs
                  }
                  variant={
                    variant
                  }
                />
              ) : (
                <GroupPanel
                  group={
                    selectedGroup
                  }
                  variant={
                    variant
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
