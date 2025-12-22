// src/components/CodeLab.js
import React from "react";
import { createPortal } from "react-dom";
import { FaCode } from "react-icons/fa";
import { HiOutlineFilter } from "react-icons/hi";
import { FiChevronsDown, FiChevronsUp } from "react-icons/fi";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

import { CODE_LAB_SNIPPETS } from "../data/codeLab";

/**
 * Small constants, big sanity.
 * If you tweak sizing/UX later, do it once here.
 */
const DROPDOWN = {
  GAP: 8,
  VIEWPORT_PAD: 12,
  DESIRED_WIDTH: 450,
  DESIRED_MAXH: 450,
  MIN_H: 220,
  OPEN_UP_THRESHOLD: 380,
};

const SWITCH = {
  PIN_TOP_OFFSET: 12,   // px from viewport top where active card sits
  DURATION_MS: 420,     // smooth pin during accordion switch
  CHASE_ALPHA: 0.28,    // higher = tighter chase; lower = floatier
};

const SESSION_KEY = "codelab_expanded_titles_v1";

/* ---------- tiny utils ---------- */
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const uniqSorted = (arr) =>
  Array.from(new Set(arr))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

const toArray = (v) => {
  if (!v) return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
};

/**
 * Shared dropdown geometry.
 * Returns everything needed to paint it: placement + viewport-clamped bounds.
 */
function computeDropdownMetrics(btnRect) {
  const { GAP, VIEWPORT_PAD, DESIRED_WIDTH, DESIRED_MAXH, MIN_H, OPEN_UP_THRESHOLD } = DROPDOWN;

  const spaceBelow = window.innerHeight - btnRect.bottom - VIEWPORT_PAD;
  const spaceAbove = btnRect.top - VIEWPORT_PAD;

  const openUp = spaceBelow < OPEN_UP_THRESHOLD && spaceAbove > spaceBelow;
  const placement = openUp ? "top" : "bottom";

  const width = Math.min(DESIRED_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);

  // right-aligned feel, but still clamped to viewport
  const desiredLeft = btnRect.right - width;
  const left = clamp(
    desiredLeft,
    VIEWPORT_PAD,
    window.innerWidth - VIEWPORT_PAD - width
  );

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
}

