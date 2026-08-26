// src/components/admin/PlatformReleaseCatalogPanel.js

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
  listPlatformDeployments,
  listPlatformReleases,
} from "../../utils/snapshots/controlPlaneCatalogApi";

import {
  buildPlatformReleaseCatalogRows,
  buildPlatformReleaseHistoryModel,
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


export default function PlatformReleaseCatalogPanel({
  activePlatformReleaseId =
    "",

  selectionRequest =
    null,

  onOpenProfileVariant,
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
    selectedPlatformReleaseId,
    setSelectedPlatformReleaseId,
  ] =
    useState(
      ""
    );


  const [
    selectedReleaseResult,
    setSelectedReleaseResult,
  ] =
    useState(
      null
    );


  const [
    deployments,
    setDeployments,
  ] =
    useState(
      []
    );


  const [
    deploymentNextToken,
    setDeploymentNextToken,
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
    profileVariants,
    setProfileVariants,
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
    deploymentMoreBusy,
    setDeploymentMoreBusy,
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
   * Protect selection from stale async responses.
   */
  const detailRequestRef =
    useRef(
      0
    );


  const catalogRows =
    useMemo(
      () =>
        buildPlatformReleaseCatalogRows({
          releases:
            catalog,

          activePlatformReleaseId,
        }),
      [
        catalog,
        activePlatformReleaseId,
      ]
    );


  const historyModel =
    useMemo(
      () => {
        const release =
          selectedReleaseResult
            ?.release;


        if (!release) {
          return null;
        }


        return buildPlatformReleaseHistoryModel({
          release,

          activePlatformReleaseId,

          deployments,

          configurations,

          profileVariants,
        });
      },
      [
        selectedReleaseResult,
        activePlatformReleaseId,
        deployments,
        configurations,
        profileVariants,
      ]
    );


  const fetchReferencedProfileVariants =
    useCallback(
      async (
        configurationItems,
        existingVariants =
          []
      ) => {
        const existingIds =
          new Set(
            (
              existingVariants ||
              []
            )
              .map(
                (
                  variant
                ) =>
                  cleanString(
                    variant
                      ?.profileVariantId
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
                        ?.profileVariantId
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
                getProfileVariant(
                  id
                )
            )
          );


        return results.map(
          (
            result
          ) =>
            result.variant
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
            await listPlatformReleases({
              limit:
                CATALOG_PAGE_SIZE,
            });


          setCatalog(
            Array.isArray(
              result
                ?.releases
            )
              ? result.releases
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
          await listPlatformReleases({
            limit:
              CATALOG_PAGE_SIZE,

            nextToken:
              catalogNextToken,
          });


        const nextItems =
          Array.isArray(
            result
              ?.releases
          )
            ? result.releases
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


  const selectRelease =
    useCallback(
      async (
        platformReleaseId
      ) => {
        const id =
          cleanString(
            platformReleaseId
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


        setSelectedPlatformReleaseId(
          id
        );

        setSelectedReleaseResult(
          null
        );

        setDeployments(
          []
        );

        setDeploymentNextToken(
          null
        );

        setConfigurations(
          []
        );

        setConfigurationNextToken(
          null
        );

        setProfileVariants(
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
            releaseResult,
            deploymentResult,
            configurationResult,
          ] =
            await Promise.all([
              getPlatformRelease(
                id
              ),

              listPlatformDeployments({
                platformReleaseId:
                  id,

                limit:
                  HISTORY_PAGE_SIZE,
              }),

              listDeploymentConfigurations({
                platformReleaseId:
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


          const loadedDeployments =
            Array.isArray(
              deploymentResult
                ?.deployments
            )
              ? deploymentResult
                  .deployments
              : [];


          const loadedConfigurations =
            Array.isArray(
              configurationResult
                ?.configurations
            )
              ? configurationResult
                  .configurations
              : [];


          const loadedVariants =
            await fetchReferencedProfileVariants(
              loadedConfigurations
            );


          if (
            detailRequestRef
              .current !==
            requestId
          ) {
            return;
          }


          setSelectedReleaseResult(
            releaseResult
          );

          setDeployments(
            loadedDeployments
          );

          setDeploymentNextToken(
            deploymentResult
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

          setProfileVariants(
            loadedVariants
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
        fetchReferencedProfileVariants,
      ]
    );


  /**
   * Cross-navigation can target a release even if that release is not
   * currently visible in this catalog page.
   *
   * requestId allows the same identity to be requested repeatedly
   * after the owner manually selects another release.
   */
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


      selectRelease(
        id
      );
    },
    [
      selectionRequest,
      selectRelease,
    ]
  );


  const loadMoreDeployments =
    async () => {
      const id =
        cleanString(
          selectedPlatformReleaseId
        );


      if (
        !id ||
        !deploymentNextToken ||
        deploymentMoreBusy
      ) {
        return;
      }


      const requestId =
        detailRequestRef
          .current;


      setDeploymentMoreBusy(
        true
      );

      setDetailError(
        ""
      );


      try {
        const result =
          await listPlatformDeployments({
            platformReleaseId:
              id,

            limit:
              HISTORY_PAGE_SIZE,

            nextToken:
              deploymentNextToken,
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
              ?.deployments
          )
            ? result.deployments
            : [];


        setDeployments(
          (
            current
          ) => [
            ...current,
            ...nextItems,
          ]
        );


        setDeploymentNextToken(
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
          setDeploymentMoreBusy(
            false
          );
        }
      }
    };


  const loadMoreConfigurations =
    async () => {
      const id =
        cleanString(
          selectedPlatformReleaseId
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
            platformReleaseId:
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


        const nextVariants =
          await fetchReferencedProfileVariants(
            nextItems,
            profileVariants
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


        setProfileVariants(
          (
            current
          ) => [
            ...current,
            ...nextVariants,
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
      data-testid="platform-release-catalog-panel"
    >
      <div className="px-6 py-4 border-b border-gray-200/70 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
            Platform Release history
          </h3>

          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-3xl">
            Browse immutable Platform Releases, deployment occurrences, and the Profile configurations in which each release participated.
            This view is read-only and never changes the ACTIVE Platform Release.
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
            Loading Platform Release catalog…
          </div>
        ) : catalogRows.length ? (
          <div className="rounded-xl border border-gray-200/70 dark:border-white/10 overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full min-w-[1150px] text-sm">
                <thead className="bg-gray-100/90 dark:bg-[#121224]/90 border-b border-gray-200/70 dark:border-white/10">
                  <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                    <th className="py-3 px-4 font-semibold">
                      Status
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Platform Release ID
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Schema
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      PPS
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Stage
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Build time
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Git SHA
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {catalogRows.map(
                    (
                      row
                    ) => {
                      const selected =
                        row.platformReleaseId ===
                        selectedPlatformReleaseId;


                      return (
                        <tr
                          key={
                            row.platformReleaseId
                          }
                          onClick={() =>
                            selectRelease(
                              row.platformReleaseId
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
                            {row.platformReleaseId}
                          </td>

                          <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300">
                            {displayValue(
                              row.schemaId
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300">
                            {ppsLabel(
                              row.ppsVersion
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300">
                            {displayValue(
                              row.stage
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {formatTimestamp(
                              row.buildTime
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-gray-600 dark:text-gray-400">
                            {displayValue(
                              row.source
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
                    : "Load more Platform Releases"}
                </SmallButton>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              No registered Platform Releases were found.
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              This catalog populates after the formal deployment workflow
              registers an immutable Platform Release for this environment.
            </div>
          </div>
        )}


        {selectedPlatformReleaseId ? (
          <div className="pt-2 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Selected Platform Release
              </div>

              <Badge tone="purple">
                {selectedPlatformReleaseId}
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
                Loading Platform Release history…
              </div>
            ) : detailError ? (
              <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {detailError}
              </div>
            ) : historyModel ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 p-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Immutable Platform Release
                  </div>

                  <MetadataRow
                    label="Platform Release ID"
                    value={
                      historyModel
                        .platformReleaseId
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
                        .release
                        ?.schemaId
                    }
                    mono
                  />

                  <MetadataRow
                    label="PPS qualification"
                    value={
                      ppsLabel(
                        historyModel
                          .ppsVersion
                      )
                    }
                  />

                  <MetadataRow
                    label="Stage"
                    value={
                      historyModel
                        .release
                        ?.stage
                    }
                  />

                  <MetadataRow
                    label="Created at"
                    value={
                      formatTimestamp(
                        historyModel
                          .release
                          ?.createdAt
                      )
                    }
                  />

                  <MetadataRow
                    label="Repository"
                    value={
                      historyModel
                        .release
                        ?.source
                        ?.repository
                    }
                    mono
                  />

                  <MetadataRow
                    label="Git SHA"
                    value={
                      historyModel
                        .release
                        ?.source
                        ?.gitSha
                    }
                    mono
                  />

                  <MetadataRow
                    label="Git ref"
                    value={
                      historyModel
                        .release
                        ?.source
                        ?.gitRef
                    }
                    mono
                  />

                  <MetadataRow
                    label="Checkpoint tag"
                    value={
                      historyModel
                        .release
                        ?.source
                        ?.checkpointTag
                    }
                    mono
                  />

                  <MetadataRow
                    label="Build time"
                    value={
                      formatTimestamp(
                        historyModel
                          .release
                          ?.build
                          ?.buildTime
                      )
                    }
                  />

                  <MetadataRow
                    label="Frontend artifact SHA-256"
                    value={
                      historyModel
                        .release
                        ?.build
                        ?.frontendArtifactSha256
                    }
                    mono
                  />

                  <MetadataRow
                    label="Release SHA-256"
                    value={
                      selectedReleaseResult
                        ?.releaseSha256
                    }
                    mono
                  />
                </div>


                <HistorySection
                  title="Platform Deployment history"
                  subtitle="Newest first. Each row is one immutable Platform Deployment occurrence."
                  nextToken={
                    deploymentNextToken
                  }
                  busy={
                    deploymentMoreBusy
                  }
                  onLoadMore={
                    loadMoreDeployments
                  }
                >
                  {historyModel
                    .deployments
                    .length ? (
                    <div className="overflow-auto">
                      <table className="w-full min-w-[1000px]">
                        <thead className="bg-white/60 dark:bg-white/[0.03]">
                          <tr className="text-left text-[11px] text-gray-500 dark:text-gray-400">
                            <th className="py-2.5 px-4 font-semibold">
                              Deployed
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Deployment ID
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Revision
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Previous Platform Release
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Release SHA-256
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {historyModel
                            .deployments
                            .map(
                              (
                                deployment
                              ) => (
                                <tr
                                  key={
                                    deployment
                                      .deploymentId
                                  }
                                  className="border-t border-gray-200/60 dark:border-white/10"
                                >
                                  <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    {formatTimestamp(
                                      deployment
                                        .deployedAt
                                    )}
                                  </td>

                                  <td className="py-2.5 px-4 text-[11px] font-mono text-gray-700 dark:text-gray-300">
                                    {displayValue(
                                      deployment
                                        .deploymentId
                                    )}
                                  </td>

                                  <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300">
                                    {deployment
                                      .revision ??
                                      "—"}
                                  </td>

                                  <td className="py-2.5 px-4 text-[11px] font-mono text-gray-700 dark:text-gray-300">
                                    {displayValue(
                                      deployment
                                        .previousPlatformReleaseId
                                    )}
                                  </td>

                                  <td className="py-2.5 px-4 text-[11px] font-mono text-gray-700 dark:text-gray-300">
                                    {displayValue(
                                      deployment
                                        .platformReleaseSha256
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
                      This Platform Release has never been formally deployed.
                    </div>
                  )}
                </HistorySection>


                <HistorySection
                  title="Deployment Configurations"
                  subtitle="Configurations that composed this Platform Release with an immutable Profile Variant."
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
                      <table className="w-full min-w-[1150px]">
                        <thead className="bg-white/60 dark:bg-white/[0.03]">
                          <tr className="text-left text-[11px] text-gray-500 dark:text-gray-400">
                            <th className="py-2.5 px-4 font-semibold">
                              Created
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Configuration ID
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Profile Variant
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Targeting
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Content schema
                            </th>

                            <th className="py-2.5 px-4 font-semibold">
                              Content hash
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {historyModel
                            .configurations
                            .map(
                              (
                                configuration
                              ) => (
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
                                    {typeof onOpenProfileVariant ===
                                    "function" ? (
                                      <HistoryLinkButton
                                        title="Open Profile Variant history"
                                        onClick={() =>
                                          onOpenProfileVariant(
                                            configuration
                                              .profileVariantId
                                          )
                                        }
                                      >
                                        {displayValue(
                                          configuration
                                            .profileVariantId
                                        )}
                                      </HistoryLinkButton>
                                    ) : (
                                      <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
                                        {displayValue(
                                          configuration
                                            .profileVariantId
                                        )}
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300">
                                    {targetingLabel(
                                      configuration
                                        .targeting
                                    )}
                                  </td>

                                  <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300">
                                    {configuration
                                      .contentSchemaVersion ??
                                      "—"}
                                  </td>

                                  <td className="py-2.5 px-4 text-[11px] font-mono text-gray-700 dark:text-gray-300">
                                    {displayValue(
                                      configuration
                                        .contentHash
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
                      No Deployment Configuration has used this Platform Release.
                    </div>
                  )}
                </HistorySection>


                {historyModel
                  .missingProfileVariantIds
                  .length ? (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    Missing authoritative Profile Variants:{" "}
                    {historyModel
                      .missingProfileVariantIds
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
            Select a Platform Release above to inspect its immutable build provenance and deployment history.
          </div>
        )}
      </div>
    </div>
  );
}