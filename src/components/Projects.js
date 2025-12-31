// components/Projects.js

/**
 * TODO FIX:
 * The filter option box follows the filter button through the expanded hero top, make it collapse when scroll detected outside.
 * Fix the data of the project cards - links, repo, GitHub, README, downloadable .zip file, and description.
 * Clean the code prod-like with modular, reliable, and scalable structure
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { HiOutlineFilter } from "react-icons/hi";
import { FaProjectDiagram, FaPlay, FaGithub } from "react-icons/fa";
import { MdArticle } from "react-icons/md";

import { PROJECTS, PROJECT_FILTER_OPTIONS } from "../data/projects";

import SectionHeader from "./shared/SectionHeader";
import Pill from "./shared/Pill";

import { cx } from "../utils/cx";
import { CARD_SURFACE, CARD_ROUNDED_XL } from "../utils/ui";

export default function Project() {
  // ------------------------------------------------------------
  // Filters (data stays dumb, UI stays predictable)
  // ------------------------------------------------------------
  const [filters, setFilters] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const toggleFilter = useCallback((value) => {
    setFilters((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }, []);

  const resetFilters = useCallback(() => setFilters([]), []);

  // ------------------------------------------------------------
  // Portal dropdown positioning (stick to button, open up if needed)
  // ------------------------------------------------------------
  const dropdownWrapRef = useRef(null);
  const filterBtnRef = useRef(null);
  const dropdownPanelRef = useRef(null);
  const dropdownRafRef = useRef(0);

  // one-time placement so first open doesn’t “snap”
  const [dropdownPos, setDropdownPos] = useState({
    placement: "bottom",
    left: 0,
    top: 0,
    bottom: null,
    maxHeight: 450,
    width: 450,
  });

  const clamp = useCallback((n, min, max) => Math.min(max, Math.max(min, n)), []);

  const computeDropdownMetrics = useCallback(
    (btnRect) => {
      // tweakables (these are the only numbers worth touching)
      const GAP = 8; // space between button and dropdown
      const VIEWPORT_PAD = 12; // keep some breathing room from edges
      const DESIRED_WIDTH = 450; // keep this stable unless it can’t fit
      const DESIRED_MAXH = 450; // stable height (scroll inside)
      const MIN_H = 220; // avoid a tiny dropdown on short viewports

      const spaceBelow = window.innerHeight - btnRect.bottom - VIEWPORT_PAD;
      const spaceAbove = btnRect.top - VIEWPORT_PAD;

      // if below is cramped, prefer opening upward
      const openUp = spaceBelow < 380 && spaceAbove > spaceBelow;
      const placement = openUp ? "top" : "bottom";

      // keep 450px unless the viewport physically can’t fit it
      const width = Math.min(DESIRED_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);

      // align right edge with the button, but clamp to viewport
      const desiredLeft = btnRect.right - width;
      const left = clamp(
        desiredLeft,
        VIEWPORT_PAD,
        window.innerWidth - VIEWPORT_PAD - width
      );

      // max height: stable 450, or smaller if viewport is tight
      const available = Math.floor((openUp ? spaceAbove : spaceBelow) - GAP);
      const maxHeight = Math.min(DESIRED_MAXH, Math.max(MIN_H, available));

      return {
        placement,
        left: Math.floor(left),
        width: Math.floor(width),
        maxHeight: Math.floor(maxHeight),
        top: openUp ? null : Math.floor(btnRect.bottom + GAP),
        bottom: openUp ? Math.floor(window.innerHeight - btnRect.top + GAP) : null,
      };
    },
    [clamp]
  );

  // update the portal panel styles directly so it tracks scroll without “React lag”
  const applyDropdownPos = useCallback(() => {
    const btn = filterBtnRef.current;
    const panel = dropdownPanelRef.current;
    if (!btn || !panel) return;

    const r = btn.getBoundingClientRect();

    // if the trigger is offscreen, dropdown shouldn’t linger
    const offscreen =
      r.bottom < 12 ||
      r.top > window.innerHeight - 12 ||
      r.right < 0 ||
      r.left > window.innerWidth;

    if (offscreen) {
      setShowDropdown(false);
      return;
    }

    const m = computeDropdownMetrics(r);

    panel.style.left = `${m.left}px`;
    panel.style.width = `${m.width}px`;
    panel.style.maxHeight = `${m.maxHeight}px`;

    if (m.placement === "top") {
      panel.style.top = "auto";
      panel.style.bottom = `${m.bottom ?? 0}px`;
    } else {
      panel.style.bottom = "auto";
      panel.style.top = `${m.top ?? 0}px`;
    }
  }, [computeDropdownMetrics]);

  useEffect(() => {
    if (!showDropdown) return;

    const schedule = () => {
      if (dropdownRafRef.current) return;
      dropdownRafRef.current = requestAnimationFrame(() => {
        dropdownRafRef.current = 0;
        applyDropdownPos();
      });
    };

    applyDropdownPos(); // place immediately (no first-open snap)

    window.addEventListener("resize", schedule, { passive: true });
    // capture = true so we also react to inner container scrolls
    window.addEventListener("scroll", schedule, { capture: true, passive: true });

    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });

      if (dropdownRafRef.current) {
        cancelAnimationFrame(dropdownRafRef.current);
        dropdownRafRef.current = 0;
      }
    };
  }, [showDropdown, applyDropdownPos]);

  const openDropdown = useCallback(() => {
    const btn = filterBtnRef.current;
    if (!btn) {
      setShowDropdown(true);
      return;
    }
    setDropdownPos(computeDropdownMetrics(btn.getBoundingClientRect()));
    setShowDropdown(true);
  }, [computeDropdownMetrics]);

  // close portal on outside click (needs to check both button + portal panel)
  useEffect(() => {
    const onMouseDown = (e) => {
      const inButton = dropdownWrapRef.current?.contains(e.target);
      const inPanel = dropdownPanelRef.current?.contains(e.target);
      if (!inButton && !inPanel) setShowDropdown(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // ------------------------------------------------------------
  // Project filter semantics (OR within categories via values, AND across selected values)
  // ------------------------------------------------------------
  const projectFilterIndex = useCallback((p) => {
    // single source of truth for what’s filterable
    return [
      ...(p.techStack ?? []),
      p.domain,
      p.industry,
      p.status,
      ...(p.demo ? ["Live Demo"] : []),
      ...(p.github ? ["GitHub"] : []),
    ].filter(Boolean);
  }, []);

  const filteredProjects = useMemo(() => {
    if (filters.length === 0) return PROJECTS;

    return PROJECTS.filter((project) => {
      const combined = projectFilterIndex(project);
      return filters.every((f) => combined.includes(f));
    });
  }, [filters, projectFilterIndex]);

  const getCount = useCallback(
    (value) => {
      return PROJECTS.filter((p) => projectFilterIndex(p).includes(value)).length;
    },
    [projectFilterIndex]
  );

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <section className="w-full py-0 px-4 transition-colors">
      <SectionHeader
        icon={FaProjectDiagram}
        title={
          <span className="flex items-baseline gap-2">
            <span>Projects</span>
            <span className="text-sm italic font-normal text-gray-600 dark:text-gray-400">
              (Links under construction)
            </span>
          </span>
        }
        // underline intentionally omitted here (kept same behavior)
        right={
          <div className="relative w-fit text-left" ref={dropdownWrapRef}>
            <button
              ref={filterBtnRef}
              onClick={() => (showDropdown ? setShowDropdown(false) : openDropdown())}
              className="bg-gray-200/40 dark:bg-white/10 backdrop-blur-xl border border-gray-300 dark:border-white/30 rounded-xl px-3 py-1 font-medium text-gray-800 dark:text-white shadow-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-all flex items-center gap-2"
              type="button"
            >
              <HiOutlineFilter className="text-lg" />
              Filter ▾
            </button>

            {showDropdown &&
              createPortal(
                <div
                  ref={dropdownPanelRef}
                  className={cx(
                    "fixed z-50 p-4",
                    "bg-gray-300/40 dark:bg-gray-600/40 text-gray-800 dark:text-gray-200",
                    "backdrop-blur-xl backdrop-saturate-150",
                    "rounded-2xl border border-white/20 dark:border-white/20",
                    "shadow-xl ring-1 ring-white/20 text-left",
                    "transition-opacity duration-150",
                    "overflow-y-auto overscroll-contain"
                  )}
                  style={{
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                    top: dropdownPos.top ?? "auto",
                    bottom: dropdownPos.bottom ?? "auto",
                    maxHeight: dropdownPos.maxHeight,
                    willChange: "top,left,bottom,max-height",
                  }}
                >
                  {Object.entries(PROJECT_FILTER_OPTIONS).map(([category, values]) => (
                    <div key={category} className="mb-10">
                      <h4 className="text-sm text-gray-700 dark:text-white/70 font-semibold uppercase mb-2">
                        {category}
                      </h4>
                      <div className="w-full h-[1px] bg-gray-300 dark:bg-gray-600 mb-3" />

                      <div className="flex flex-wrap gap-2">
                        {values.map((option) => {
                          const selected = filters.includes(option);
                          return (
                            <Pill
                              key={option}
                              as="button"
                              type="button"
                              onClick={() => toggleFilter(option)}
                              variant={selected ? "purple" : "gray"}
                              className={cx(
                                "border",
                                selected
                                  ? "bg-purple-600 text-white border-purple-700 hover:bg-purple-600"
                                  : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200 dark:bg-white/20 dark:text-white dark:border-white/30 dark:hover:bg-white/30"
                              )}
                            >
                              {option} ({getCount(option)})
                            </Pill>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={resetFilters}
                    type="button"
                    className="mt-2 text-sm text-purple-600 dark:text-purple-300 hover:underline"
                  >
                    Reset Filters
                  </button>
                </div>,
                document.body
              )}
          </div>
        }
      />

      {/* Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-16 gap-y-10 px-6 py-4 md:px-25">
        {filteredProjects.map((project) => (
          <div
            key={project.title}
            className={cx(CARD_SURFACE, CARD_ROUNDED_XL, "p-6 text-left")}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold font-epilogue">{project.title}</h3>

              <span
                className={cx(
                  "text-xs px-2 py-1 text-white rounded-full whitespace-nowrap flex-shrink-0",
                  ["Deployed", "Completed"].includes(project.status)
                    ? "bg-green-500 dark:bg-green-600"
                    : "bg-indigo-500 dark:bg-indigo-600"
                )}
              >
                {project.status}
              </span>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {project.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              {project.techStack.map((tech) => (
                <Pill key={tech} variant="purple">
                  {tech}
                </Pill>
              ))}
            </div>

            <p className="text-xs mb-1 text-gray-500 dark:text-gray-400">
              <strong>Domain:</strong> {project.domain}
            </p>
            <p className="text-xs mb-3 text-gray-500 dark:text-gray-400">
              <strong>Industry:</strong> {project.industry}
            </p>

            <div className="flex flex-wrap gap-3 mt-2">
              {project.demo && (
                <a
                  href={project.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:opacity-90 transition font-medium"
                >
                  <FaPlay />
                  Live Demo
                </a>
              )}

              {project.github && (
                <>
                  <a
                    href={`${project.github}#readme`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm px-4 py-2 bg-gradient-to-r from-gray-700/80 via-gray-800/90 to-gray-900/90 text-white dark:text-gray-100 rounded-lg border dark:border-gray-600 hover:bg-gray-50 transition font-medium"
                  >
                    <MdArticle />
                    Read Me
                  </a>

                  <a
                    href={project.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm px-4 py-2 bg-gradient-to-r from-gray-700/80 via-gray-800/90 to-gray-900/90 text-white dark:text-gray-100 rounded-lg border dark:border-gray-600 hover:bg-gray-50 transition font-medium"
                  >
                    <FaGithub />
                    GitHub
                  </a>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