export default function CodeLab({ darkMode }) {
  // Static-ish data source. Keeping this memo avoids hook lint churn.
  const snippets = React.useMemo(() => CODE_LAB_SNIPPETS, []);

  /* ---------------
   * Filters
   * --------------- */
  const [filters, setFilters] = React.useState([]);
  const [showDropdown, setShowDropdown] = React.useState(false);

  const dropdownWrapRef = React.useRef(null);      // button container
  const dropdownPanelRef = React.useRef(null);     // portal panel element
  const dropdownRafRef = React.useRef(0);

  const filterBtnRef = React.useRef(null);

  // Only used for first paint when opening. After that we “glue” with direct DOM writes.
  const [dropdownPos, setDropdownPos] = React.useState({
    placement: "bottom",
    left: 0,
    top: 0,
    bottom: null,
    maxHeight: DROPDOWN.DESIRED_MAXH,
    width: DROPDOWN.DESIRED_WIDTH,
  });

  const toggleFilter = React.useCallback((value) => {
    setFilters((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }, []);

  const resetFilters = React.useCallback(() => setFilters([]), []);

  // Close dropdown on outside click (needs portal awareness).
  React.useEffect(() => {
    const onMouseDown = (e) => {
      const inButton = dropdownWrapRef.current?.contains(e.target);
      const inPanel = dropdownPanelRef.current?.contains(e.target);
      if (!inButton && !inPanel) setShowDropdown(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  /**
   * Position “glue” (no React re-render on scroll).
   * This is what makes it feel rigid during fast scroll.
   */
  const applyDropdownPos = React.useCallback(() => {
    const btn = filterBtnRef.current;
    const panel = dropdownPanelRef.current;
    if (!btn || !panel) return;

    const r = btn.getBoundingClientRect();

    // If button is gone, don’t keep the dropdown floating around.
    const offscreen =
      r.bottom < DROPDOWN.VIEWPORT_PAD ||
      r.top > window.innerHeight - DROPDOWN.VIEWPORT_PAD ||
      r.right < 0 ||
      r.left > window.innerWidth;

    if (offscreen) {
      setShowDropdown(false);
      return;
    }

    const m = computeDropdownMetrics(r);

    // Direct DOM write = no “chasing” lag during scroll.
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
  }, [setShowDropdown]);

  // Track scroll/resize while open (rAF throttled).
  React.useEffect(() => {
    if (!showDropdown) return;

    const schedule = () => {
      if (dropdownRafRef.current) return;
      dropdownRafRef.current = requestAnimationFrame(() => {
        dropdownRafRef.current = 0;
        applyDropdownPos();
      });
    };

    applyDropdownPos(); // first paint

    window.addEventListener("resize", schedule, { passive: true });
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

  const openDropdown = React.useCallback(() => {
    const btn = filterBtnRef.current;
    if (!btn) {
      setShowDropdown(true);
      return;
    }

    // Set initial state once so the portal appears in the right place immediately.
    const m = computeDropdownMetrics(btn.getBoundingClientRect());
    setDropdownPos(m);
    setShowDropdown(true);
  }, []);

  /* -----------------------------
   * Derive metadata for filtering
   * ----------------------------- */
  const allWithMeta = React.useMemo(() => {
    return snippets.map((s, idx) => ({
      ...s,
      __idx: idx, // stable identity even after filtering
      technology: toArray(s.technology),
      concepts: toArray(s.concepts),
      domain: Array.isArray(s.domain) ? (s.domain[0] || "Other") : (s.domain || "Other"),
      language: (s.lang || "other").toLowerCase(),
    }));
  }, [snippets]);

  const filterOptions = React.useMemo(() => {
    return {
      Technology: uniqSorted(allWithMeta.flatMap((s) => s.technology)),
      Concept: uniqSorted(allWithMeta.flatMap((s) => s.concepts)),
      Domain: uniqSorted(allWithMeta.map((s) => s.domain)),
      Language: uniqSorted(allWithMeta.map((s) => s.language)),
    };
  }, [allWithMeta]);

  const getCount = React.useCallback(
    (category, value) => {
      return allWithMeta.filter((s) => {
        if (category === "Technology") return s.technology.includes(value);
        if (category === "Concept") return s.concepts.includes(value);
        if (category === "Domain") return s.domain === value;
        if (category === "Language") return s.language === value;
        return false;
      }).length;
    },
    [allWithMeta]
  );

  const filteredSnippets = React.useMemo(() => {
    if (filters.length === 0) return allWithMeta;

    // strings like "Technology::AWS"
    const selected = filters.reduce((acc, f) => {
      const [cat, val] = f.split("::");
      if (!acc[cat]) acc[cat] = new Set();
      acc[cat].add(val);
      return acc;
    }, {});

    // AND across categories, OR within a category
    return allWithMeta.filter((s) => {
      for (const [cat, set] of Object.entries(selected)) {
        const wants = [...set];

        if (cat === "Technology") {
          if (!wants.some((v) => s.technology.includes(v))) return false;
        } else if (cat === "Concept") {
          if (!wants.some((v) => s.concepts.includes(v))) return false;
        } else if (cat === "Domain") {
          if (!wants.some((v) => s.domain === v)) return false;
        } else if (cat === "Language") {
          if (!wants.some((v) => s.language === v)) return false;
        }
      }
      return true;
    });
  }, [allWithMeta, filters]);

  /* -----------------------------
   * Collapsible state (accordion)
   * ----------------------------- */
  const [openIdx, setOpenIdx] = React.useState(null);
  const [closingIdx, setClosingIdx] = React.useState(null);

  const anchorsRef = React.useRef([]);
  const cardRefs = React.useRef({});

  // Saved “where I clicked view from”, used on hide.
  const expandScrollYRef = React.useRef({});
  const pendingRestoreYRef = React.useRef(null);

  // Active pin loop (switch from A -> B while A collapses).
  const pinDuringSwitchRef = React.useRef(null);

  const getCardTopY = (el, desiredTopPx) => {
    if (!el) return window.scrollY;
    const rect = el.getBoundingClientRect();
    return window.scrollY + (rect.top - desiredTopPx);
  };

  const [expandedThisSession, setExpandedThisSession] = React.useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  const markExpanded = React.useCallback((title) => {
    setExpandedThisSession((prev) => {
      const next = new Set(prev);
      next.add(title);
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const toggle = (idx) => {
    const cardEl = cardRefs.current[idx];

    // Hide current
    if (openIdx === idx) {
      const y = expandScrollYRef.current[idx];
      if (typeof y === "number") pendingRestoreYRef.current = y;
      setOpenIdx(null);
      return;
    }

    // Save anchor so Hide restores nicely.
    const anchorY = cardEl
      ? cardEl.getBoundingClientRect().top + window.scrollY - SWITCH.PIN_TOP_OFFSET
      : window.scrollY;

    expandScrollYRef.current[idx] = anchorY;
    markExpanded(snippets[idx]?.title);

    // Switch from one open -> another
    if (openIdx !== null && openIdx !== idx) {
      const prev = openIdx;

      setOpenIdx(idx);
      setClosingIdx(prev);

      const targetScrollY = getCardTopY(cardEl, SWITCH.PIN_TOP_OFFSET);

      pinDuringSwitchRef.current = {
        idx,
        desiredTop: SWITCH.PIN_TOP_OFFSET,
        durationMs: SWITCH.DURATION_MS,
        startTs: performance.now(),
        startScrollY: window.scrollY,
        targetScrollY,
        lastScrollY: window.scrollY,
      };

      return;
    }

    // Open fresh
    setOpenIdx(idx);
  };

  // Pin loop during downward switching: keeps the new card stable while the old one shrinks.
  React.useEffect(() => {
    const info = pinDuringSwitchRef.current;
    if (!info) return;

    let raf = 0;

    const tick = () => {
      const el = cardRefs.current[info.idx];
      if (!el) {
        pinDuringSwitchRef.current = null;
        setClosingIdx(null);
        return;
      }

      const now = performance.now();
      const t = Math.min(1, (now - info.startTs) / info.durationMs);

      // Recompute every frame so layout shifts (old collapse) don’t drift the target.
      const docTop = el.getBoundingClientRect().top + window.scrollY;
      const desiredScrollY = docTop - info.desiredTop;

      // Smooth chase (this is the “silky” part).
      const next = info.lastScrollY + (desiredScrollY - info.lastScrollY) * SWITCH.CHASE_ALPHA;
      info.lastScrollY = next;

      window.scrollTo({ top: next, behavior: "auto" });

      if (t < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }

      pinDuringSwitchRef.current = null;
      setClosingIdx(null);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [openIdx]);

  // Restore scroll after collapse finishes (so the layout doesn’t fight the scroll).
  React.useEffect(() => {
    if (openIdx !== null) return;

    const y = pendingRestoreYRef.current;
    if (typeof y !== "number") return;

    const timer = window.setTimeout(() => {
      window.scrollTo({ top: y, behavior: "auto" });
      pendingRestoreYRef.current = null;
    }, SWITCH.DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [openIdx]);

  /* -----------------------------
   * Preview + Code rendering
   * ----------------------------- */
  function PreviewBlock({ code }) {
    const maxLines = 10;

    const preview = React.useMemo(() => {
      const lines = String(code ?? "").split("\n");
      const head = lines.slice(0, maxLines).join("\n");
      return lines.length > maxLines ? `${head}\n…` : head;
    }, [code]);

    return (
      <pre
        className="overflow-hidden text-xs text-gray-700 dark:text-gray-300"
        style={{
          margin: 0,
          background: "transparent",
          padding: "16px",
          lineHeight: "1.6",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        <code>{preview}</code>
      </pre>
    );
  }

  function CodeBlock({ code, lang, enhanceOnIdle = false }) {
    const [phase, setPhase] = React.useState(enhanceOnIdle ? "plain" : "prism");

    // wheel chaining: scroll inside block until edge, then let page take over
    const wheelScrollChain = (e) => {
      const el = e.currentTarget;
      if (el.scrollHeight <= el.clientHeight) return;

      const deltaY = e.deltaY;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
        e.preventDefault();
        el.scrollTop += deltaY;
      }
      // else: hit edge -> page scroll continues naturally
    };

    React.useEffect(() => {
      if (!enhanceOnIdle) return;

      // Let the expand paint happen first, then crossfade to Prism.
      let raf1 = 0;
      let raf2 = 0;
      let cancelled = false;

      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (!cancelled) setPhase("prism");
        });
      });

      return () => {
        cancelled = true;
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }, [enhanceOnIdle]);

    const wrapperStyle = {
      margin: 0,
      background: "transparent",
      padding: "16px",
      fontSize: "14px",
      lineHeight: "1.65",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    };

    return (
      <div className="relative rounded-2xl overflow-hidden bg-gray-200/50 dark:bg-[#0f1320] max-h-[70vh]">
        {/* Measuring layer: keeps height stable while we crossfade */}
        <pre style={wrapperStyle} className="opacity-0 pointer-events-none select-none">
          <code>{code}</code>
        </pre>

        {/* Plain layer */}
        <pre
          style={wrapperStyle}
          onWheel={wheelScrollChain}
          className={[
            "absolute inset-0 overflow-auto overscroll-auto transition-opacity duration-300",
            phase === "plain" ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <code>{code}</code>
        </pre>

        {/* Prism layer */}
        <div
          onWheel={wheelScrollChain}
          className={[
            "absolute inset-0 overflow-auto overscroll-auto transition-opacity duration-300",
            phase === "prism" ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{ pointerEvents: phase === "prism" ? "auto" : "none" }}
        >
          <SyntaxHighlighter
            language={lang}
            style={darkMode ? vscDarkPlus : oneLight}
            showLineNumbers
            wrapLongLines
            customStyle={{ ...wrapperStyle, margin: 0 }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  function SnippetCard({ snippet, idx }) {
    const isOpen = openIdx === idx;
    const isClosing = closingIdx === idx;
    const shouldShowExpanded = isOpen || isClosing;

    const { title, code, lang, why, from } = snippet;
    const wasExpanded = expandedThisSession.has(title);

    return (
      <article
        ref={(el) => {
          if (el) cardRefs.current[idx] = el;
        }}
        className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-[#1f2230] shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-4 py-3 border-b border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Default subtle gray fade */}
          <div
            className="
              pointer-events-none absolute top-0 left-0 h-full w-[35rem]
              bg-gradient-to-r backdrop-blur-[1px]
              from-gray-200/60 via-gray-200/25 to-transparent
              dark:from-gray-700/40 dark:via-gray-700/20
              transition-opacity duration-300
            "
          />

          {/* Session-highlighted purple fade (sits over gray) */}
          <div
            className={[
              "pointer-events-none absolute top-0 left-0 h-full w-[35rem]",
              "bg-gradient-to-r backdrop-blur-[1px]",
              "from-purple-300/60 via-purple-200/40 to-transparent",
              "dark:from-purple-600/30 dark:via-purple-600/20",
              "transition-opacity duration-300",
              wasExpanded ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />

          {/* Header content */}
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                {title}
              </h3>

              <span className="shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-white">
                {lang}
              </span>
            </div>

            <p className="mt-0 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {why}
            </p>

            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <span className="font-semibold text-gray-900 dark:text-gray-300">From:</span>{" "}
              {from}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="relative">
          {!shouldShowExpanded && (
            <div className="relative">
              <div className="px-4 py-3 max-h-24 overflow-hidden">
                <div className="rounded-2xl overflow-hidden bg-gray-200/50 dark:bg-[#0f1320]">
                  <PreviewBlock code={code} />
                </div>
              </div>

              {/* Fade overlay */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white dark:from-[#1f2230] to-transparent" />

              {/* View button */}
              <div className="absolute inset-x-0 bottom-2 flex justify-center">
                <button
                  ref={(el) => (anchorsRef.current[idx] = el)}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // stops focus-scroll drift
                  onClick={() => toggle(idx)}
                  className="
                    inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full
                    bg-white/90 dark:bg-white/10
                    border border-gray-200 dark:border-gray-700
                    text-purple-800 dark:text-purple-200
                    shadow-sm hover:shadow-md
                    transition
                  "
                >
                  <span>View</span>
                  <FiChevronsDown className="text-base opacity-80" />
                </button>
              </div>
            </div>
          )}

          {/* Collapsible expanded container */}
          <div
            className={[
              "grid transition-[grid-template-rows] duration-300 ease-in-out",
              isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            ].join(" ")}
          >
            <div className="overflow-hidden">
              {shouldShowExpanded && (
                <div className="px-4 py-4">
                  <CodeBlock code={code} lang={lang} enhanceOnIdle />

                  <div className="mt-4 flex justify-center">
                    <button
                      ref={(el) => (anchorsRef.current[idx] = el)}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggle(idx)}
                      className="
                        inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full
                        bg-white/90 dark:bg-white/10
                        border border-gray-200 dark:border-gray-700
                        text-purple-800 dark:text-purple-200
                        shadow-sm hover:shadow-md
                        transition
                      "
                    >
                      <span>Hide</span>
                      <FiChevronsUp className="text-base opacity-80" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section
      className="py-0 px-4 bg-gray-50 dark:bg-[#181826] transition-colors"
      style={{ overflowAnchor: "none" }}
    >
      <div className="px-6 max-w-6xl mx-auto">
        <div className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
              <FaCode className="text-3xl" />
              Code Lab
            </h2>

            <p className="mt-5 text-gray-600 dark:text-gray-400 max-w-3xl">
              A curated set of small, sanitized, and production-minded snippets that reflect how I build:
              secure access, deterministic ingestion, reusable transforms, orchestration, and consistent writes.
            </p>
          </div>

          {/* Filter */}
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
                  className="
                    fixed z-50 p-4
                    bg-gray-300/40 dark:bg-gray-600/40 text-gray-800 dark:text-gray-200
                    backdrop-blur-xl backdrop-saturate-150
                    rounded-2xl border border-white/20 dark:border-white/20
                    shadow-xl ring-1 ring-white/20 text-left
                    transition-opacity duration-150
                    overflow-y-auto overscroll-contain
                  "
                  style={{
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                    top: dropdownPos.top ?? "auto",
                    bottom: dropdownPos.bottom ?? "auto",
                    maxHeight: dropdownPos.maxHeight,
                    willChange: "top,left,bottom,max-height",
                  }}
                >
                  {Object.entries(filterOptions).map(([category, values]) => (
                    <div key={category} className="mb-10">
                      <h4 className="text-sm text-gray-700 dark:text-white/70 font-semibold uppercase mb-2">
                        {category}
                      </h4>
                      <div className="w-full h-[1px] bg-gray-300 dark:bg-gray-600 mb-3" />
                      <div className="flex flex-wrap gap-2">
                        {values.map((option) => (
                          <button
                            key={option}
                            onClick={() => toggleFilter(`${category}::${option}`)}
                            type="button"
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all border
                              ${
                                filters.includes(`${category}::${option}`)
                                  ? "bg-purple-600 text-white border-purple-700"
                                  : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200 dark:bg-white/20 dark:text-white dark:border-white/30 dark:hover:bg-white/30"
                              }`}
                          >
                            {option} ({getCount(category, option)})
                          </button>
                        ))}
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
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredSnippets.map((snip) => (
            <SnippetCard
              key={`${snip.__idx}-${snip.title}`}
              snippet={snip}
              idx={snip.__idx}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
