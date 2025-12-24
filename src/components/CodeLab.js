// src/components/CodeLab.js

/**
 * TODO FIX:
 * For the query params deep link filter, resolve the conflic of selecting aditional filter options when on the same link
 * For UI only, consider different design for either "view" (code snippet) or "see more" (page loader)
 * Arrange the data list in priority order of high-signal
 * Make the snippet cards always pin to the top (leaving a few px from the hero section bottom) when viewed while collapsing the already expanded ones if any
 */

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
  PIN_TOP_OFFSET: 12,   // fallback px from viewport top
  DURATION_MS: 420,     // smooth pin during accordion switch
  CHASE_ALPHA: 0.28,    // higher = tighter chase; lower = floatier
};

/**
 * Computes a stable "pin-top" offset that naturally respects your header/hero area.
 * We pick the bottom of the first heading in CodeLab (or fallback to constant).
 * This avoids hardcoding the hero height and stays correct if it expands/collapses.
 */
const HERO_SELECTOR = "#hero, [data-hero]"; // supports either id or data-hero
const HERO_GAP_PX = 8; // “few px from hero bottom”

function getDynamicPinTopPx() {
  // If the hero is visible in the viewport, pin under its bottom.
  const hero = document.querySelector(HERO_SELECTOR);
  if (hero) {
    const r = hero.getBoundingClientRect();

    // hero is visible if it intersects viewport
    const heroVisible = r.bottom > 0 && r.top < window.innerHeight;

    if (heroVisible) {
      const desired = Math.floor(r.bottom + HERO_GAP_PX);

      // clamp so it doesn’t become absurdly large on big screens
      return clamp(desired, 8, 220);
    }
  }

  // Otherwise, just pin near the top of viewport
  return SWITCH.PIN_TOP_OFFSET;
}


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
 * Normalize concept names so the filter stays clean.
 * Also guarantees "API Design" is a canonical label.
 */
function normalizeConcept(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  const lower = s.toLowerCase();

  // Canonical API bucket
  if (
    lower === "api" ||
    lower === "apis" ||
    lower === "api design" ||
    lower === "api-design" ||
    lower.includes("rest") ||
    lower.includes("graphql")
  ) {
    return "API Design";
  }

  // Common minor normalizations
  if (lower === "orchestration" || lower === "workflow orchestration") return "Orchestration";
  if (lower === "reliability" || lower === "resilience") return "Reliability";

  return s;
}

// Clipboard helpers
const normalizeNewlines = (s) => String(s ?? "").replace(/\r\n/g, "\n");

// Removes shared left padding introduced by template literal indentation,
// but keeps relative indentation inside the code.
// function dedentBlock(input) {
//   const text = normalizeNewlines(input);

//   // Trim only outer empty lines (keeps intentional internal blank lines).
//   const lines = text.split("\n");
//   while (lines.length && lines[0].trim() === "") lines.shift();
//   while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

//   // Find smallest indent across non-empty lines.
//   let minIndent = Infinity;
//   for (const line of lines) {
//     if (!line.trim()) continue;
//     const m = line.match(/^(\s*)/);
//     const indent = m ? m[1].length : 0;
//     minIndent = Math.min(minIndent, indent);
//   }
//   if (!isFinite(minIndent) || minIndent === 0) return lines.join("\n");

//   return lines.map((l) => (l.trim() ? l.slice(minIndent) : "")).join("\n");
// }

async function copyToClipboard(text) {
  const payload = normalizeNewlines(text);

  // Modern clipboard API
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(payload);
    return;
  }

  // Fallback (older Safari / restricted contexts)
  const ta = document.createElement("textarea");
  ta.value = payload;
  ta.setAttribute("readonly", "true");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

/**
 * Condense domains into recruiter-friendly buckets.
 * Keeps the dropdown short and readable.
 */
function normalizeDomain(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "Other";

  const lower = s.toLowerCase();

  if (lower.includes("data") || lower.includes("warehouse") || lower.includes("lake") || lower.includes("etl"))
    return "Data Platforms";

  if (lower.includes("infra") || lower.includes("platform") || lower.includes("devops") || lower.includes("cloud"))
    return "Infra / Platform";

  if (lower.includes("backend") || lower.includes("api") || lower.includes("service"))
    return "Backend Systems";

  if (lower.includes("ml") || lower.includes("ai") || lower.includes("model"))
    return "ML / AI Systems";

  if (lower.includes("observ") || lower.includes("monitor") || lower.includes("logging"))
    return "Observability";

  return s; // fallback: keep original if it doesn't match
}

/**
 * Utility: top N by frequency (desc), then alphabetical.
 * Used to reduce choice fatigue in dropdowns.
 */
