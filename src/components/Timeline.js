// src/components/Timeline.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaMapMarkedAlt } from "react-icons/fa";

import { timelineData } from "../data/timeline";

import SectionHeader from "./shared/SectionHeader";
import Pill from "./shared/Pill";

import { cx } from "../utils/cx";
import { CARD_SURFACE } from "../utils/ui";

/**
 * ---------- helpers ----------
 */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function nowYear() {
  return new Date().getFullYear();
}

/**
 * Parse year range strings like:
 * "2024 – Present", "2023 – 2024", "2017 – 2020", "2025 - Present"
 *
 * Returns:
 * { startYear: number|null, endYear: number|null, endIsPresent: boolean }
 */
function parseDurationYears(duration) {
  const d = String(duration || "").trim();

  const years = d.match(/(19|20)\d{2}/g) || [];
  const startYear = years.length >= 1 ? Number(years[0]) : null;
  const endYear = years.length >= 2 ? Number(years[1]) : null;

  const endIsPresent = /present/i.test(d);

  return { startYear, endYear, endIsPresent };
}

/**
 * We want the rail to be based on "completed year":
 * - If it has an explicit endYear: use that
 * - If it's Present: use current year (so it sits at “now”)
 */
function completedYearKey(duration) {
  const { endYear, endIsPresent } = parseDurationYears(duration);
  if (endYear) return endYear;
  if (endIsPresent) return nowYear();
  // fallback: if only one year exists, use it
  const { startYear } = parseDurationYears(duration);
  return startYear ?? 0;
}

/**
 * For ordering inside a year (concurrency):
 * Prefer:
 * 1) Present > not present
 * 2) bigger start year first (newer)
 */
function compareWithinYear(a, b) {
  const A = parseDurationYears(a.duration);
  const B = parseDurationYears(b.duration);

  const aPresent = A.endIsPresent ? 1 : 0;
  const bPresent = B.endIsPresent ? 1 : 0;
  if (aPresent !== bPresent) return bPresent - aPresent;

  const aStart = A.startYear ?? 0;
  const bStart = B.startYear ?? 0;
  return bStart - aStart;
}

/**
 * Optional: add chips from text (safe tagging only)
 */
function deriveChips(text) {
  const t = (text || "").toLowerCase();
  const chips = [];
  const add = (x, ok) => ok && !chips.includes(x) && chips.push(x);

  add("AWS", t.includes("aws"));
  add("Event-driven", t.includes("event-driven") || t.includes("event"));
  add("Real-time", t.includes("real-time") || t.includes("realtime"));
  add(
    "Reliability",
    t.includes("reliability") || t.includes("error") || t.includes("recovery")
  );
  add("Orchestration", t.includes("orchestration"));
  add("ETL", t.includes("etl"));
  add("OLAP", t.includes("olap"));
  add("CDK", t.includes("cdk"));
  add("FastAPI", t.includes("fastapi"));
  add("Go", t.includes("go-based") || t.includes("golang") || t.includes("go "));
  add(
    "Systems",
    t.includes("distributed") || t.includes("systems") || t.includes("boundaries")
  );

  return chips.slice(0, 6);
}

