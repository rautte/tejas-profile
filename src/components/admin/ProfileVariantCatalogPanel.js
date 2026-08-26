// src/components/admin/ProfileVariantCatalogPanel.js

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getPlatformRelease,
  getProfileVariant,
  listDeploymentConfigurations,
  listProfileActivations,
  listProfileVariants,
} from "../../utils/snapshots/controlPlaneCatalogApi";

import {
  buildProfileVariantCatalogRows,
  buildProfileVariantHistoryModel,
} from "../../utils/snapshots/controlPlaneCatalogViewModel";

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../../utils/ui";

import {
  cx,
} from "../../utils/cx";

import {
  Badge,
  cleanString,
  displayValue,
  formatTimestamp,
  HistoryLinkButton,
  HistorySection,
  MetadataRow,
  ppsLabel,
  SmallButton,
  targetingLabel,
} from "./controlPlaneCatalogUi";


const CATALOG_PAGE_SIZE =
  25;

const HISTORY_PAGE_SIZE =
  50;



export default function ProfileVariantCatalogPanel({
  activeProfileVariantId =
    "",

  selectionRequest =
    null,

  onOpenPlatformRelease,
}) {
  const [
    catalog,
    setCatalog,
  ] =
    useState(
      []
    );


  const [
    catalogNextToken,
    setCatalogNextToken,
  ] =
    useState(
      null
    );


  const [
    catalogLoading,
    setCatalogLoading,
  ] =
    useState(
      true
    );


  const [
    catalogMoreBusy,
    setCatalogMoreBusy,
  ] =
    useState(
      false
    );


  const [
    catalogError,
    setCatalogError,
  ] =
    useState(
      ""
    );


  const [
    selectedProfileVariantId,
    setSelectedProfileVariantId,
  ] =
    useState(
      ""
    );


  const [
    selectedVariantResult,
    setSelectedVariantResult,
  ] =
    useState(
      null
    );


  const [
    activations,
    setActivations,
  ] =
    useState(
      []
    );


  const [
    activationNextToken,
    setActivationNextToken,
  ] =
    useState(
      null
    );


  const [
    configurations,
    setConfigurations,
  ] =
    useState(
      []
    );


  const [
    configurationNextToken,
    setConfigurationNextToken,
  ] =
    useState(
      null
    );


  const [
    platformReleases,
    setPlatformReleases,
  ] =
    useState(
      []
    );


  const [
    detailLoading,
    setDetailLoading,
  ] =
    useState(
      false
    );


  const [
    activationMoreBusy,
    setActivationMoreBusy,
  ] =
    useState(
      false
    );


  const [
    configurationMoreBusy,
    setConfigurationMoreBusy,
  ] =
    useState(
      false
    );


  const [
    detailError,
    setDetailError,
  ] =
    useState(
      ""
    );


  /**
   * Increment whenever selection changes.
   *
   * Older async responses must never overwrite a newer selection.
   */
  const detailRequestRef =
    useRef(
      0
    );


  const catalogRows =
    useMemo(
      () =>
        buildProfileVariantCatalogRows({
          variants:
            catalog,

          activeProfileVariantId,
        }),
      [
        catalog,
        activeProfileVariantId,
      ]
    );


  const historyModel =
    useMemo(
      () => {
        const variant =
          selectedVariantResult
            ?.variant;


        if (
          !variant
        ) {
          return null;
        }


        return buildProfileVariantHistoryModel({
          variant,

          activeProfileVariantId,

          activations,

          configurations,

          platformReleases,
        });
      },
      [
        selectedVariantResult,
        activeProfileVariantId,
        activations,
        configurations,
        platformReleases,
      ]
    );


  const fetchReferencedPlatformReleases =
    useCallback(
      async (
        configurationItems,
        existingReleases =
          []
      ) => {
        const existingIds =
          new Set(
            (
              existingReleases ||
              []
            )
              .map(
                (
                  release
                ) =>
                  cleanString(
                    release
                      ?.platformReleaseId
                  )
              )
              .filter(
                Boolean
              )
          );


        const ids =
          Array.from(
            new Set(
              (
                configurationItems ||
                []
              )
                .map(
                  (
                    configuration
                  ) =>
                    cleanString(
                      configuration
                        ?.platformReleaseId
                    )
                )
                .filter(
                  Boolean
                )
            )
          )
            .filter(
              (
                id
              ) =>
                !existingIds.has(
                  id
                )
            );


        if (
          !ids.length
        ) {
          return [];
        }


        const results =
          await Promise.all(
            ids.map(
              (
                id
              ) =>
                getPlatformRelease(
                  id
                )
            )
          );


        return results.map(
          (
            result
          ) =>
            result.release
        );
      },
      []
    );


  const loadInitialCatalog =
    useCallback(
      async () => {
        setCatalogLoading(
          true
        );

        setCatalogError(
          ""
        );


        try {
          const result =
            await listProfileVariants({
              limit:
                CATALOG_PAGE_SIZE,
            });


          setCatalog(
            Array.isArray(
              result
                ?.variants
            )
              ? result.variants
              : []
          );


          setCatalogNextToken(
            result
              ?.nextToken ||
            null
          );
        } catch (
          error
        ) {
          setCatalog(
            []
          );

          setCatalogNextToken(
            null
          );

          setCatalogError(
            String(
              error
                ?.message ||
              error
            )
          );
        } finally {
          setCatalogLoading(
            false
          );
        }
      },
      []
    );


  useEffect(
    () => {
      loadInitialCatalog();
    },
    [
      loadInitialCatalog,
    ]
  );


  const loadMoreCatalog =
    async () => {
      if (
        !catalogNextToken ||
        catalogMoreBusy
      ) {
        return;
      }


      setCatalogMoreBusy(
        true
      );

      setCatalogError(
        ""
      );


      try {
        const result =
          await listProfileVariants({
            limit:
              CATALOG_PAGE_SIZE,

            nextToken:
              catalogNextToken,
          });


        const nextItems =
          Array.isArray(
            result
              ?.variants
          )
            ? result.variants
            : [];


        setCatalog(
          (
            current
          ) => [
            ...current,
            ...nextItems,
          ]
        );


        setCatalogNextToken(
          result
            ?.nextToken ||
          null
        );
      } catch (
        error
      ) {
        setCatalogError(
          String(
            error
              ?.message ||
            error
          )
        );
      } finally {
        setCatalogMoreBusy(
          false
        );
      }
    };


  const selectVariant =
    useCallback(
      async (
        profileVariantId
      ) => {
      const id =
        cleanString(
          profileVariantId
        );


      if (!id) {
        return;
      }


      const requestId =
        detailRequestRef
          .current +
        1;


      detailRequestRef.current =
        requestId;


      setSelectedProfileVariantId(
        id
      );

      setSelectedVariantResult(
        null
      );

      setActivations(
        []
      );

      setActivationNextToken(
        null
      );

      setConfigurations(
        []
      );

      setConfigurationNextToken(
        null
      );

      setPlatformReleases(
        []
      );

      setDetailError(
        ""
      );

      setDetailLoading(
        true
      );


      try {
        const [
          variantResult,
          activationResult,
          configurationResult,
        ] =
          await Promise.all([
            getProfileVariant(
              id
            ),

            listProfileActivations({
              profileVariantId:
                id,

              limit:
                HISTORY_PAGE_SIZE,
            }),

            listDeploymentConfigurations({
              profileVariantId:
                id,

              limit:
                HISTORY_PAGE_SIZE,
            }),
          ]);


        if (
          detailRequestRef
            .current !==
          requestId
        ) {
          return;
        }


        const loadedActivations =
          Array.isArray(
            activationResult
              ?.activations
          )
            ? activationResult
                .activations
            : [];


        const loadedConfigurations =
          Array.isArray(
            configurationResult
              ?.configurations
          )
            ? configurationResult
                .configurations
            : [];


        const loadedReleases =
          await fetchReferencedPlatformReleases(
            loadedConfigurations
          );


        if (
          detailRequestRef
            .current !==
          requestId
        ) {
          return;
        }


        setSelectedVariantResult(
          variantResult
        );

        setActivations(
          loadedActivations
        );

        setActivationNextToken(
          activationResult
            ?.nextToken ||
          null
        );

        setConfigurations(
          loadedConfigurations
        );

        setConfigurationNextToken(
          configurationResult
            ?.nextToken ||
          null
        );

        setPlatformReleases(
          loadedReleases
        );
      } catch (
        error
      ) {
        if (
          detailRequestRef
            .current !==
          requestId
        ) {
          return;
        }


        setDetailError(
          String(
            error
              ?.message ||
            error
          )
        );
      } finally {
        if (
          detailRequestRef
            .current ===
          requestId
        ) {
          setDetailLoading(
            false
          );
        }
      }
    },
      [
        fetchReferencedPlatformReleases,
      ]
    );

  useEffect(
    () => {
      const id =
        cleanString(
          selectionRequest
            ?.id
        );


      if (!id) {
        return;
      }


      selectVariant(
        id
      );
    },
    [
      selectionRequest,
      selectVariant,
    ]
  );


  const loadMoreActivations =
    async () => {
      const id =
        cleanString(
          selectedProfileVariantId
        );


      if (
        !id ||
        !activationNextToken ||
        activationMoreBusy
      ) {
        return;
      }


      const requestId =
        detailRequestRef
          .current;


      setActivationMoreBusy(
        true
      );

      setDetailError(
        ""
      );


      try {
        const result =
          await listProfileActivations({
            profileVariantId:
              id,

            limit:
              HISTORY_PAGE_SIZE,

            nextToken:
              activationNextToken,
          });


        if (
          detailRequestRef
            .current !==
          requestId
        ) {
          return;
        }


        const nextItems =
          Array.isArray(
            result
              ?.activations
          )
            ? result.activations
            : [];


        setActivations(
          (
            current
          ) => [
            ...current,
            ...nextItems,
          ]
        );


        setActivationNextToken(
          result
            ?.nextToken ||
          null
        );
      } catch (
        error
      ) {
        if (
          detailRequestRef
            .current ===
          requestId
        ) {
          setDetailError(
            String(
              error
                ?.message ||
              error
            )
          );
        }
      } finally {
        if (
          detailRequestRef
            .current ===
          requestId
        ) {
          setActivationMoreBusy(
            false
          );
        }
      }
    };


  const loadMoreConfigurations =
    async () => {
      const id =
        cleanString(
          selectedProfileVariantId
        );


      if (
        !id ||
        !configurationNextToken ||
        configurationMoreBusy
      ) {
        return;
      }


      const requestId =
        detailRequestRef
          .current;


      setConfigurationMoreBusy(
        true
      );

      setDetailError(
        ""
      );


      try {
        const result =
          await listDeploymentConfigurations({
            profileVariantId:
              id,

            limit:
              HISTORY_PAGE_SIZE,

            nextToken:
              configurationNextToken,
          });


        if (
          detailRequestRef
            .current !==
          requestId
        ) {
          return;
        }


        const nextItems =
          Array.isArray(
            result
              ?.configurations
          )
            ? result.configurations
            : [];


        const nextReleases =
          await fetchReferencedPlatformReleases(
            nextItems,
            platformReleases
          );


        if (
          detailRequestRef
            .current !==
          requestId
        ) {
          return;
        }


        setConfigurations(
          (
            current
          ) => [
            ...current,
            ...nextItems,
          ]
        );


        setPlatformReleases(
          (
            current
          ) => [
            ...current,
            ...nextReleases,
          ]
        );


        setConfigurationNextToken(
          result
            ?.nextToken ||
          null
        );
      } catch (
        error
      ) {
        if (
          detailRequestRef
            .current ===
          requestId
        ) {
          setDetailError(
            String(
              error
                ?.message ||
              error
            )
          );
        }
      } finally {
        if (
          detailRequestRef
            .current ===
          requestId
        ) {
          setConfigurationMoreBusy(
            false
          );
        }
      }
    };


  return (
    <div
      className={cx(
        CARD_SURFACE,
        CARD_ROUNDED_2XL
      )}
      data-testid="profile-variant-catalog-panel"
    >
      <div className="px-6 py-4 border-b border-gray-200/70 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
            Profile Variant history
          </h3>

          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-3xl">
            Browse immutable published Profile Variants, their activation history, and the Platform configurations in which they were used.
            This view is read-only and never changes the ACTIVE Profile.
          </p>
        </div>

        <SmallButton
          onClick={
            loadInitialCatalog
          }
          disabled={
            catalogLoading
          }
        >
          {catalogLoading
            ? "Refreshing…"
            : "Refresh catalog"}
        </SmallButton>
      </div>


      <div className="px-6 py-5 space-y-5">
        {catalogError ? (
          <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
            {catalogError}
          </div>
        ) : null}


        {catalogLoading ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Loading Profile Variant catalog…
          </div>
        ) : catalogRows.length ? (
          <div className="rounded-xl border border-gray-200/70 dark:border-white/10 overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-gray-100/90 dark:bg-[#121224]/90 border-b border-gray-200/70 dark:border-white/10">
                  <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                    <th className="py-3 px-4 font-semibold">
                      Status
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Profile Variant ID
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Targeting
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Schema
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Created
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Content hash
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {catalogRows.map(
                    (
                      row
                    ) => {
                      const selected =
                        row.profileVariantId ===
                        selectedProfileVariantId;


                      return (
                        <tr
                          key={
                            row.profileVariantId
                          }
                          onClick={() =>
                            selectVariant(
                              row.profileVariantId
                            )
                          }
                          className={cx(
                            "border-t border-gray-200/60 dark:border-white/10",
                            "cursor-pointer transition-colors",
                            "hover:bg-gray-100/50 dark:hover:bg-white/5",
                            selected
                              ? "bg-purple-50/70 dark:bg-purple-500/10"
                              : ""
                          )}
                        >
                          <td className="py-3 px-4">
                            {row.isActive ? (
                              <Badge tone="active">
                                Active
                              </Badge>
                            ) : (
                              <Badge>
                                Historical
                              </Badge>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-xs text-gray-800 dark:text-gray-200">
                            {row.profileVariantId}
                          </td>

                          <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300">
                            {targetingLabel(
                              row.targeting
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300">
                            v{
                              row.contentSchemaVersion ??
                              "—"
                            }
                          </td>

                          <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {formatTimestamp(
                              row.createdAt
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-gray-600 dark:text-gray-400">
                            {displayValue(
                              row.contentHash
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {catalogNextToken ? (
              <div className="px-4 py-3 border-t border-gray-200/70 dark:border-white/10">
                <SmallButton
                  onClick={
                    loadMoreCatalog
                  }
                  disabled={
                    catalogMoreBusy
                  }
                >
                  {catalogMoreBusy
                    ? "Loading…"
                    : "Load more Profile Variants"}
                </SmallButton>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              No published Profile Variants were found.
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              This catalog populates after an immutable Profile Variant is
              published to this environment.
            </div>
          </div>
        )}


        {selectedProfileVariantId ? (
          <div className="pt-2 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Selected Profile Variant
              </div>

              <Badge tone="purple">
                {selectedProfileVariantId}
              </Badge>

              {historyModel
                ?.isActive ? (
                <Badge tone="active">
                  Active
                </Badge>
              ) : null}
            </div>


            {detailLoading ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Loading Profile Variant history…
              </div>
            ) : detailError ? (
              <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {detailError}
              </div>
            ) : historyModel ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 p-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Immutable Profile Variant
                  </div>

                  <MetadataRow
                    label="Profile Variant ID"
                    value={
                      historyModel
                        .profileVariantId
                    }
                    mono
                  />

                  <MetadataRow
                    label="Status"
                    value={
                      historyModel
                        .isActive
                        ? "ACTIVE"
                        : "Historical"
                    }
                  />

                  <MetadataRow
                    label="Schema ID"
                    value={
                      historyModel
                        .variant
                        ?.schemaId
                    }
                    mono
                  />

                  <MetadataRow
                    label="Content schema"
                    value={
                      historyModel
                        .variant
                        ?.contentSchemaVersion
                    }
                  />

                  <MetadataRow
                    label="Content hash"
                    value={
                      historyModel
                        .variant
                        ?.contentHash
                    }
                    mono
                  />

                  <MetadataRow
                    label="Targeting"
                    value={
                      targetingLabel(
                        historyModel
                          .variant
                          ?.targeting
                      )
                    }
                  />

                  <MetadataRow
                    label="Created at"
                    value={
                      formatTimestamp(
                        historyModel
                          .variant
                          ?.createdAt
                      )
                    }
                  />

                  <MetadataRow
                    label="Manifest SHA-256"
                    value={
                      selectedVariantResult
                        ?.manifestSha256
                    }
                    mono
                  />
                </div>


                <HistorySection
                  title="Activation history"
                  subtitle="Newest first. Each row is an immutable activation occurrence."
                  nextToken={
                    activationNextToken
                  }
                  busy={
                    activationMoreBusy
                  }
                  onLoadMore={
                    loadMoreActivations
                  }
                >
                  {historyModel
                    .activations
                    .length ? (
                    <div className="overflow-auto">
                      <table className="w-full min-w-[800px]">
                        <thead className="bg-white/60 dark:bg-white/[0.03]">
                          <tr className="text-left text-[11px] text-gray-500 dark:text-gray-400">
                            <th className="py-2.5 px-4 font-semibold">
                              Activated
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Activation ID
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Revision
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Previous Profile Variant
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {historyModel
                            .activations
                            .map(
                              (
                                activation
                              ) => (
                                <tr
                                  key={
                                    activation
                                      .activationId
                                  }
                                  className="border-t border-gray-200/60 dark:border-white/10"
                                >
                                  <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    {formatTimestamp(
                                      activation
                                        .activatedAt
                                    )}
                                  </td>

                                  <td className="py-2.5 px-4 text-[11px] font-mono text-gray-700 dark:text-gray-300">
                                    {displayValue(
                                      activation
                                        .activationId
                                    )}
                                  </td>

                                  <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300">
                                    {activation
                                      .revision ??
                                      "—"}
                                  </td>

                                  <td className="py-2.5 px-4 text-[11px] font-mono text-gray-700 dark:text-gray-300">
                                    {displayValue(
                                      activation
                                        .previousProfileVariantId
                                    )}
                                  </td>
                                </tr>
                              )
                            )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
                      This Profile Variant has never been activated.
                    </div>
                  )}
                </HistorySection>


                <HistorySection
                  title="Deployment Configurations"
                  subtitle="Configurations that composed this Profile Variant with a Platform Release."
                  nextToken={
                    configurationNextToken
                  }
                  busy={
                    configurationMoreBusy
                  }
                  onLoadMore={
                    loadMoreConfigurations
                  }
                >
                  {historyModel
                    .configurations
                    .length ? (
                    <div className="overflow-auto">
                      <table className="w-full min-w-[1100px]">
                        <thead className="bg-white/60 dark:bg-white/[0.03]">
                          <tr className="text-left text-[11px] text-gray-500 dark:text-gray-400">
                            <th className="py-2.5 px-4 font-semibold">
                              Created
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Configuration ID
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Platform Release
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Release schema
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              PPS
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Git SHA
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {historyModel
                            .configurations
                            .map(
                              (
                                configuration
                              ) => {
                                const release =
                                  configuration
                                    .platformRelease;


                                const ppsVersion =
                                  Number.isInteger(
                                    release
                                      ?.profileRuntime
                                      ?.ppsVersion
                                  )
                                    ? release
                                        .profileRuntime
                                        .ppsVersion
                                    : null;


                                return (
                                  <tr
                                    key={
                                      configuration
                                        .deploymentConfigurationId
                                    }
                                    className="border-t border-gray-200/60 dark:border-white/10"
                                  >
                                    <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                      {formatTimestamp(
                                        configuration
                                          .createdAt
                                      )}
                                    </td>

                                    <td className="py-2.5 px-4 text-[11px] font-mono text-gray-700 dark:text-gray-300">
                                      {displayValue(
                                        configuration
                                          .deploymentConfigurationId
                                      )}
                                    </td>

                                    <td className="py-2.5 px-4">
                                      {typeof onOpenPlatformRelease ===
                                      "function" ? (
                                        <HistoryLinkButton
                                          title="Open Platform Release history"
                                          onClick={() =>
                                            onOpenPlatformRelease(
                                              configuration
                                                .platformReleaseId
                                            )
                                          }
                                        >
                                          {displayValue(
                                            configuration
                                              .platformReleaseId
                                          )}
                                        </HistoryLinkButton>
                                      ) : (
                                        <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
                                          {displayValue(
                                            configuration
                                              .platformReleaseId
                                          )}
                                        </span>
                                      )}
                                    </td>

                                    <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300">
                                      {displayValue(
                                        release
                                          ?.schemaId
                                      )}
                                    </td>

                                    <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300">
                                      {ppsLabel(
                                        ppsVersion
                                      )}
                                    </td>

                                    <td className="py-2.5 px-4 text-[11px] font-mono text-gray-700 dark:text-gray-300">
                                      {displayValue(
                                        release
                                          ?.source
                                          ?.gitSha
                                      )}
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
                      No Deployment Configuration has used this Profile Variant.
                    </div>
                  )}
                </HistorySection>


                {historyModel
                  .missingPlatformReleaseIds
                  .length ? (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    Missing authoritative Platform Releases:{" "}
                    {historyModel
                      .missingPlatformReleaseIds
                      .join(
                        ", "
                      )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Select a Profile Variant above to inspect its immutable metadata and history.
          </div>
        )}
      </div>
    </div>
  );
}