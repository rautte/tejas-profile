// src/components/admin/adminQueryTools.js
//
// Small, generic admin table tooling shared across pages: a
// SQL-like "Query search" builder (From/Select/Order By/Limit/
// Filters) plus the primitive filter/sort functions it produces a
// payload for. Originally built for the Snapshots page's Profile
// Variant table; extracted here so other admin tables (e.g. the
// Configuration Analytics historical archive) can reuse the exact
// same UI and matching logic instead of re-implementing it.
//
// Every piece here is prop/argument-driven -- nothing hardcodes a
// specific page's column set or tab list.

import { useEffect, useState } from "react";

import { cx } from "../../utils/cx";


export function ActionButton({ variant = "neutral", children, onClick, disabled, title }) {
  const base =
    "inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed";

  const styles =
    variant === "green"
      ? "border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-700"
      : variant === "danger"
      ? "border-red-500/50 bg-red-600 text-white hover:bg-red-700"
      : variant === "purple"
      ? "border-purple-500/40 bg-purple-600 text-white hover:bg-purple-700"
      : variant === "soft-danger"
      ? "border-red-300/50 bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20"
      : // ✅ neutral gray vibe (light/dark)
        "border-gray-300/70 dark:border-white/10 bg-gray-50/80 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-white/15";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(base, styles)}
    >
      {children}
    </button>
  );
}


