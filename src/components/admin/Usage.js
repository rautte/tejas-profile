// src/components/admin/Usage.js
//
// Admin "Usage" page (P13 point 4): AWS resource usage/cost for the
// project, aggregated day/week/month, refreshed via a background
// job on an owner-configurable schedule. Real-dollar cost comes
// from AWS Cost Explorer (account-wide); resource-level usage
// (storage size, consumed capacity, invocations) comes from
// CloudWatch metrics for the core application backend's own S3
// buckets / DynamoDB tables / Lambda functions.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FaMoneyBillWave,
} from "react-icons/fa";

import SectionHeader from "../shared/SectionHeader";

import {
  getUsageHistory,
  getUsageSummary,
  refreshUsageNow,
  setUsageRefreshConfig,
} from "../../utils/usage/usageApi";

import {
  formatTimestamp,
  SmallButton,
} from "./controlPlaneCatalogUi";

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../../utils/ui";

import {
  cx,
} from "../../utils/cx";


const INTERVAL_OPTIONS = [
  {
    value:
      1,

    label:
      "Every day",
  },

  {
    value:
      2,

    label:
      "Every 2 days",
  },

  {
    value:
      3,

    label:
      "Every 3 days",
  },

  {
    value:
      7,

    label:
      "Weekly",
  },
];


const PERIOD_TABS = [
  {
    id:
      "day",

    label:
      "Day",
  },

  {
    id:
      "week",

    label:
      "Week",
  },

  {
    id:
      "month",

    label:
      "Month",
  },
];


function formatUsd(
  value
) {
  const amount =
    Number(
      value ||
      0
    );

  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        4,
    }
  ).format(
    amount
  );
}


function formatCompactNumber(
  value
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      notation:
        "compact",

      maximumFractionDigits:
        1,
    }
  ).format(
    Number(
      value ||
      0
    )
  );
}


function formatBytes(
  value
) {
  const bytes =
    Number(
      value ||
      0
    );

  if (
    !bytes
  ) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const exponent =
    Math.min(
      Math.floor(
        Math.log(
          bytes
        ) /
        Math.log(
          1024
        )
      ),
      units.length -
      1
    );

  const value2 =
    bytes /
    Math.pow(
      1024,
      exponent
    );

  return `${value2.toFixed(
    value2 <
      10
      ? 1
      : 0
  )} ${units[exponent]}`;
}


