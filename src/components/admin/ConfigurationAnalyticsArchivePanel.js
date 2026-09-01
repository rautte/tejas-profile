import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getConfigurationAnalyticsReport,
  listUsageEpochs,
} from "../../utils/analytics/analyticsApi";

import {
  CONFIGURATION_ANALYTICS_TRAFFIC_OPTIONS,
  DEFAULT_CONFIGURATION_ANALYTICS_TRAFFIC,
  buildConfigurationAnalyticsArchiveDetail,
  buildUsageEpochArchiveRows,
  selectConfigurationAnalyticsArchiveTraffic,
} from "../../utils/analytics/configurationAnalyticsArchiveViewModel";

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../../utils/ui";

import {
  cx,
} from "../../utils/cx";

import {
  Badge,
  displayValue,
  formatTimestamp,
  HistorySection,
  MetadataRow,
  SmallButton,
} from "./controlPlaneCatalogUi";


const PAGE_SIZE =
  25;


function formatNumber(
  value
) {
  return new Intl
    .NumberFormat()
    .format(
      Number(
        value ||
        0
      )
    );
}


function formatDuration(
  ms
) {
  const value =
    Math.max(
      0,
      Number(
        ms ||
        0
      )
    );


  if (
    value < 1000
  ) {
    return `${Math.round(
      value
    )}ms`;
  }


  const seconds =
    value /
    1000;


  if (
    seconds < 60
  ) {
    return `${seconds.toFixed(
      seconds < 10
        ? 1
        : 0
    )}s`;
  }


  const minutes =
    seconds /
    60;


  if (
    minutes < 60
  ) {
    return `${minutes.toFixed(
      minutes < 10
        ? 1
        : 0
    )}m`;
  }


  const hours =
    minutes /
    60;


  return `${hours.toFixed(
    hours < 10
      ? 1
      : 0
  )}h`;
}


function stateTone(
  state
) {
  if (
    state ===
      "OPEN"
  ) {
    return "active";
  }


  if (
    state ===
      "CLOSING"
  ) {
    return "warning";
  }


  return "purple";
}


function occurrenceLabel(
  occurrence
) {
  const kind =
    String(
      occurrence
        ?.kind ||
        ""
    ).trim();

  const id =
    String(
      occurrence
        ?.occurrenceId ||
        ""
    ).trim();


  return [
    kind,
    id,
  ]
    .filter(
      Boolean
    )
    .join(
      " · "
    ) ||
    "—";
}


function ArchiveKpi({
  label,
  value,
  sub,
}) {
  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
        {label}
      </div>

      <div className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 break-words">
        {value}
      </div>

      {sub ? (
        <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
          {sub}
        </div>
      ) : null}
    </div>
  );
}