export function QuerySearchModal({
  open,
  onClose,
  activeTab,
  tabIds, // ["profile", "analytics", ...] -- populates the "From" dropdown
  tabs, // {profile:{label}, analytics:{label}, ...}
  getColsForTab,
  getSortableColsForTab,
  initial,
  onApply,
  onClear,
}) {
  const [fromTab, setFromTab] = useState(initial?.fromTab || activeTab);
  const [selectCols, setSelectCols] = useState(initial?.selectCols || []);
  const [orderBy, setOrderBy] = useState(initial?.orderBy || "");
  const [orderDir, setOrderDir] = useState(initial?.orderDir || "desc");
  const [limit, setLimit] = useState(
    typeof initial?.limit === "number" ? String(initial.limit) : ""
  );

  // key:value filters (simple)
  const [filters, setFilters] = useState(Array.isArray(initial?.filters) ? initial.filters : []);

  useEffect(() => {
    if (!open) return;

    setFromTab(initial?.fromTab || activeTab);
    setSelectCols(Array.isArray(initial?.selectCols) ? initial.selectCols : []); // ✅ none
    setOrderBy(initial?.orderBy || "");                                          // ✅ none
    setOrderDir(initial?.orderDir || "desc");                                    // ✅ desc
    setLimit(typeof initial?.limit === "number" ? String(initial.limit) : "");   // ✅ empty
    setFilters(Array.isArray(initial?.filters) ? initial.filters : []);
  }, [open, initial, activeTab]);

  // modal scroll lock (same pattern you used)
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) return null;

  const cols = getColsForTab(fromTab);
  const sortable = getSortableColsForTab(fromTab);

  const hasFrom = Boolean(fromTab);                 // usually true
  const hasSelect = (selectCols || []).length > 0;  // optional
  const hasOrderBy = Boolean(orderBy);              // optional
  const hasLimit = String(limit || "").trim().length > 0; // optional (only if user typed)

  // ✅ UI enable/disable gates
  const canSelect = hasFrom;               // Select enabled after From
  const canOrderBy = hasFrom && hasSelect; // OrderBy enabled after Select
  const canLimit = hasFrom;                // Limit enabled after From (NOT after OrderBy)
  const canFilters = hasFrom;              // Filters enabled after From

  const parsedLimit = Number(String(limit || "").trim());
  const limitOk = !hasLimit || (Number.isFinite(parsedLimit) && parsedLimit > 0); // ✅ only validate if provided

  // ✅ “at least 2 of 4”
  const stepsChosenCount =
    (hasFrom ? 1 : 0) +
    (hasSelect ? 1 : 0) +
    (hasOrderBy ? 1 : 0) +
    (hasLimit ? 1 : 0);

  const applyDisabled = !limitOk || stepsChosenCount < 2;

  const addFilterRow = () => {
    const firstCol = cols[0]?.id || "";
    setFilters((prev) => [
      ...(prev || []),
      { col: firstCol, op: "contains", value: "" },
    ]);
  };

  const updateFilter = (idx, patch) => {
    setFilters((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...(next[idx] || {}), ...(patch || {}) };
      return next;
    });
  };

  const removeFilter = (idx) => {
    setFilters((prev) => (prev || []).filter((_, i) => i !== idx));
  };

  return (
    <div
      className="fixed inset-0 z-[330] flex items-center justify-center px-4"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      {/* blurred backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md backdrop-saturate-150"
      />

      <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0b0b12]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              Query search
            </div>
            <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              Build a simple SQL-like query (From → Select → Order By → Limit)
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton
              onClick={() => {
                onClear?.();
                onClose?.();
              }}
              title="Clear query"
            >
              Clear
            </ActionButton>
            <ActionButton variant="soft-danger" onClick={onClose} title="Close">
              Close
            </ActionButton>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* From */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              From
            </div>
            <select
              value={fromTab}
              onChange={(e) => {
                const nextTab = e.target.value;
                setFromTab(nextTab);
                // reset downstream (enforced ordering)
                setSelectCols([]);
                setOrderBy("");
                setLimit("");
                setFilters([]);
              }}
              className={cx(
                "w-full h-10 rounded-xl border px-3 text-sm outline-none",
                "border-gray-200/70 dark:border-white/10",
                "bg-white/80 dark:bg-white/10",
                "text-gray-900 dark:text-gray-100"
              )}
            >
              {(tabIds || []).map((t) => (
                <option key={t} value={t}>
                  {tabs?.[t]?.label || t}
                </option>
              ))}
            </select>
          </div>

          {/* Select */}
          <div className={cx("space-y-1.5", !canSelect ? "opacity-50 pointer-events-none" : "")}>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Select
            </div>

            <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Choose columns to show in the table
                </div>
                <div className="flex items-center gap-2">
                  <ActionButton
                    onClick={() => setSelectCols(cols.map((c) => c.id))}
                    title="Select all columns"
                  >
                    All
                  </ActionButton>
                  <ActionButton
                    onClick={() => setSelectCols([])}
                    title="Clear selected columns"
                  >
                    None
                  </ActionButton>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cols.map((c) => {
                  const checked = selectCols.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 select-none"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-purple-600"
                        checked={checked}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setSelectCols((prev) => {
                            const p = prev || [];
                            if (on) return [...new Set([...p, c.id])];
                            return p.filter((x) => x !== c.id);
                          });
                          // reset downstream (enforced ordering)
                          setOrderBy("");
                        //   setLimit("");
                        }}
                      />
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Order By */}
          <div className={cx("space-y-1.5", !canOrderBy ? "opacity-50 pointer-events-none" : "")}>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Order By
            </div>

            <div className="flex items-center gap-2">
              <select
                value={orderBy}
                onChange={(e) => {
                  setOrderBy(e.target.value);
                //   setLimit("");
                }}
                className={cx(
                  "flex-1 h-10 rounded-xl border px-3 text-sm outline-none",
                  "border-gray-200/70 dark:border-white/10",
                  "bg-white/80 dark:bg-white/10",
                  "text-gray-900 dark:text-gray-100"
                )}
              >
                <option value="">Select a sortable column…</option>
                {sortable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={orderDir}
                onChange={(e) => setOrderDir(e.target.value)}
                className={cx(
                  "w-[140px] h-10 rounded-xl border px-3 text-sm outline-none",
                  "border-gray-200/70 dark:border-white/10",
                  "bg-white/80 dark:bg-white/10",
                  "text-gray-900 dark:text-gray-100"
                )}
                title="Sort direction"
              >
                <option value="desc">DESC</option>
                <option value="asc">ASC</option>
              </select>
            </div>
          </div>

          {/* Limit */}
          <div className={cx("space-y-1.5", !canLimit ? "opacity-50 pointer-events-none" : "")}>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Limit
            </div>
            <input
              value={limit}
              onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="e.g. 50"
              className={cx(
                "w-full h-10 rounded-xl border px-3 text-sm outline-none",
                "border-gray-200/70 dark:border-white/10",
                "bg-white/80 dark:bg-white/10",
                "text-gray-900 dark:text-gray-100",
                "placeholder:text-gray-400 dark:placeholder:text-gray-500"
              )}
            />
            {!limitOk && hasLimit ? (
              <div className="text-[11px] text-amber-700 dark:text-amber-300">
                Limit must be a positive number.
              </div>
            ) : null}
          </div>

          {/* Filters (key:value lookup) */}
          <div className={cx("space-y-2", !canFilters ? "opacity-50 pointer-events-none" : "")}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Filters (key:value)
              </div>
              <ActionButton onClick={addFilterRow} title="Add filter">
                + Add
              </ActionButton>
            </div>

            {filters?.length ? (
              <div className="space-y-2">
                {filters.map((f, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 flex flex-col sm:flex-row gap-2"
                  >
                    <select
                      value={f.col || ""}
                      onChange={(e) => updateFilter(idx, { col: e.target.value })}
                      className={cx(
                        "flex-1 h-10 rounded-xl border px-3 text-sm outline-none",
                        "border-gray-200/70 dark:border-white/10",
                        "bg-white/80 dark:bg-white/10",
                        "text-gray-900 dark:text-gray-100"
                      )}
                    >
                      {cols.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={f.op || "contains"}
                      onChange={(e) => updateFilter(idx, { op: e.target.value })}
                      className={cx(
                        "w-full sm:w-[140px] h-10 rounded-xl border px-3 text-sm outline-none",
                        "border-gray-200/70 dark:border-white/10",
                        "bg-white/80 dark:bg-white/10",
                        "text-gray-900 dark:text-gray-100"
                      )}
                      title="Operator"
                    >
                      <option value="contains">contains</option>
                      <option value="eq">=</option>
                      <option value="startsWith">startsWith</option>
                      <option value="endsWith">endsWith</option>
                    </select>

                    <input
                      value={f.value || ""}
                      onChange={(e) => updateFilter(idx, { value: e.target.value })}
                      placeholder="value…"
                      className={cx(
                        "flex-1 h-10 rounded-xl border px-3 text-sm outline-none",
                        "border-gray-200/70 dark:border-white/10",
                        "bg-white/80 dark:bg-white/10",
                        "text-gray-900 dark:text-gray-100",
                        "placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      )}
                    />

                    <ActionButton
                      variant="soft-danger"
                      onClick={() => removeFilter(idx)}
                      title="Remove filter"
                    >
                      Remove
                    </ActionButton>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Optional. Leave empty to query only by From/Select/Order/Limit.
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200/70 dark:border-white/10 flex items-center justify-end gap-2">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton
            variant="purple"
            disabled={applyDisabled}
            onClick={() => {
              const payload = {
                fromTab,
                selectCols, // can be []
                orderBy: hasOrderBy ? orderBy : "",
                orderDir: orderDir || "desc",
                limit: hasLimit ? parsedLimit : undefined, // ✅ only if user typed it
                filters: (filters || []).filter((f) => String(f?.value || "").trim().length > 0),
              };
              onApply?.(payload);
              onClose?.();
            }}
            title={applyDisabled ? "Complete From → Select → Order By → Limit" : "Apply query"}
          >
            Apply query
          </ActionButton>
        </div>
      </div>
    </div>
  );
}


export function normalizeText(v) {
  return String(v ?? "").toLowerCase().trim();
}

export function matchesFilter(value, op, needle) {
  const V = normalizeText(value);
  const N = normalizeText(needle);
  if (!N) return true;

  if (op === "eq") return V === N;
  if (op === "startsWith") return V.startsWith(N);
  if (op === "endsWith") return V.endsWith(N);
  return V.includes(N);
}

/**
 * `cols` is the same shape QuerySearchModal's getColsForTab(tabId)
 * returns: [{id, getValue(row)}, ...].
 */
export function applyKeyValueFilters(rowsIn, cols, filters) {
  if (!filters?.length) return rowsIn;

  const byId = Object.fromEntries((cols || []).map((c) => [c.id, c]));

  return (rowsIn || []).filter((row) =>
    filters.every((f) => {
      const colDef = byId[f.col];
      const raw = colDef?.getValue ? colDef.getValue(row) : "";
      return matchesFilter(raw, f.op, f.value);
    })
  );
}

export function comparePrimitive(a, b, dir) {
  const A = a ?? "";
  const B = b ?? "";
  if (A === B) return 0;

  if (typeof A === "number" && typeof B === "number") {
    return dir === "asc" ? A - B : B - A;
  }
  return dir === "asc"
    ? String(A).localeCompare(String(B))
    : String(B).localeCompare(String(A));
}