function UsageKpi({
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


function CostByServiceTable({
  costByService,
}) {
  const rows =
    Object.entries(
      costByService ||
      {}
    )
      .sort(
        (
          a,
          b
        ) =>
          b[1] -
          a[1]
      );

  if (
    !rows.length
  ) {
    return (
      <div className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
        No per-service cost was recorded for this period.
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[420px]">
        <thead className="bg-white/60 dark:bg-white/[0.03]">
          <tr className="text-left text-[11px] text-gray-500 dark:text-gray-400">
            <th className="py-2.5 px-4 font-semibold">
              Service
            </th>

            <th className="py-2.5 px-4 font-semibold text-right">
              Cost
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            ([
              service,
              amount,
            ]) => (
              <tr
                key={
                  service
                }
                className="border-t border-gray-200/60 dark:border-white/10"
              >
                <td className="py-2.5 px-4 text-xs font-medium text-gray-800 dark:text-gray-200">
                  {service}
                </td>

                <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                  {formatUsd(
                    amount
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


function ResourceUsageTable({
  title,
  entries,
  columns,
}) {
  const rows =
    Array.isArray(
      entries
    )
      ? entries
      : [];

  if (
    !rows.length
  ) {
    return (
      <div>
        <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
          {title}
        </div>

        <div className="rounded-lg border border-dashed border-gray-300/80 dark:border-white/15 px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
          No resources configured.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
        {title}
      </div>

      <div className="rounded-lg border border-gray-200/70 dark:border-white/10 max-h-[216px] overflow-y-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col
              style={{
                width:
                  `${Math.max(
                    30,
                    100 -
                    columns.length *
                    22
                  )}%`,
              }}
            />

            {columns.map(
              (
                col
              ) => (
                <col
                  key={
                    col.key
                  }
                  style={{
                    width:
                      `${22}%`,
                  }}
                />
              )
            )}
          </colgroup>

          <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-[#121224]">
            <tr
              className="h-9 text-left text-[11px] text-gray-500 dark:text-gray-400"
            >
              <th className="px-3 font-semibold">
                Name
              </th>

              {columns.map(
                (
                  col
                ) => (
                  <th
                    key={
                      col.key
                    }
                    className="px-3 font-semibold text-right"
                  >
                    {col.label}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map(
              (
                entry
              ) => (
                <tr
                  key={
                    entry.name
                  }
                  className="h-9 border-t border-gray-200/60 dark:border-white/10"
                >
                  <td
                    className="py-2 px-3 text-xs font-mono text-gray-800 dark:text-gray-200 truncate"
                    title={
                      entry.name
                    }
                  >
                    {entry.name}
                  </td>

                  {columns.map(
                    (
                      col
                    ) => (
                      <td
                        key={
                          col.key
                        }
                        className="py-2 px-3 text-xs text-right text-gray-700 dark:text-gray-300 truncate"
                      >
                        {col.format(
                          entry
                            .metrics?.[
                            col.key
                          ]
                        )}
                      </td>
                    )
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export default function AdminUsage() {
  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    config,
    setConfig,
  ] =
    useState(
      null
    );

  const [
    snapshots,
    setSnapshots,
  ] =
    useState(
      {
        day:
          null,

        week:
          null,

        month:
          null,
      }
    );

  const [
    intervalDraft,
    setIntervalDraft,
  ] =
    useState(
      1
    );

  const [
    alertDrafts,
    setAlertDrafts,
  ] =
    useState(
      {
        day:
          "",

        week:
          "",

        month:
          "",
      }
    );

  const [
    savingConfig,
    setSavingConfig,
  ] =
    useState(
      false
    );

  const [
    configError,
    setConfigError,
  ] =
    useState(
      ""
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const [
    refreshMessage,
    setRefreshMessage,
  ] =
    useState(
      ""
    );

  const [
    activePeriodTab,
    setActivePeriodTab,
  ] =
    useState(
      "day"
    );

  const [
    history,
    setHistory,
  ] =
    useState(
      []
    );

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(
      false
    );

  const [
    historyError,
    setHistoryError,
  ] =
    useState(
      ""
    );


  const loadSummary =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError(
          ""
        );

        try {
          const result =
            await getUsageSummary();

          setConfig(
            result.config
          );

          setSnapshots(
            result.snapshots
          );

          setIntervalDraft(
            result
              .config
              ?.intervalDays ||
            1
          );

          const thresholds =
            result
              .config
              ?.alertThresholdsUsd ||
            {};

          setAlertDrafts(
            {
              day:
                thresholds.day ==
                  null
                  ? ""
                  : String(
                      thresholds.day
                    ),

              week:
                thresholds.week ==
                  null
                  ? ""
                  : String(
                      thresholds.week
                    ),

              month:
                thresholds.month ==
                  null
                  ? ""
                  : String(
                      thresholds.month
                    ),
            }
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
          setLoading(
            false
          );
        }
      },
      []
    );


  useEffect(
    () => {
      loadSummary();
    },
    [
      loadSummary,
    ]
  );


  const loadHistory =
    useCallback(
      async (
        periodType
      ) => {
        setHistoryLoading(
          true
        );

        setHistoryError(
          ""
        );

        try {
          const rows =
            await getUsageHistory(
              {
                periodType,

                limit:
                  30,
              }
            );

          setHistory(
            rows
          );
        } catch (
          exception
        ) {
          setHistory(
            []
          );

          setHistoryError(
            String(
              exception
                ?.message ||
              exception
            )
          );
        } finally {
          setHistoryLoading(
            false
          );
        }
      },
      []
    );


  useEffect(
    () => {
      loadHistory(
        activePeriodTab
      );
    },
    [
      activePeriodTab,
      loadHistory,
    ]
  );


  const saveConfig =
    async () => {
      setConfigError(
        ""
      );

      const parsedThresholds = {};

      for (
        const key of [
          "day",
          "week",
          "month",
        ]
      ) {
        const raw =
          String(
            alertDrafts[
              key
            ] ||
            ""
          ).trim();

        if (
          !raw
        ) {
          parsedThresholds[
            key
          ] =
            null;

          continue;
        }

        const parsed =
          Number(
            raw
          );

        if (
          !Number.isFinite(
            parsed
          ) ||
          parsed <
            0
        ) {
          setConfigError(
            `${key} alert threshold must be a non-negative dollar amount.`
          );

          return;
        }

        parsedThresholds[
          key
        ] =
          parsed;
      }


      setSavingConfig(
        true
      );

      try {
        const nextConfig =
          await setUsageRefreshConfig(
            {
              intervalDays:
                intervalDraft,

              alertThresholds:
                parsedThresholds,
            }
          );

        setConfig(
          nextConfig
        );
      } catch (
        exception
      ) {
        setConfigError(
          String(
            exception
              ?.message ||
            exception
          )
        );
      } finally {
        setSavingConfig(
          false
        );
      }
    };


  const triggerRefresh =
    async () => {
      setRefreshing(
        true
      );

      setRefreshMessage(
        ""
      );

      setError(
        ""
      );

      try {
        await refreshUsageNow();

        setRefreshMessage(
          "Refresh triggered. New numbers usually land within a minute or two -- refresh this page to check."
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
        setRefreshing(
          false
        );
      }
    };


  const daySnapshot =
    snapshots
      ?.day ||
    null;

  const weekSnapshot =
    snapshots
      ?.week ||
    null;

  const monthSnapshot =
    snapshots
      ?.month ||
    null;

  const resourceUsage =
    daySnapshot
      ?.resourceUsage ||
    weekSnapshot
      ?.resourceUsage ||
    monthSnapshot
      ?.resourceUsage ||
    null;

  const mostRecentCollectedAt =
    useMemo(
      () =>
        [
          daySnapshot
            ?.collectedAt,

          weekSnapshot
            ?.collectedAt,

          monthSnapshot
            ?.collectedAt,
        ]
          .filter(
            Boolean
          )
          .sort()
          .pop() ||
        null,
      [
        daySnapshot,
        weekSnapshot,
        monthSnapshot,
      ]
    );


  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader
        icon={
          FaMoneyBillWave
        }
        title="Usage"
      />

      <div className="px-6 mt-10 space-y-6">
        <div
          className={cx(
            CARD_SURFACE,
            CARD_ROUNDED_2XL
          )}
        >
          <div className="px-5 sm:px-6 py-4 border-b border-gray-200/70 dark:border-white/10 flex flex-col lg:flex-row lg:items-start justify-between gap-3">
            <div>
              <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
                AWS resource usage &amp; cost
              </h3>

              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-3xl">
                Dollar cost is account-wide, from AWS Cost Explorer.
                Resource-level usage (storage, capacity, invocations) covers this
                project&apos;s core application backend. Not real-time --
                refreshed on the schedule below.
              </p>

              {mostRecentCollectedAt ? (
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Last collected {formatTimestamp(mostRecentCollectedAt)}
                </p>
              ) : null}
            </div>

            <SmallButton
              onClick={
                loadSummary
              }
              disabled={
                loading
              }
            >
              {loading
                ? "Refreshing…"
                : "Reload"}
            </SmallButton>
          </div>

          <div className="px-5 sm:px-6 py-5 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-[220px_auto_auto] gap-3 items-end">
              <label>
                <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                  Refresh schedule
                </div>

                <select
                  aria-label="Usage refresh schedule"
                  value={
                    intervalDraft
                  }
                  onChange={(
                    event
                  ) =>
                    setIntervalDraft(
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
                >
                  {INTERVAL_OPTIONS.map(
                    (
                      option
                    ) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {
                          option.label
                        }
                      </option>
                    )
                  )}
                </select>

                {config
                  ?.intervalDays &&
                config.intervalDays !==
                  intervalDraft ? (
                  <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Currently saved: every{" "}
                    {
                      config.intervalDays
                    }{" "}
                    day
                    {config.intervalDays ===
                    1
                      ? ""
                      : "s"}
                  </div>
                ) : null}
              </label>

              <SmallButton
                onClick={
                  saveConfig
                }
                disabled={
                  savingConfig
                }
              >
                {savingConfig
                  ? "Saving…"
                  : "Save settings"}
              </SmallButton>

              <SmallButton
                onClick={
                  triggerRefresh
                }
                disabled={
                  refreshing
                }
              >
                {refreshing
                  ? "Triggering…"
                  : "Refresh now"}
              </SmallButton>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                Email me when cost exceeds (USD)
              </div>

              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 max-w-2xl">
                Leave a field blank to disable that alert. Sent once per period the threshold is crossed --
                you won&apos;t be re-alerted again until the next day/week/month.
              </p>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PERIOD_TABS.map(
                  (
                    tab
                  ) => (
                    <label
                      key={
                        tab.id
                      }
                    >
                      <div className="text-[11px] text-gray-600 dark:text-gray-400">
                        {tab.label}
                      </div>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`${tab.label} cost alert threshold`}
                        placeholder="Off"
                        value={
                          alertDrafts[
                            tab.id
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          setAlertDrafts(
                            (
                              prev
                            ) => (
                              {
                                ...prev,

                                [tab.id]:
                                  event
                                    .target
                                    .value,
                              }
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
                      />
                    </label>
                  )
                )}
              </div>
            </div>

            {configError ? (
              <div className="text-xs text-red-600 dark:text-red-400">
                {configError}
              </div>
            ) : null}

            {refreshMessage ? (
              <div className="rounded-lg border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/60 dark:bg-purple-500/10 px-3 py-2 text-xs text-purple-800 dark:text-purple-200">
                {refreshMessage}
              </div>
            ) : null}

            {error ? (
              <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Loading Usage summary…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <UsageKpi
                    label="Today"
                    value={
                      daySnapshot
                        ? formatUsd(
                            daySnapshot.totalCostUsd
                          )
                        : "—"
                    }
                    sub={
                      daySnapshot
                        ? daySnapshot.periodKey
                        : "No data collected yet"
                    }
                  />

                  <UsageKpi
                    label="This week"
                    value={
                      weekSnapshot
                        ? formatUsd(
                            weekSnapshot.totalCostUsd
                          )
                        : "—"
                    }
                    sub={
                      weekSnapshot
                        ? weekSnapshot.periodKey
                        : "No data collected yet"
                    }
                  />

                  <UsageKpi
                    label="This month"
                    value={
                      monthSnapshot
                        ? formatUsd(
                            monthSnapshot.totalCostUsd
                          )
                        : "—"
                    }
                    sub={
                      monthSnapshot
                        ? monthSnapshot.periodKey
                        : "No data collected yet"
                    }
                  />
                </div>

                {monthSnapshot ? (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Cost by service (month to date)
                    </div>

                    <div className="rounded-lg border border-gray-200/70 dark:border-white/10">
                      <CostByServiceTable
                        costByService={
                          monthSnapshot.costByService
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {resourceUsage ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ResourceUsageTable
                      title="S3 buckets"
                      entries={
                        resourceUsage.s3
                      }
                      columns={
                        [
                          {
                            key:
                              "sizeBytes",

                            label:
                              "Size",

                            format:
                              formatBytes,
                          },

                          {
                            key:
                              "objectCount",

                            label:
                              "Objects",

                            format:
                              formatCompactNumber,
                          },
                        ]
                      }
                    />

                    <ResourceUsageTable
                      title="DynamoDB tables (24h)"
                      entries={
                        resourceUsage.dynamodb
                      }
                      columns={
                        [
                          {
                            key:
                              "consumedReadCapacityUnits",

                            label:
                              "Read",

                            format:
                              formatCompactNumber,
                          },

                          {
                            key:
                              "consumedWriteCapacityUnits",

                            label:
                              "Write",

                            format:
                              formatCompactNumber,
                          },
                        ]
                      }
                    />

                    <ResourceUsageTable
                      title="Lambda functions (24h)"
                      entries={
                        resourceUsage.lambda
                      }
                      columns={
                        [
                          {
                            key:
                              "invocations",

                            label:
                              "Invocations",

                            format:
                              formatCompactNumber,
                          },

                          {
                            key:
                              "errors",

                            label:
                              "Errors",

                            format:
                              formatCompactNumber,
                          },
                        ]
                      }
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div
          className={cx(
            CARD_SURFACE,
            CARD_ROUNDED_2XL
          )}
        >
          <div className="px-5 sm:px-6 py-4 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between gap-3">
            <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
              History
            </h3>

            <div className="flex gap-1.5 rounded-lg border border-gray-200/70 dark:border-white/10 p-1">
              {PERIOD_TABS.map(
                (
                  tab
                ) => (
                  <button
                    key={
                      tab.id
                    }
                    type="button"
                    onClick={() =>
                      setActivePeriodTab(
                        tab.id
                      )
                    }
                    className={cx(
                      "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                      activePeriodTab ===
                        tab.id
                        ? "bg-purple-600 text-white"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/10"
                    )}
                  >
                    {tab.label}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="px-5 sm:px-6 py-5">
            {historyError ? (
              <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {historyError}
              </div>
            ) : historyLoading ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Loading history…
              </div>
            ) : history.length ? (
              <div className="overflow-auto rounded-lg border border-gray-200/70 dark:border-white/10">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-gray-100/90 dark:bg-[#121224]/90 border-b border-gray-200/70 dark:border-white/10">
                    <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                      <th className="py-2.5 px-4 font-semibold">
                        Period
                      </th>

                      <th className="py-2.5 px-4 font-semibold text-right">
                        Total cost
                      </th>

                      <th className="py-2.5 px-4 font-semibold">
                        Collected
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.map(
                      (
                        row
                      ) => (
                        <tr
                          key={
                            row.periodKey
                          }
                          className="border-t border-gray-200/60 dark:border-white/10"
                        >
                          <td className="py-2.5 px-4 text-xs font-mono text-gray-800 dark:text-gray-200">
                            {row.periodKey}
                          </td>

                          <td className="py-2.5 px-4 text-xs text-right text-gray-700 dark:text-gray-300">
                            {formatUsd(
                              row.totalCostUsd
                            )}
                          </td>

                          <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300">
                            {formatTimestamp(
                              row.collectedAt
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300/80 dark:border-white/15 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No {activePeriodTab} history has been collected yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