function topByCount(countMap, maxItems) {
  return Array.from(countMap.entries())
    .filter(([k]) => Boolean(k))
    .sort((a, b) => {
      const d = b[1] - a[1];
      if (d !== 0) return d;
      return a[0].localeCompare(b[0]);
    })
    .slice(0, maxItems)
    .map(([k]) => k);
}


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
  const sectionRef = React.useRef(null);

  const [setHash] = React.useState(() => window.location.hash);

  React.useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  });

  // ✅ Deep-link support: #/code-lab?from=battleship OR #/code-lab?from=syzmaniac,sys_managed
  const [deepLinkFromList, setDeepLinkFromList] = React.useState([]);

  React.useEffect(() => {
    const readDeepLink = () => {
      // hash looks like "#/code-lab?from=battleship" or "#/code-lab?from=syzmaniac,sys_managed"
      const qs = window.location.hash.split("?")[1] || "";
      const params = new URLSearchParams(qs);

      const raw = (params.get("from") || "").trim();

      // supports:
      //  - from=battleship
      //  - from=syzmaniac,sys_managed
      //  - from=syzmaniac%2Csys_managed  (URL-encoded comma also fine)
      const list = raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      setDeepLinkFromList(list);
    };

    readDeepLink(); // first load
    window.addEventListener("hashchange", readDeepLink);
    return () => window.removeEventListener("hashchange", readDeepLink);
  }, []);
  
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
  // Also closes the dropdown if the scroll happens outside the dropdown panel.
  React.useEffect(() => {
    if (!showDropdown) return;

    const schedule = () => {
      if (dropdownRafRef.current) return;
      dropdownRafRef.current = requestAnimationFrame(() => {
        dropdownRafRef.current = 0;
        applyDropdownPos();
      });
    };

    // If the user scrolls somewhere else on the page (not inside the dropdown),
    // close it to avoid “floating UI” while browsing snippets.
    const closeOnOutsideScroll = (e) => {
      const panel = dropdownPanelRef.current;
      if (!panel) return;

      const target = e.target;

      // If the scroll event originated from inside the dropdown itself, keep it open.
      // (Allows scrolling the filter list without collapsing it.)
      if (target && panel.contains(target)) return;

      setShowDropdown(false);
    };

    applyDropdownPos(); // first paint

    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { capture: true, passive: true });

    // Capture scroll events from nested scroll containers too.
    document.addEventListener("scroll", closeOnOutsideScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
      document.removeEventListener("scroll", closeOnOutsideScroll, { capture: true });

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
      concepts: toArray(s.concepts).map(normalizeConcept).filter(Boolean),
      domain: normalizeDomain(Array.isArray(s.domain) ? (s.domain[0] || "Other") : (s.domain || "Other")),
      language: (s.lang || "other").toLowerCase(),
    }));
  }, [snippets]);

  const [showAllSnippets, setShowAllSnippets] = React.useState(false);

  const filterOptions = React.useMemo(() => {
    // Build frequency maps (so we can keep only the highest-signal options)
    const tech = new Map();
    const concept = new Map();
    const domain = new Map();
    const lang = new Map();

    const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);

    allWithMeta.forEach((s) => {
      s.technology.forEach((t) => bump(tech, t));
      s.concepts.forEach((c) => bump(concept, c));
      bump(domain, s.domain);
      bump(lang, s.language);
    });

    // Your intent:
    // - Keep all languages
    // - Keep all technologies
    // - Condense concepts + domains to reduce fatigue
    const Technology = uniqSorted(Array.from(tech.keys()));
    const Language = uniqSorted(Array.from(lang.keys()));

    // Keep only top concepts/domains (high-signal)
    let Concept = topByCount(concept, 12);
    const Domain = topByCount(domain, 8);

    // Always ensure API Design exists in Concepts even if data doesn't include it
    if (!Concept.includes("API Design")) Concept = ["API Design", ...Concept];

    return {
      Technology,
      Concept: uniqSorted(Concept),
      Domain: uniqSorted(Domain),
      Language,
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
    let res = allWithMeta;

    // ✅ Deep link filter: #/code-lab?from=battleship OR multiple: #/code-lab?from=syzmaniac,sys_managed
    if (deepLinkFromList.length > 0) {
      res = res.filter((s) => {
        const hay = String(s.from || "").toLowerCase();
        return deepLinkFromList.some((needle) => hay.includes(needle));
      });
    }

    // If no UI filters selected, return (possibly deep-linked) result.
    if (filters.length === 0) return res;

    // strings like "Technology::AWS"
    const selected = filters.reduce((acc, f) => {
      const [cat, val] = f.split("::");
      if (!acc[cat]) acc[cat] = new Set();
      acc[cat].add(val);
      return acc;
    }, {});

    // AND across categories, OR within a category
    return res.filter((s) => {
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
  }, [allWithMeta, deepLinkFromList, filters]);

  const visibleSnippets = React.useMemo(() => {
    return showAllSnippets ? filteredSnippets : filteredSnippets.slice(0, 5);
  }, [filteredSnippets, showAllSnippets]);

  React.useEffect(() => {
    setShowAllSnippets(false);
  }, [filters, deepLinkFromList]);


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
    // Dynamic pin offset: sits just under the Hero bottom *only when Hero is visible*.
    const pinTopPx = getDynamicPinTopPx();

    // Hide current (restore to where user was before opening)
    if (openIdx === idx) {
      const y = expandScrollYRef.current[idx];
      if (typeof y === "number") pendingRestoreYRef.current = y;
      setOpenIdx(null);
      return;
    }

    // Always store where the user clicked from, but use the dynamic pinTop.
    const anchorY = cardEl
      ? cardEl.getBoundingClientRect().top + window.scrollY - pinTopPx
      : window.scrollY;

    expandScrollYRef.current[idx] = anchorY;
    markExpanded(snippets[idx]?.title);

    // If something else is open, collapse it first, then pin the new one.
    // This prevents the “expand both then jump” ping-pong.
    if (openIdx !== null && openIdx !== idx) {
      const prev = openIdx;

      // Open the new one (it will render expanded), mark the old one as closing
      setOpenIdx(idx);
      setClosingIdx(prev);

      // Start the "chase pin" loop: keeps the new card stable at pinTopPx
      // while the old one collapses and layout shifts.
      pinDuringSwitchRef.current = {
        idx,
        desiredTop: pinTopPx,
        durationMs: SWITCH.DURATION_MS,
        startTs: performance.now(),
        lastScrollY: window.scrollY,
      };

      return;
    }

    // Open fresh (no prior card). Pin immediately after React paints the expand.
    setOpenIdx(idx);

    // Pin on next frame so DOM has updated layout (no drift).
    requestAnimationFrame(() => {
      const el = cardRefs.current[idx];
      if (!el) return;
      const y = getCardTopY(el, pinTopPx);
      window.scrollTo({ top: y, behavior: "smooth" });
    });
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

      const docTop = el.getBoundingClientRect().top + window.scrollY;

      // Recompute pin target every frame so it naturally respects hero expand/collapse visibility.
      const livePinTop = getDynamicPinTopPx();
      const desiredScrollY = docTop - livePinTop;

      // Smooth chase, but prevent back-and-forth:
      // If the target moves upward (because a card above collapsed), we only move upward.
      // If the target moves downward, we follow downward. No oscillation.
      const rawNext =
        info.lastScrollY + (desiredScrollY - info.lastScrollY) * SWITCH.CHASE_ALPHA;

      // Clamp in the direction of travel to avoid ping-pong when switching to a lower card.
      const next =
        desiredScrollY < info.lastScrollY
          ? Math.max(desiredScrollY, rawNext) // moving up: never go past the target
          : Math.min(desiredScrollY, rawNext); // moving down: never go past the target

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
    const [copied, setCopied] = React.useState(false);

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

    const onCopy = async () => {
      try {
        // Copy should be stable regardless of Prism/line-number DOM.
        // Dedent helps if your template literal is indented in the data file.
        const clean = normalizeNewlines(code);
        await copyToClipboard(clean);

        setCopied(true);
        window.setTimeout(() => setCopied(false), 900);
      } catch {
        // ignore
      }
    };

    return (
      <div className="relative rounded-2xl overflow-hidden bg-gray-200/50 dark:bg-[#0f1320] max-h-[70vh]">
        {/* Copy button */}
        <div className="absolute right-3 top-3 z-20">
          <button
            type="button"
            onClick={onCopy}
            className={[
              "px-3 py-1 rounded-full text-xs font-semibold border shadow-sm transition",
              "bg-white/80 dark:bg-white/10",
              "border-gray-200 dark:border-gray-700",
              copied
                ? "text-green-700 dark:text-green-300"
                : "text-gray-800 dark:text-gray-100 hover:bg-white dark:hover:bg-white/15",
            ].join(" ")}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

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
                    transition-colors duration-300 will-change-[background-color,color,border-color]
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
      ref={sectionRef}
      className="py-0 px-4 transition-colors"
      style={{ overflowAnchor: "none" }}
    >
      <div className="px-6 max-w-6xl mx-auto">
        <div className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
              <FaCode className="text-3xl" />
              Code Lab
            </h2>

            <p className="mt-10 text-gray-600 dark:text-gray-400 max-w-3xl">
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
          {visibleSnippets.map((snip) => (
            <SnippetCard
              key={`${snip.__idx}-${snip.title}`}
              snippet={snip}
              idx={snip.__idx}
            />
          ))}

          {!showAllSnippets && filteredSnippets.length > 5 && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setShowAllSnippets(true)}
                className="group text-sm font-semibold text-purple-700 dark:text-purple-300 hover:underline underline-offset-4 transition"
              >
                <span className="flex items-center gap-2">
                  See More
                  <FiChevronsDown className="text-lg opacity-80 group-hover:opacity-100 transition" />
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