function ArchivedDepthMilestones({
  milestones,
}) {
  const rows =
    Array.isArray(
      milestones
    )
      ? milestones
      : [];


  if (!rows.length) {
    return (
      <div className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
        No scroll-depth milestones were recorded.
      </div>
    );
  }


  const depths = [
    25,
    50,
    75,
    100,
  ];


  const sectionNames =
    Array.from(
      new Set(
        rows
          .map(
            (
              item
            ) =>
              String(
                item
                  ?.section ||
                  ""
              ).trim()
          )
          .filter(
            Boolean
          )
      )
    );


  const bySection =
    new Map();


  for (
    const item of
      rows
  ) {
    const section =
      String(
        item
          ?.section ||
          ""
      ).trim();

    const depthPct =
      Number(
        item
          ?.depthPct
      );


    if (
      !section ||
      !depths.includes(
        depthPct
      )
    ) {
      continue;
    }


    if (
      !bySection.has(
        section
      )
    ) {
      bySection.set(
        section,
        new Map()
      );
    }


    bySection
      .get(
        section
      )
      .set(
        depthPct,
        item
      );
  }


  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[760px]">
        <thead className="bg-white/60 dark:bg-white/[0.03]">
          <tr className="text-left text-[11px] text-gray-500 dark:text-gray-400">
            <th className="py-2.5 px-4 font-semibold">
              Section
            </th>

            {depths.map(
              (
                depth
              ) => (
                <th
                  key={
                    depth
                  }
                  className="py-2.5 px-4 font-semibold text-center"
                >
                  {depth}%
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {sectionNames.map(
            (
              section
            ) => (
              <tr
                key={
                  section
                }
                className="border-t border-gray-200/60 dark:border-white/10"
              >
                <td className="py-3 px-4 text-xs font-medium text-gray-800 dark:text-gray-200">
                  {section}
                </td>

                {depths.map(
                  (
                    depth
                  ) => {
                    const item =
                      bySection
                        .get(
                          section
                        )
                        ?.get(
                          depth
                        );


                    return (
                      <td
                        key={
                          depth
                        }
                        className="py-3 px-4 text-center"
                      >
                        {item ? (
                          <div>
                            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                              {formatNumber(
                                item
                                  .visitors
                              )}{" "}
                              visitors
                            </div>

                            <div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                              {formatNumber(
                                item
                                  .sessions
                              )}{" "}
                              sessions
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            —
                          </span>
                        )}
                      </td>
                    );
                  }
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}


function InteractionTable({
  rows,
  idKey,
  emptyText,
}) {
  if (
    !rows.length
  ) {
    return (
      <div className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
        {emptyText}
      </div>
    );
  }


  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[620px]">
        <thead className="bg-white/60 dark:bg-white/[0.03]">
          <tr className="text-left text-[11px] text-gray-500 dark:text-gray-400">
            <th className="py-2.5 px-4 font-semibold">
              Item
            </th>

            <th className="py-2.5 px-4 font-semibold text-right">
              Actions
            </th>

            <th className="py-2.5 px-4 font-semibold text-right">
              Visitors
            </th>

            <th className="py-2.5 px-4 font-semibold text-right">
              Sessions
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              row
            ) => (
              <tr
                key={
                  row[
                    idKey
                  ]
                }
                className="border-t border-gray-200/60 dark:border-white/10"
              >
                <td className="py-2.5 px-4 font-mono text-[11px] text-gray-800 dark:text-gray-200 break-all">
                  {displayValue(
                    row[
                      idKey
                    ]
                  )}
                </td>

                <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(
                    row.count
                  )}
                </td>

                <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(
                    row.visitors
                  )}
                </td>

                <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(
                    row.sessions
                  )}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}


export default function ConfigurationAnalyticsArchivePanel() {
  const [
    lifecycleState,
    setLifecycleState,
  ] =
    useState(
      "CLOSED"
    );


  const [
    configurationDraft,
    setConfigurationDraft,
  ] =
    useState(
      ""
    );


  const [
    configurationFilter,
    setConfigurationFilter,
  ] =
    useState(
      ""
    );


  const [
    epochs,
    setEpochs,
  ] =
    useState(
      []
    );


  const [
    nextToken,
    setNextToken,
  ] =
    useState(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    moreBusy,
    setMoreBusy,
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


  const [
    selectedEpochId,
    setSelectedEpochId,
  ] =
    useState(
      ""
    );


  const [
    detail,
    setDetail,
  ] =
    useState(
      null
    );


  const [
    detailLoading,
    setDetailLoading,
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


  const [
    archiveTrafficClassification,
    setArchiveTrafficClassification,
  ] =
    useState(
      DEFAULT_CONFIGURATION_ANALYTICS_TRAFFIC
    );


  const detailRequestRef =
    useRef(
      0
    );


  const rows =
    useMemo(
      () =>
        buildUsageEpochArchiveRows({
          epochs,
        }),
      [
        epochs,
      ]
    );


  const selectedEpoch =
    useMemo(
      () =>
        rows.find(
          (
            row
          ) =>
            row
              .usageEpochId ===
            selectedEpochId
        ) ||
        null,
      [
        rows,
        selectedEpochId,
      ]
    );


  const loadInitial =
    useCallback(
      async () => {
        detailRequestRef
          .current +=
          1;

        setLoading(
          true
        );

        setError(
          ""
        );

        setSelectedEpochId(
          ""
        );

        setDetail(
          null
        );

        setArchiveTrafficClassification(
          DEFAULT_CONFIGURATION_ANALYTICS_TRAFFIC
        );

        setDetailError(
          ""
        );


        try {
          const result =
            await listUsageEpochs({
              state:
                configurationFilter
                  ? undefined
                  : lifecycleState,

              deploymentConfigurationId:
                configurationFilter ||
                undefined,

              limit:
                PAGE_SIZE,
            });


          setEpochs(
            Array.isArray(
              result
                ?.epochs
            )
              ? result.epochs
              : []
          );


          setNextToken(
            result
              ?.nextToken ||
            null
          );
        } catch (
          exception
        ) {
          setEpochs(
            []
          );

          setNextToken(
            null
          );

          setError(
            String(
              exception
                ?.message ||
              exception
            )
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        configurationFilter,
        lifecycleState,
      ]
    );


  useEffect(
    () => {
      loadInitial();
    },
    [
      loadInitial,
    ]
  );


  const loadMore =
    async () => {
      if (
        !nextToken ||
        moreBusy
      ) {
        return;
      }


      setMoreBusy(
        true
      );

      setError(
        ""
      );


      try {
        const result =
          await listUsageEpochs({
            state:
              configurationFilter
                ? undefined
                : lifecycleState,

            deploymentConfigurationId:
              configurationFilter ||
              undefined,

            limit:
              PAGE_SIZE,

            nextToken,
          });


        const nextRows =
          Array.isArray(
            result
              ?.epochs
          )
            ? result.epochs
            : [];


        setEpochs(
          (
            current
          ) => {
            const byId =
              new Map(
                current.map(
                  (
                    epoch
                  ) => [
                    epoch
                      .usageEpochId,
                    epoch,
                  ]
                )
              );


            for (
              const epoch of
                nextRows
            ) {
              byId.set(
                epoch
                  .usageEpochId,
                epoch
              );
            }


            return [
              ...byId.values(),
            ];
          }
        );


        setNextToken(
          result
            ?.nextToken ||
          null
        );
      } catch (
        exception
      ) {
        setError(
          String(
            exception
              ?.message ||
            exception
          )
        );
      } finally {
        setMoreBusy(
          false
        );
      }
    };


  const selectEpoch =
    useCallback(
      async (
        row
      ) => {
        const id =
          String(
            row
              ?.usageEpochId ||
              ""
          ).trim();


        if (!id) {
          return;
        }


        const requestId =
          detailRequestRef
            .current +
          1;


        detailRequestRef.current =
          requestId;


        setSelectedEpochId(
          id
        );

        setDetail(
          null
        );

        setArchiveTrafficClassification(
          DEFAULT_CONFIGURATION_ANALYTICS_TRAFFIC
        );

        setDetailError(
          ""
        );


        if (
          !row.reportReady
        ) {
          setDetailLoading(
            false
          );

          return;
        }


        setDetailLoading(
          true
        );


        try {
          const response =
            await getConfigurationAnalyticsReport({
              usageEpochId:
                id,
            });


          if (
            detailRequestRef
              .current !==
            requestId
          ) {
            return;
          }


          const nextDetail =
            buildConfigurationAnalyticsArchiveDetail(
              response
            );


          const initialTraffic =
            nextDetail
              ?.traffic
              ?.selectedClassification ||
            (
              nextDetail
                ?.traffic
                ?.supported
                ? DEFAULT_CONFIGURATION_ANALYTICS_TRAFFIC
                : "all"
            );


          setArchiveTrafficClassification(
            initialTraffic
          );


          setDetail(
            nextDetail
          );
        } catch (
          exception
        ) {
          if (
            detailRequestRef
              .current ===
            requestId
          ) {
            setDetailError(
              String(
                exception
                  ?.message ||
                exception
              )
            );
          }
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
      []
    );


  const changeArchiveTrafficClassification =
    (
      event
    ) => {
      const next =
        String(
          event
            ?.target
            ?.value ||
            ""
        ).trim();


      if (
        !detail
      ) {
        return;
      }


      const selected =
        selectConfigurationAnalyticsArchiveTraffic(
          detail,
          next
        );


      setArchiveTrafficClassification(
        selected
          .traffic
          .selectedClassification
      );


      setDetail(
        selected
      );
    };


  const applyConfigurationFilter =
    () => {
      setConfigurationFilter(
        String(
          configurationDraft ||
            ""
        ).trim()
      );
    };


  const clearConfigurationFilter =
    () => {
      setConfigurationDraft(
        ""
      );

      setConfigurationFilter(
        ""
      );
    };


  const overview =
    detail
      ?.overview ||
    {};


  return (
    <div
      className={cx(
        CARD_SURFACE,
        CARD_ROUNDED_2XL
      )}
      data-testid="configuration-analytics-archive-panel"
    >
      <div className="px-5 sm:px-6 py-4 border-b border-gray-200/70 dark:border-white/10 flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
            Configuration Analytics archive
          </h3>

          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-3xl">
            Immutable Analytics reports finalized per Usage Epoch.
            Each interval is bound to one exact Deployment Configuration,
            Platform Release and Profile Variant.
          </p>
        </div>

        <SmallButton
          onClick={
            loadInitial
          }
          disabled={
            loading
          }
        >
          {loading
            ? "Refreshing…"
            : "Refresh archive"}
        </SmallButton>
      </div>


      <div className="px-5 sm:px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_auto] gap-3 items-end">
          <label>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
              Lifecycle state
            </div>

            <select
              aria-label="Usage Epoch lifecycle state"
              value={
                lifecycleState
              }
              disabled={
                Boolean(
                  configurationFilter
                )
              }
              onChange={(
                event
              ) =>
                setLifecycleState(
                  event
                    .target
                    .value
                )
              }
              className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none disabled:opacity-50"
            >
              <option value="CLOSED">
                Archived / CLOSED
              </option>

              <option value="CLOSING">
                Finalizing / CLOSING
              </option>

              <option value="OPEN">
                Current / OPEN
              </option>
            </select>
          </label>


          <label>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
              Deployment Configuration
            </div>

            <input
              aria-label="Deployment Configuration filter"
              type="text"
              value={
                configurationDraft
              }
              onChange={(
                event
              ) =>
                setConfigurationDraft(
                  event
                    .target
                    .value
                )
              }
              placeholder="Optional cfg_… exact history"
              className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 outline-none"
            />

            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Applying a Configuration ID switches to its recurrence history across Usage Epochs.
            </div>
          </label>


          <div className="flex flex-wrap gap-2">
            <SmallButton
              onClick={
                applyConfigurationFilter
              }
            >
              Apply configuration
            </SmallButton>

            {configurationFilter ? (
              <SmallButton
                onClick={
                  clearConfigurationFilter
                }
              >
                Clear
              </SmallButton>
            ) : null}
          </div>
        </div>


        {configurationFilter ? (
          <div className="rounded-lg border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/60 dark:bg-purple-500/10 px-3 py-2 text-xs text-purple-800 dark:text-purple-200 break-all">
            Configuration recurrence history:{" "}
            <span className="font-mono font-semibold">
              {configurationFilter}
            </span>
          </div>
        ) : null}


        {error ? (
          <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
            {error}
          </div>
        ) : null}


        {loading ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Loading Usage Epoch archive…
          </div>
        ) : rows.length ? (
          <div className="rounded-xl border border-gray-200/70 dark:border-white/10 overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full min-w-[1250px] text-sm">
                <thead className="bg-gray-100/90 dark:bg-[#121224]/90 border-b border-gray-200/70 dark:border-white/10">
                  <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                    <th className="py-3 px-4 font-semibold">
                      State
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Started
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Ended
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Usage Epoch
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Configuration
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Profile Variant
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Platform Release
                    </th>

                    <th className="py-3 px-4 font-semibold">
                      Report
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map(
                    (
                      row
                    ) => {
                      const selected =
                        selectedEpochId ===
                        row
                          .usageEpochId;


                      return (
                        <tr
                          key={
                            row
                              .usageEpochId
                          }
                          onClick={() =>
                            selectEpoch(
                              row
                            )
                          }
                          className={cx(
                            "border-t border-gray-200/60 dark:border-white/10 cursor-pointer transition-colors",
                            "hover:bg-gray-100/50 dark:hover:bg-white/5",
                            selected
                              ? "bg-purple-50/70 dark:bg-purple-500/10"
                              : ""
                          )}
                        >
                          <td className="py-3 px-4">
                            <Badge
                              tone={
                                stateTone(
                                  row.state
                                )
                              }
                            >
                              {row.state}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {formatTimestamp(
                              row.startedAt
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {formatTimestamp(
                              row.endedAt
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-purple-700 dark:text-purple-300">
                            {row
                              .usageEpochId}
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                            {displayValue(
                              row
                                .deploymentConfigurationId
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                            {displayValue(
                              row
                                .profileVariantId
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                            {displayValue(
                              row
                                .platformReleaseId
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {row.reportReady ? (
                              <Badge tone="purple">
                                Immutable
                              </Badge>
                            ) : (
                              <Badge>
                                Pending
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {nextToken ? (
              <div className="px-4 py-3 border-t border-gray-200/70 dark:border-white/10">
                <SmallButton
                  onClick={
                    loadMore
                  }
                  disabled={
                    moreBusy
                  }
                >
                  {moreBusy
                    ? "Loading…"
                    : "Load more Usage Epochs"}
                </SmallButton>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300/80 dark:border-white/15 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {configurationFilter
              ? "No Usage Epochs were found for this Deployment Configuration."
              : `No ${lifecycleState} Usage Epochs were found.`}
          </div>
        )}


        {selectedEpoch ? (
          <div className="pt-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Selected Usage Epoch
              </div>

              <Badge tone="purple">
                {selectedEpoch
                  .usageEpochId}
              </Badge>

              <Badge
                tone={
                  stateTone(
                    selectedEpoch
                      .state
                  )
                }
              >
                {selectedEpoch
                  .state}
              </Badge>
            </div>


            <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 p-4 space-y-2">
              <MetadataRow
                label="Usage Epoch ID"
                value={
                  selectedEpoch
                    .usageEpochId
                }
                mono
              />

              <MetadataRow
                label="Deployment Configuration"
                value={
                  selectedEpoch
                    .deploymentConfigurationId
                }
                mono
              />

              <MetadataRow
                label="Platform Release"
                value={
                  selectedEpoch
                    .platformReleaseId
                }
                mono
              />

              <MetadataRow
                label="Profile Variant"
                value={
                  selectedEpoch
                    .profileVariantId
                }
                mono
              />

              <MetadataRow
                label="Started"
                value={
                  formatTimestamp(
                    selectedEpoch
                      .startedAt
                  )
                }
              />

              <MetadataRow
                label="Ended"
                value={
                  formatTimestamp(
                    selectedEpoch
                      .endedAt
                  )
                }
              />

              <MetadataRow
                label="Opened by"
                value={
                  occurrenceLabel(
                    selectedEpoch
                      .openedBy
                  )
                }
                mono
              />

              <MetadataRow
                label="Closed by"
                value={
                  occurrenceLabel(
                    selectedEpoch
                      .closedBy
                  )
                }
                mono
              />

              <MetadataRow
                label="Report ID"
                value={
                  selectedEpoch
                    .report
                    ?.reportId
                }
                mono
              />

              <MetadataRow
                label="Finalized"
                value={
                  formatTimestamp(
                    selectedEpoch
                      .report
                      ?.finalizedAt
                  )
                }
              />

              <MetadataRow
                label="Report SHA-256"
                value={
                  selectedEpoch
                    .report
                    ?.reportSha256
                }
                mono
              />
            </div>


            {!selectedEpoch
              .reportReady ? (
              <div className="rounded-xl border border-amber-300/60 dark:border-amber-400/20 bg-amber-50/70 dark:bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
                This Usage Epoch does not have a finalized immutable Analytics report yet.
              </div>
            ) : detailLoading ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Loading immutable Analytics report…
              </div>
            ) : detailError ? (
              <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {detailError}
              </div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/40 dark:bg-purple-500/5 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Immutable report
                        </div>

                        <Badge tone="purple">
                          {detail
                            .reportVersion
                            .toUpperCase()}
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Exact event facts for this Usage Epoch.
                        Session-fragment counters, raw journeys and recent-session intelligence are intentionally not part of the immutable archive.
                      </p>
                    </div>


                    {detail
                      .traffic
                      ?.supported ? (
                      <label className="w-full lg:w-[280px]">
                        <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                          Traffic
                        </div>

                        <select
                          aria-label="Archived traffic classification"
                          value={
                            archiveTrafficClassification
                          }
                          onChange={
                            changeArchiveTrafficClassification
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
                        >
                          {CONFIGURATION_ANALYTICS_TRAFFIC_OPTIONS.map(
                            (
                              option
                            ) => (
                              <option
                                key={
                                  option.id
                                }
                                value={
                                  option.id
                                }
                              >
                                {
                                  option.label
                                }
                              </option>
                            )
                          )}
                        </select>

                        <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                          Immutable precomputed slice — no live reclassification.
                        </div>
                      </label>
                    ) : (
                      <div className="shrink-0">
                        <Badge tone="purple">
                          Legacy · All traffic
                        </Badge>

                        <div className="mt-1.5 max-w-[280px] text-[11px] text-gray-500 dark:text-gray-400">
                          V1 predates traffic evidence. Historical classifications are not fabricated.
                        </div>
                      </div>
                    )}
                  </div>


                  {detail
                    .traffic
                    ?.supported ? (
                    <div
                      data-testid="archive-traffic-composition"
                      className="mt-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        {CONFIGURATION_ANALYTICS_TRAFFIC_OPTIONS.map(
                          (
                            option
                          ) => {
                            const bucket =
                              detail
                                .traffic
                                .summary
                                ?.[
                                  option.id
                                ] ||
                              {};


                            const selected =
                              detail
                                .traffic
                                .selectedClassification ===
                              option.id;


                            return (
                              <div
                                key={
                                  option.id
                                }
                                className={cx(
                                  "rounded-xl border px-3 py-3",
                                  selected
                                    ? "border-purple-300/80 dark:border-purple-400/40 bg-purple-100/60 dark:bg-purple-500/10"
                                    : "border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5"
                                )}
                              >
                                <div className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                                  {
                                    option.label
                                  }
                                </div>

                                <div className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
                                  {formatNumber(
                                    bucket
                                      .sessions
                                  )}
                                </div>

                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  sessions ·{" "}
                                  {formatNumber(
                                    bucket
                                      .uniqueVisitors
                                  )}{" "}
                                  visitors
                                </div>

                                <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                                  {formatNumber(
                                    bucket
                                      .eventCount
                                  )}{" "}
                                  events ·{" "}
                                  {formatDuration(
                                    bucket
                                      .activeMs
                                  )}{" "}
                                  active
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>

                      <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                        Classifier:{" "}
                        <span className="font-mono">
                          {detail
                            .traffic
                            .classifierVersion}
                        </span>
                        {" · "}
                        Unique visitors may overlap across traffic classes when the same visitor owns differently classified sessions.
                      </div>
                    </div>
                  ) : null}
                </div>


                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <ArchiveKpi
                    label="Unique visitors"
                    value={
                      formatNumber(
                        overview
                          .uniqueVisitors
                      )
                    }
                  />

                  <ArchiveKpi
                    label="New visitors"
                    value={
                      formatNumber(
                        overview
                          .newVisitors
                      )
                    }
                  />

                  <ArchiveKpi
                    label="Returning"
                    value={
                      formatNumber(
                        overview
                          .returningVisitors
                      )
                    }
                    sub={
                      Number(
                        overview
                          .unclassifiedVisitors ||
                          0
                      )
                        ? `${formatNumber(
                            overview
                              .unclassifiedVisitors
                          )} unclassified`
                        : null
                    }
                  />

                  <ArchiveKpi
                    label="Sessions"
                    value={
                      formatNumber(
                        overview
                          .sessions
                      )
                    }
                  />

                  <ArchiveKpi
                    label="Active time"
                    value={
                      formatDuration(
                        overview
                          .activeMs
                      )
                    }
                  />

                  <ArchiveKpi
                    label="Avg active / session"
                    value={
                      formatDuration(
                        overview
                          .avgActiveMsPerSession
                      )
                    }
                  />

                  <ArchiveKpi
                    label="Events"
                    value={
                      formatNumber(
                        overview
                          .eventCount
                      )
                    }
                    sub="exact projected event facts"
                  />

                  <ArchiveKpi
                    label="Top section"
                    value={
                      overview
                        .topSection ||
                      "—"
                    }
                  />
                </div>


                <HistorySection
                  title="Daily exact analytics"
                  subtitle="UTC day buckets within this immutable Usage Epoch interval."
                >
                  {detail
                    .daily
                    .length ? (
                    <div className="overflow-auto">
                      <table className="w-full min-w-[760px]">
                        <thead className="bg-white/60 dark:bg-white/[0.03]">
                          <tr className="text-left text-[11px] text-gray-500 dark:text-gray-400">
                            <th className="py-2.5 px-4 font-semibold">
                              Day
                            </th>

                            <th className="py-2.5 px-4 font-semibold text-right">
                              Visitors
                            </th>

                            <th className="py-2.5 px-4 font-semibold text-right">
                              Sessions
                            </th>

                            <th className="py-2.5 px-4 font-semibold text-right">
                              Events
                            </th>

                            <th className="py-2.5 px-4 font-semibold text-right">
                              Active
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {detail.daily.map(
                            (
                              day
                            ) => (
                              <tr
                                key={
                                  day.day
                                }
                                className="border-t border-gray-200/60 dark:border-white/10"
                              >
                                <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300">
                                  {day.day}
                                </td>

                                <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                                  {formatNumber(
                                    day
                                      .uniqueVisitors
                                  )}
                                </td>

                                <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                                  {formatNumber(
                                    day.sessions
                                  )}
                                </td>

                                <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                                  {formatNumber(
                                    day
                                      .eventCount
                                  )}
                                </td>

                                <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                                  {formatDuration(
                                    day.activeMs
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
                      No daily event facts were recorded in this Usage Epoch.
                    </div>
                  )}
                </HistorySection>


                <HistorySection
                  title="Section engagement"
                  subtitle="Exact archived reach, visits and active time."
                >
                  <div className="overflow-auto">
                    <table className="w-full min-w-[850px]">
                      <thead className="bg-white/60 dark:bg-white/[0.03]">
                        <tr className="text-left text-[11px] text-gray-500 dark:text-gray-400">
                          <th className="py-2.5 px-4 font-semibold">
                            Section
                          </th>

                          <th className="py-2.5 px-4 font-semibold text-right">
                            Visitors
                          </th>

                          <th className="py-2.5 px-4 font-semibold text-right">
                            Sessions
                          </th>

                          <th className="py-2.5 px-4 font-semibold text-right">
                            Visits
                          </th>

                          <th className="py-2.5 px-4 font-semibold text-right">
                            Active
                          </th>

                          <th className="py-2.5 px-4 font-semibold text-right">
                            Visitor reach
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {detail.sections.map(
                          (
                            section
                          ) => (
                            <tr
                              key={
                                section
                                  .section
                              }
                              className="border-t border-gray-200/60 dark:border-white/10"
                            >
                              <td className="py-2.5 px-4 text-xs font-medium text-gray-800 dark:text-gray-200">
                                {section
                                  .section}
                              </td>

                              <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                                {formatNumber(
                                  section
                                    .visitors
                                )}
                              </td>

                              <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                                {formatNumber(
                                  section
                                    .sessions
                                )}
                              </td>

                              <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                                {formatNumber(
                                  section
                                    .visits
                                )}
                              </td>

                              <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                                {formatDuration(
                                  section
                                    .activeMs
                                )}
                              </td>

                              <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                                {Number(
                                  section
                                    .visitorReachPct ||
                                    0
                                ).toFixed(
                                  1
                                )}
                                %
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </HistorySection>


                <HistorySection
                  title="Scroll depth"
                  subtitle="Exact archived visitor and session reach at canonical 25 / 50 / 75 / 100% milestones."
                >
                  <ArchivedDepthMilestones
                    milestones={
                      detail
                        .depthMilestones
                    }
                  />
                </HistorySection>


                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <HistorySection
                    title="CTA engagement"
                  >
                    <InteractionTable
                      rows={
                        detail.ctas
                      }
                      idKey="ctaId"
                      emptyText="No CTA events were recorded."
                    />
                  </HistorySection>

                  <HistorySection
                    title="Deep-link landings"
                  >
                    <InteractionTable
                      rows={
                        detail
                          .deepLinks
                      }
                      idKey="path"
                      emptyText="No deep-link events were recorded."
                    />
                  </HistorySection>

                  <HistorySection
                    title="Project engagement"
                  >
                    <InteractionTable
                      rows={
                        detail
                          .projects
                      }
                      idKey="projectId"
                      emptyText="No project events were recorded."
                    />
                  </HistorySection>

                  <HistorySection
                    title="Code snippet engagement"
                  >
                    <InteractionTable
                      rows={
                        detail
                          .snippets
                      }
                      idKey="snippetId"
                      emptyText="No snippet events were recorded."
                    />
                  </HistorySection>
                </div>


                <HistorySection
                  title="Geography"
                  subtitle="Trusted archived country/city attribution."
                >
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 p-4">
                    <div>
                      <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Countries
                      </div>

                      <div className="space-y-2">
                        {detail
                          .countries
                          .length ? (
                          detail.countries
                            .slice(
                              0,
                              12
                            )
                            .map(
                              (
                                country
                              ) => (
                                <div
                                  key={
                                    country
                                      .countryCode
                                  }
                                  className="flex items-center justify-between rounded-lg border border-gray-200/70 dark:border-white/10 px-3 py-2 text-xs"
                                >
                                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                                    {country
                                      .countryCode}
                                  </span>

                                  <span className="text-gray-600 dark:text-gray-400">
                                    {formatNumber(
                                      country
                                        .visitors
                                    )}{" "}
                                    visitors
                                  </span>
                                </div>
                              )
                            )
                        ) : (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            No country data.
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Cities
                      </div>

                      <div className="space-y-2">
                        {detail
                          .cities
                          .length ? (
                          detail.cities
                            .slice(
                              0,
                              12
                            )
                            .map(
                              (
                                city
                              ) => (
                                <div
                                  key={[
                                    city
                                      .countryCode,
                                    city
                                      .regionCode,
                                    city.city,
                                  ].join(
                                    ":"
                                  )}
                                  className="flex items-center justify-between rounded-lg border border-gray-200/70 dark:border-white/10 px-3 py-2 text-xs gap-3"
                                >
                                  <span className="font-medium text-gray-800 dark:text-gray-200">
                                    {[
                                      city.city,
                                      city
                                        .regionCode,
                                      city
                                        .countryCode,
                                    ]
                                      .filter(
                                        Boolean
                                      )
                                      .join(
                                        ", "
                                      ) ||
                                      "Unknown"}
                                  </span>

                                  <span className="shrink-0 text-gray-600 dark:text-gray-400">
                                    {formatNumber(
                                      city
                                        .visitors
                                    )}{" "}
                                    visitors
                                  </span>
                                </div>
                              )
                            )
                        ) : (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            No city data.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </HistorySection>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Select a Usage Epoch above to inspect its immutable runtime identity and report.
          </div>
        )}
      </div>
    </div>
  );
}