export default function Timeline() {
  const railRef = useRef(null);
  const draggingRef = useRef(false);

  /**
   * 1) Group entries by completedYearKey (end year)
   * 2) Create sorted unique years for the rail
   */
  const grouped = useMemo(() => {
    const map = new Map(); // year -> entries[]
    for (const entry of timelineData) {
      const y = completedYearKey(entry.duration);
      if (!map.has(y)) map.set(y, []);
      map.get(y).push({ ...entry, chips: deriveChips(entry.description) });
    }

    // sort entries in each year bucket (so “Present” / newer appears first)
    for (const [y, list] of map.entries()) {
      list.sort(compareWithinYear);
      map.set(y, list);
    }

    const years = Array.from(map.keys()).sort((a, b) => a - b); // chronologically left->right
    return { map, years };
  }, []);

  const years = grouped.years;
  const totalYears = years.length;

  /**
   * Active selection is year-based now (not entry-based)
   */
  const [activeYearIndex, setActiveYearIndex] = useState(() => {
    // default: last year (most recent)
    return Math.max(0, totalYears - 1);
  });

  /**
   * Concurrency handling:
   * If a year has multiple entries, show them all as cards.
   */
  const activeYear = years[clamp(activeYearIndex, 0, totalYears - 1)];
  const activeEntries = grouped.map.get(activeYear) || [];

  // Rail mapping
  const indexToPct = (idx) =>
    totalYears <= 1 ? 0 : (idx / (totalYears - 1)) * 100;

  const pctToNearestIndex = (pct) => {
    if (totalYears <= 1) return 0;
    const raw = (pct / 100) * (totalYears - 1);
    return clamp(Math.round(raw), 0, totalYears - 1);
  };

  const getRailMetrics = () => {
    const el = railRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width };
  };

  const pointerToPct = (clientX) => {
    const m = getRailMetrics();
    if (!m) return 0;
    const x = clamp(clientX, m.left, m.left + m.width);
    return ((x - m.left) / m.width) * 100;
  };

  const setFromPointer = (clientX) => {
    const pct = pointerToPct(clientX);
    const idx = pctToNearestIndex(pct);
    setActiveYearIndex(idx);
  };

  const onPointerDown = (e) => {
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    setFromPointer(e.clientX);
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    setFromPointer(e.clientX);
  };

  const onPointerUp = (e) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const progressPct = indexToPct(activeYearIndex);
  const atLeftEdge = activeYearIndex <= 0;
  const atRightEdge = activeYearIndex >= totalYears - 1;

  // keyboard nav (optional + stable)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "ArrowLeft")
        setActiveYearIndex((p) => clamp(p - 1, 0, totalYears - 1));
      if (e.key === "ArrowRight")
        setActiveYearIndex((p) => clamp(p + 1, 0, totalYears - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [totalYears]);

  return (
    <section className="w-full py-0 px-4 transition-colors">
      {/* ✅ Standard header */}
      <SectionHeader icon={FaMapMarkedAlt} title="Timeline" />

      {/* Helper line (keep) */}
      <div className="max-w-4xl mx-auto text-center px-6">
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 italic">
          ( Select a year or drag the timeline to see more )
        </p>
      </div>

      {/* Timeline rail */}
      <div className="max-w-5xl mx-auto mt-10 px-6">
        {/* Year labels above markers */}
        <div className="relative h-10">
          {years.map((y, idx) => {
            const pct = indexToPct(idx);
            const isActive = idx === activeYearIndex;

            return (
              <button
                key={`year-${y}`}
                onClick={() => setActiveYearIndex(idx)}
                className="
                  absolute -translate-x-1/2 top-0
                  text-xs sm:text-sm font-medium font-epilogue
                  text-gray-700 dark:text-gray-300
                  hover:text-indigo-500 dark:hover:text-indigo-300
                  transition
                "
                style={{ left: `${pct}%` }}
                aria-label={`Go to ${y}`}
                type="button"
              >
                <span
                  className={
                    isActive
                      ? "font-bold text-indigo-500 dark:text-indigo-300"
                      : "font-bold"
                  }
                >
                  {y}
                </span>
              </button>
            );
          })}
        </div>

        {/* Track (click + drag) */}
        <div
          data-timeline-scrubber="true"
          data-timeline-at-left={atLeftEdge ? "true" : "false"}
          data-timeline-at-right={atRightEdge ? "true" : "false"}
          className="relative mt-2 select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: "none" }}
        >
          {/* Base line */}
          <div
            ref={railRef}
            className="relative h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
          >
            {/* Progress fill */}
            <div
              className="
                absolute inset-y-0 left-0
                bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500
                dark:from-purple-400 dark:via-pink-400 dark:to-indigo-400
                transition-all duration-200 ease-out
              "
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* End caps */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 bg-gray-400 dark:bg-gray-500 rounded" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-6 bg-gray-400 dark:bg-gray-500 rounded" />

          {/* Markers */}
          {years.map((y, idx) => {
            const pct = indexToPct(idx);
            const isActive = idx === activeYearIndex;

            return (
              <button
                key={`marker-${y}`}
                onClick={() => setActiveYearIndex(idx)}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${pct}%` }}
                aria-label={`Select year ${y}`}
                type="button"
              >
                <div
                  className={[
                    "w-4 h-4 rounded-[4px] border transition-all duration-200",
                    isActive
                      ? "bg-purple-600 border-purple-300 shadow-[0_0_18px_rgba(168,85,247,0.85)] scale-110"
                      : "bg-white dark:bg-[#1e1e2f] border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:scale-105",
                  ].join(" ")}
                />
              </button>
            );
          })}

          {/* Draggable scrubber pill (keep) */}
          <div
            className="
              absolute top-1/2 -translate-y-1/2 -translate-x-1/2
              w-10 h-5 rounded-full
              bg-white/75 dark:bg-white/10
              border border-purple-400/40
              backdrop-blur-xl
              flex items-center justify-center
              transition-[left] duration-200 ease-out
              cursor-grab active:cursor-grabbing
            "
            style={{ left: `${progressPct}%` }}
          >
            <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.95)]" />
          </div>
        </div>

        {/* Tip text (keep) */}
        <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          Tip: Drag the scrubber or use ← → keys.
        </div>
      </div>

      {/* Focused cards BELOW the rail */}
      <div className="max-w-5xl mx-auto mt-10 px-6">
        {/* Year heading row */}
        <div className="flex items-center justify-between mb-5">

          {/* concurrency badge (keep) */}
          {activeEntries.length > 1 && (
            <div
              className="
                text-xs px-3 py-1 rounded-full
                bg-gray-500 text-gray-50 dark:bg-gray-600
                border border-purple-400/25
              "
            >
              {activeEntries.length} activities in {activeYear}
            </div>
          )}
          
        </div>

        {/* Cards list (handles concurrency cleanly) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeEntries.map((entry, i) => (
            <div
              key={`${activeYear}-${i}-${entry.company}-${entry.role}`}
              className={cx(CARD_SURFACE, "rounded-3xl p-7 text-left")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div
                    className="
                      inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase
                      text-purple-700/80 dark:text-purple-300/80
                    "
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    Milestone
                  </div>

                  {/* ✅ Fix: remove accidental bg/text conflict and keep readable */}
                  <h4 className="mt-2 text-xl font-bold font-epilogue text-gray-900 dark:text-gray-100">
                    {entry.role}
                  </h4>

                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    {entry.company}
                  </p>
                </div>

                {/* ✅ Fix: duration pill/badge stable & consistent */}
                <span
                  className="
                    shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
                    bg-indigo-500 dark:bg-indigo-600 text-white
                    border border-purple-400/25
                    shadow-sm
                  "
                >
                  {entry.duration}
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {entry.description}
              </p>

              {/* ✅ Use shared Pill for chips (static, no hover highlight) */}
              {entry.chips?.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {entry.chips.map((tag) => (
                    <Pill
                      key={`${entry.company}-${entry.role}-${tag}`}
                      variant="purpleStatic"
                    >
                      {tag}
                    </Pill>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
