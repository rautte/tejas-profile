// src/App.js
// https://rautte.github.io/tejas-profile


/**
 * CHECKPOINT (Mobile UI/UX):
 * Updating changes to section content for view on mobile UI/UX
 * 
 * TODO CONSIDER:
 * When selectedSection changes, restore last-known scroll for that section (current behavior) OR set the scroll container’s scrollTop = 0 (absolute)
 * After a lazy scroll to the end of a section, it still triggers section navigation even after a hard threshold scroll value of "STRONG_CONFIRM_MIN = 150". 
 * 
 * * TODO FIX:
 * 1 When using TAB key on keyboard then the highlight pill for the left section pane should be the same as hover (right now it is a bigger border that does not look good)
 * 2. Clean the code prod-like with modular, reliable, and scalable structure
 */

import "./App.css";
import "./index.css";

import { useLayoutEffect, useEffect, useMemo, useState, useCallback, useRef } from "react";

import { analyticsInit, trackSectionEnter, trackScrollDepth, trackClick, flushAndClose } from "./utils/analytics";
import { AdminAnalytics, AdminSnapshots, AdminData, AdminSettings } from "./components/admin";
import { OWNER_SESSION_KEY, OWNER_TOKEN_KEY } from "./config/owner";
import { DEFAULT_SECTION, SECTION_ORDER, SIDEBAR_GROUPS } from "./data/App";
import { listSnapshots } from "./utils/snapshots/snapshotsApi";

import ThemeToggle from "./components/shared/ThemeToggle";
import MobileDockNav from "./components/shared/MobileDockNav";
import QuickConnectPill from "./components/shared/QuickConnectPill";
import OwnerPasscodeModal from "./components/shared/OwnerPasscodeModal";
import MobileQuickConnectFab from "./components/shared/MobileQuickConnectFab";

import TicTacToeWeb from "./components/games/tictactoe/TicTacToeWeb";
import MinesweeperWeb from "./components/games/minesweeper/MinesweeperWeb";
import BattleshipWeb from "./components/games/battleship/BattleshipWeb";
import GameLayout from "./components/games/GameLayout";

import Footer from "./components/Footer";
import Hero from "./components/Hero";
import AboutMe from "./components/AboutMe";
import Timeline from "./components/Timeline";
import Resume from "./components/Resume";
import Experience from "./components/Experience";
import Skills from "./components/Skills";
import Education from "./components/Education";
import Project from "./components/Projects";
import FunZone from "./components/FunZone";
import CodeLab from "./components/CodeLab";
import HeroHandle from "./components/HeroHandle";

import { GiConsoleController } from "react-icons/gi";
import { FiSidebar } from "react-icons/fi";
import {
  FaUser,
  FaMapMarkedAlt,
  FaFileAlt,
  FaBriefcase,
  FaCogs,
  FaGraduationCap,
  FaProjectDiagram,
  FaCode,
  FaUserShield,
  FaChartLine, 
  FaDatabase, 
  FaCog,
  // FaRegFolderOpen,
  FaRegSave,
  FaLock,
} from "react-icons/fa";


const ICONS = {
  "About Me": <FaUser className="text-sm" />,
  Timeline: <FaMapMarkedAlt className="text-sm" />,
  Resume: <FaFileAlt className="text-sm" />,
  Experience: <FaBriefcase className="text-sm" />,
  Skills: <FaCogs className="text-sm" />,
  Education: <FaGraduationCap className="text-sm" />,
  Projects: <FaProjectDiagram className="text-sm" />,
  "Fun Zone": <GiConsoleController className="text-sm" />,
  "Code Lab": <FaCode className="text-sm" />,
  Analytics: <FaChartLine className="text-sm" />,
  // Snapshots: <FaRegFolderOpen className="text-sm" />,
  Snapshots: <FaRegSave className="text-sm" />,
  Data: <FaDatabase className="text-sm" />,
  Settings: <FaCog className="text-sm" />,
  // "Connect": <FaEnvelope className="text-sm" />,
};

const ADMIN_LABELS = ["Analytics", "Snapshots", "Data", "Settings"];

const LABELS = SECTION_ORDER;

const toSlug = (label) => label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
const SLUG_TO_LABEL = LABELS.reduce((acc, l) => {
  acc[toSlug(l)] = l;
  return acc;
}, {});

// ------------------------------
// Theme (Option A): OS-default, override only for this session
// ------------------------------

const THEME_KEY = "theme";

const NAV_HINT_KEY = "navHintDismissed";

function readNavHintDismissed() {
  try {
    return sessionStorage.getItem(NAV_HINT_KEY) === "true";
  } catch {}
  return false;
}

function writeNavHintDismissed() {
  try {
    sessionStorage.setItem(NAV_HINT_KEY, "true");
  } catch {}
}


/**
 * Theme boot rules:
 * 1) URL override: ?theme=dark|light (one-time, no persistence)
 * 2) Session override: sessionStorage.theme (set only after user toggles)
 * 3) OS preference
 */
function getInitialTheme() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("theme");
    if (fromQuery === "dark") return true;
    if (fromQuery === "light") return false;

    const sessionPref = sessionStorage.getItem(THEME_KEY);
    if (sessionPref === "dark") return true;
    if (sessionPref === "light") return false;

    if (window.matchMedia) return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {}
  return false;
}

function applyRootThemeClass(isDark) {
  document.documentElement.classList.toggle("dark", isDark);
}

function readSessionTheme() {
  try {
    const v = sessionStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {}
  return null;
}

function writeSessionTheme(isDark) {
  try {
    sessionStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  } catch {}
}


// ------------------------------
// Owner privilege (session-only, hash-query based)
// ------------------------------

function readOwnerEnabled() {
  try {
    return sessionStorage.getItem(OWNER_SESSION_KEY) === "1";
  } catch {}
  return false;
}

function writeOwnerEnabled() {
  try {
    sessionStorage.setItem(OWNER_SESSION_KEY, "1");
  } catch {}
}

function clearOwnerEnabled() {
  try {
    sessionStorage.removeItem(OWNER_SESSION_KEY);
  } catch {}
}


// ------------------------------
// Fun Zone hash routing helpers
// ------------------------------

// Accepts: "fun-zone/battleship", "fun-zone/battleship-AX9G", "fun-zone/minesweeper", "fun-zone/tictactoe"
function parseFunZoneRoute(rawHashPath) {
  const path = decodeURIComponent((rawHashPath || "").trim()).toLowerCase();

  if (!path.startsWith("fun-zone/")) return { game: null, code: null };

  let m = path.match(/^fun-zone\/battleship(?:-([a-z0-9]{4}))?(?:[/?].*)?$/i);
  if (m) return { game: "battleship", code: m[1] ? m[1].toUpperCase() : null };

  if (/^fun-zone\/minesweeper(?:[/?].*)?$/.test(path)) return { game: "minesweeper", code: null };
  if (/^fun-zone\/tictactoe(?:[/?].*)?$/.test(path)) return { game: "tictactoe", code: null };

  return { game: null, code: null };
}

function App() {

  const [ownerPromptOpen, setOwnerPromptOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );

  const [isOwner, setIsOwner] = useState(() => readOwnerEnabled());
  const [ownerError, setOwnerError] = useState("");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // ------------------------------
  // Analytics: init once + flush on tab close
  // ------------------------------
  useEffect(() => {
    analyticsInit();

    const onUnload = () => flushAndClose();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);


  useEffect(() => {
    const onKeyDown = (e) => {
      const isO = (e.key || "").toLowerCase() === "o";
      const isCombo = isO && e.shiftKey && (e.metaKey || e.ctrlKey);
      if (!isCombo) return;

      const t = e.target instanceof HTMLElement ? e.target : null;
      const tag = (t?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;

      e.preventDefault();

      // If already owner -> toggle OFF silently (no confirm popup)
      if (readOwnerEnabled()) {
        clearOwnerEnabled();
        try { sessionStorage.removeItem(OWNER_TOKEN_KEY); } catch {}
        setIsOwner(false);
        setSelectedSection(DEFAULT_SECTION);
        return;
      }

      // Always open modal (no "OWNER_SECRET not configured" alert)
      setOwnerError("");
      setOwnerPromptOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);


  const submitOwnerPasscode = useCallback(
    async (token) => {
      const t = (token || "").trim();
      if (!t) {
        setOwnerError("Enter a passcode");
        return;
      }

      // Put token + enable flag FIRST so snapshotsApi attaches x-owner-token
      try { sessionStorage.setItem(OWNER_TOKEN_KEY, t); } catch {}
      writeOwnerEnabled();

      try {
        // ✅ server-verified unlock: if token invalid, API returns 401
        await listSnapshots();

        setIsOwner(true);
        setOwnerError("");
        setOwnerPromptOpen(false);
      } catch (e) {
        // ❌ token invalid → rollback
        try { sessionStorage.removeItem(OWNER_TOKEN_KEY); } catch {}
        clearOwnerEnabled();
        setIsOwner(false);

        const msg = String(e?.message || e);
        // you’ll likely see "Unauthorized" or "401"
        setOwnerError(msg.includes("401") || msg.toLowerCase().includes("unauthorized")
          ? "Incorrect passcode"
          : msg
        );
      }
    },
    [setIsOwner]
  );


  // ------------------------------
  // Analytics: delegated click tracking (opt-in via data-analytics attr)
  // ------------------------------
  useEffect(() => {
    const onClick = (e) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (!t) return;

      const el = t.closest?.("[data-analytics]");
      if (!el) return;

      trackClick({
        id: el.getAttribute("data-analytics"),
        text: (el.textContent || "").trim().slice(0, 60),
        href: el.getAttribute("href") || null,
      });
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // ------------------------------
  // Theme state + actions
  // ------------------------------

  const [darkMode, setDarkMode] = useState(getInitialTheme);

  const blurActiveElement = () => {
    const el = document.activeElement;
    if (el && typeof el.blur === "function") el.blur();
  };

  // If user explicitly toggles, persist only for this session.
  const setDarkModeExplicit = useCallback((nextValueOrUpdater) => {
    setDarkMode((prev) => {
      const next =
        typeof nextValueOrUpdater === "function" ? nextValueOrUpdater(prev) : Boolean(nextValueOrUpdater);

      // mark explicit choice for *this tab/session*
      writeSessionTheme(next);

      // keep DOM class in sync immediately (no “one frame behind” nonsense)
      applyRootThemeClass(next);

      return next;
    });
  }, []);

  // Main toggle used by your buttons.
  const toggleTheme = useCallback(() => {
    blurActiveElement();
    setDarkModeExplicit((prev) => !prev);
  }, [setDarkModeExplicit]);

  // Apply BEFORE paint to avoid flash (covers non-explicit updates too, like OS change).
  useLayoutEffect(() => {
    applyRootThemeClass(darkMode);
  }, [darkMode]);

  // Follow OS theme changes ONLY if user has not explicitly chosen in this session.
  useEffect(() => {
    if (!window.matchMedia) return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      const explicit = readSessionTheme();
      if (explicit) return;

      // No session override -> track OS.
      setDarkMode(e.matches);
    };

    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);


  // ------------------------------
  // Section Navigation Hint
  // ------------------------------

  const [navHintDismissed, setNavHintDismissed] = useState(() => readNavHintDismissed());

  const dismissNavHint = useCallback(() => {
    setNavHintDismissed(true);
    writeNavHintDismissed();
  }, []);


  // ------------------------------
  // Sections
  // ------------------------------

  const sections = useMemo(() => {
    const base = {
      "About Me": <AboutMe darkMode={darkMode} isOwner={isOwner} />,
      Experience: <Experience darkMode={darkMode} isOwner={isOwner} />,
      Skills: <Skills darkMode={darkMode} isOwner={isOwner} />,
      Education: <Education darkMode={darkMode} isOwner={isOwner} />,
      Resume: <Resume darkMode={darkMode} isOwner={isOwner} />,
      Projects: <Project darkMode={darkMode} isOwner={isOwner} />,
      "Code Lab": <CodeLab darkMode={darkMode} isOwner={isOwner} />,
      "Fun Zone": <FunZone darkMode={darkMode} isOwner={isOwner} />,
      Timeline: <Timeline darkMode={darkMode} isOwner={isOwner} />,
    };

    if (!isOwner) return base;

    return {
      ...base,
      Analytics: <AdminAnalytics darkMode={darkMode} />,
      Snapshots: (
        <AdminSnapshots
          darkMode={darkMode}
          onRequireOwner={() => {
            setOwnerError("");
            setOwnerPromptOpen(true);
          }}
        />
      ),
      Data: <AdminData darkMode={darkMode} />,
      Settings: <AdminSettings darkMode={darkMode} />,
    };
  }, [darkMode, isOwner]);

  const mobileDockItems = useMemo(() => {
    const short = {
      "About Me": "About",
      Experience: "Work",
      Skills: "Skills",
      Education: "Edu",
      Resume: "Resume",
      Projects: "Projects",
      "Code Lab": "Code",
      "Fun Zone": "Fun",
      Timeline: "Time",
    };

    return LABELS
      .filter((id) => !ADMIN_LABELS.includes(id))
      .map((id) => ({
        id,
        label: id,
        shortLabel: short[id] ?? id,
        icon: ICONS[id],
      }));
  }, []);

  const recruiterQuickLook = [DEFAULT_SECTION, ...SIDEBAR_GROUPS.recruiter];
  const hiringManagerQuickLookBody = SIDEBAR_GROUPS.hiringManager;
  const moreAboutMe = SIDEBAR_GROUPS.explore;
  // const adminOnly = SIDEBAR_GROUPS.admin ?? [];
  const adminPinnedItems = isOwner ? ADMIN_LABELS.filter((l) => LABELS.includes(l)) : [];

  // ------------------------------
  // Step 2: per-section scroll memory (session-only)
  // ------------------------------

  const mainScrollRef = useRef(null);
  const sectionScrollRef = useRef(new Map()); // label -> scrollTop
  const prevSectionRef = useRef(null);

  // ------------------------------
  // Step 3: boundary scroll snap (top/bottom -> prev/next section)
  // ------------------------------

  const snapLockRef = useRef(false);
  const lastSnapTsRef = useRef(0);
  const wheelGestureRef = useRef({ startedAtBoundary: false, ts: 0 });
  const postSnapIgnoreUntilRef = useRef(0);
  const wheelEdgeHoldRef = useRef({ atTop: false, atBottom: false, ts: 0 });
  const timelineEdgeArmRef = useRef({ dir: null, ts: 0 });

  // ------------------------------
  // Step 3.5: silky transitions (only for boundary navigation)
  // ------------------------------

  const [isSectionTransitioning, setIsSectionTransitioning] = useState(false);
  const pendingSnapNavRef = useRef(false);
  const TRANSITION_MS = 220;

  // ------------------------------
  // Hash routing + selected section
  // ------------------------------

  const initialSection = (() => {
    const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0].toLowerCase();
    return SLUG_TO_LABEL[raw] || DEFAULT_SECTION;
  })();

  const [selectedSection, setSelectedSection] = useState(initialSection);

  useEffect(() => {
    if (!isOwner && ADMIN_LABELS.includes(selectedSection)) {
      setSelectedSection(DEFAULT_SECTION);
    }
  }, [isOwner, selectedSection]);

  const [hashPath, setHashPath] = useState(() =>
    window.location.hash.replace(/^#\/?/, "").split("?")[0].toLowerCase()
  );

  const goTo = useCallback(
    (label, { animated = false } = {}) => {
      if (!navHintDismissed) dismissNavHint();

      if (!animated) {
        setSelectedSection(label);
        return;
      }

      if (isSectionTransitioning) return;

      pendingSnapNavRef.current = true;
      setIsSectionTransitioning(true);

      window.setTimeout(() => {
        setSelectedSection(label);
      }, TRANSITION_MS);
    },
    [isSectionTransitioning, navHintDismissed, dismissNavHint]
  );


  // Keep app in sync when user uses browser back/forward
  useEffect(() => {
    const onHash = () => {
      const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0].toLowerCase();
      const label = SLUG_TO_LABEL[raw];
      if (label) setSelectedSection(label);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onHashOnly = () => {
      const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0].toLowerCase();
      setHashPath(raw);
    };
    window.addEventListener("hashchange", onHashOnly);
    return () => window.removeEventListener("hashchange", onHashOnly);
  }, []);

  // whenever the selected section changes, write hash like #/project
  useEffect(() => {
    if (hashPath.startsWith("fun-zone/")) return; // don't clobber game routes

    const slug = toSlug(selectedSection);
    const current = window.location.hash || "";

    // ✅ If we're already on this slug WITH query params (e.g. #/code-lab?from=battleship),
    // do NOT overwrite it (otherwise we lose the deep-link filter).
    const prefix = `#/${slug}`;
    if (current === prefix) return;
    if (current.startsWith(prefix + "?")) return;

    window.location.hash = `/${slug}`;
  }, [selectedSection, hashPath]);

  // Save/restore scroll per section
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    const prev = prevSectionRef.current;
    if (prev && prev !== selectedSection) {
      sectionScrollRef.current.set(prev, el.scrollTop);
    }

    const nextTop = sectionScrollRef.current.get(selectedSection) ?? 0;

    requestAnimationFrame(() => {
      const target = mainScrollRef.current;
      if (!target) return;
      target.scrollTop = nextTop;
    });

    prevSectionRef.current = selectedSection;
  }, [selectedSection]);

  // ------------------------------
  // Analytics: section enter tracking
  // ------------------------------
  useEffect(() => {
    trackSectionEnter(selectedSection);
  }, [selectedSection]);

  // finish fade-in after animated nav
  useEffect(() => {
    if (!pendingSnapNavRef.current) return;

    requestAnimationFrame(() => {
      setIsSectionTransitioning(false);
      pendingSnapNavRef.current = false;
    });
  }, [selectedSection]);

  // Boundary scroll snap + boundary arrow navigation
  useEffect(() => {
    const scroller = mainScrollRef.current;
    if (!scroller) return;

    const EPS = 2; // boundary tolerance
    const INTENT = 6; // small scroll noise cutoff
    const COOLDOWN_MS = 550; // prevent multi-skip from one gesture

    const isEditableTarget = (t) => {
      if (!t) return false;
      const el = t instanceof HTMLElement ? t : null;
      if (!el) return false;
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      return Boolean(el.isContentEditable);
    };

    const isTypingContext = (t) => {
      if (!t) return false;
      const el = t instanceof HTMLElement ? t : null;
      if (!el) return false;

      const tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.isContentEditable) return true;

      // If a component explicitly opts out of global arrow-nav
      if (el.closest?.("[data-disable-section-arrow-nav='true']")) return true;

      return false;
    };

    const atTop = () => scroller.scrollTop <= EPS;
    const atBottom = () => scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - EPS;

    const snapTo = (dir) => {
      const idx = LABELS.indexOf(selectedSection);
      if (idx < 0) return;

      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= LABELS.length) return;

      goTo(LABELS[nextIdx], { animated: true });
    };


    // Wheel: match Up/Down behavior (with a "discrete gesture" gate)
    // - Scroll inside section normally
    // - If at top + scroll up (after a pause) -> prev section
    // - If at bottom + scroll down (after a pause) -> next section
    // - Lazy/continuous scroll reaching boundary should never navigate
    // Wheel: match Up/Down behavior with reliable boundary detection + no overscroll bleed + no momentum double-snap
    const onWheel = (e) => {
      if (isEditableTarget(e.target)) return;
      if (e.shiftKey) return;

      const dy = e.deltaY;
      if (Math.abs(dy) < INTENT) return;

      const now = Date.now();

      if (now < postSnapIgnoreUntilRef.current) return;
      if (snapLockRef.current) return;
      if (now - lastSnapTsRef.current < COOLDOWN_MS) return;

      const goingDown = dy > 0;
      const goingUp = dy < 0;

      // Use tight edge detection (Resume has long scroll; EPS must not be generous)
      const EDGE_EPS = 2;
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);

      const atTopNow = scroller.scrollTop <= EDGE_EPS;
      const atBottomNow = scroller.scrollTop >= maxTop - EDGE_EPS;

      // Discrete gesture = pause before this wheel event
      const GESTURE_GAP_MS = 140;
      const isNewGesture = !wheelGestureRef.current.ts || now - wheelGestureRef.current.ts > GESTURE_GAP_MS;
      wheelGestureRef.current.ts = now;

      // Lazy/continuous scroll should never section-nav
      // BUT: after a long lazy scroll, the "extra push" might still be within same gesture.
      // So we accept either:
      //  - new gesture, OR
      //  - strong flick (same gesture)
      const absDy = Math.abs(dy);
      const DISCRETE_CONFIRM_MIN = 14;
      const STRONG_CONFIRM_MIN = 150; // make it meaningfully hard; this now actually matters
      const intentOk = isNewGesture ? absDy >= DISCRETE_CONFIRM_MIN : absDy >= STRONG_CONFIRM_MIN;
      if (!intentOk) {
        // update edge state and exit
        wheelEdgeHoldRef.current = { atTop: atTopNow, atBottom: atBottomNow, ts: now };
        return;
      }

      // ✅ Key rule:
      // Only snap if we were ALREADY at that edge on the previous wheel tick.
      const wasAtTop = wheelEdgeHoldRef.current.atTop;
      const wasAtBottom = wheelEdgeHoldRef.current.atBottom;

      const boundary =
        (atTopNow && wasAtTop && goingUp) ? "top" :
        (atBottomNow && wasAtBottom && goingDown) ? "bottom" :
        null;

      // update edge state before returning
      wheelEdgeHoldRef.current = { atTop: atTopNow, atBottom: atBottomNow, ts: now };

      if (!boundary) return;

      // Prevent scroll bleed into next section
      e.preventDefault();

      // clamp to remove any residual overscroll
      scroller.scrollTop = boundary === "top" ? 0 : maxTop;

      snapLockRef.current = true;
      lastSnapTsRef.current = now;

      // hard block momentum chain-snaps
      postSnapIgnoreUntilRef.current = now + 900;
      wheelGestureRef.current.ts = 0;

      if (boundary === "bottom") snapTo(+1);
      else snapTo(-1);

      setTimeout(() => {
        snapLockRef.current = false;
      }, COOLDOWN_MS);
    };

    const onKeyDown = (e) => {
      if (isTypingContext(e.target)) return;

      const key = e.key;
      const isLeft = key === "ArrowLeft";
      const isRight = key === "ArrowRight";
      const isUp = key === "ArrowUp";
      const isDown = key === "ArrowDown";

      if (!isLeft && !isRight && !isUp && !isDown) return;

      // Don’t let held key repeat trigger section nav.
      if (e.repeat) return;

      const top = atTop();
      const bottom = atBottom();
      const contentFits = top && bottom;

      const now = Date.now();
      if (snapLockRef.current) return;
      if (now - lastSnapTsRef.current < COOLDOWN_MS) return;

      // -------------------------
      // Left/Right: section nav only
      // Timeline exception: let Timeline own Left/Right (year scrubber)
      // -------------------------
      if (isLeft || isRight) {
        if (selectedSection === "Timeline") {
          const scrubber = document.querySelector("[data-timeline-scrubber='true']");
          const atLeft = scrubber?.getAttribute("data-timeline-at-left") === "true";
          const atRight = scrubber?.getAttribute("data-timeline-at-right") === "true";

          const dir = isLeft ? "left" : "right";

          // If Timeline is NOT at the relevant end, let Timeline own the key.
          if ((isLeft && !atLeft) || (isRight && !atRight)) {
            timelineEdgeArmRef.current = { dir: null, ts: 0 }; // reset arm when not at edge
            return;
          }

          // We ARE at the edge. First press arms, second press navigates.
          const now = Date.now();
          const armed = timelineEdgeArmRef.current;
          const ARM_WINDOW_MS = 900;

          const isSameDir = armed.dir === dir;
          const isRecent = now - armed.ts < ARM_WINDOW_MS;

          if (!(isSameDir && isRecent)) {
            // First press at edge: do nothing (stay on edge content)
            timelineEdgeArmRef.current = { dir, ts: now };
            return;
          }

          // Second press at edge in same direction: allow App.js to navigate sections
          timelineEdgeArmRef.current = { dir: null, ts: 0 };
        }

        e.preventDefault();
        snapLockRef.current = true;
        lastSnapTsRef.current = now;

        snapTo(isRight ? +1 : -1);

        setTimeout(() => {
          snapLockRef.current = false;
        }, COOLDOWN_MS);

        return;
      }

      // -------------------------------------------------
      // Up/Down: scroll-first. Only when at boundary do navigate on first discrete press.
      // -------------------------------------------------
      // If we're already at the boundary, a single discrete press navigates sections.
      // Holding should never navigate (handled by e.repeat guard above).
      if (!contentFits) {
        // Not at boundary -> let the section scroll normally
        if (isUp && !top) return;
        if (isDown && !bottom) return;
      } else {
        // Content fits (top && bottom). Treat Up as "top", Down as "bottom".
        // No special-case needed beyond allowing navigation below.
      }

      e.preventDefault();
      snapLockRef.current = true;
      lastSnapTsRef.current = now;

      snapTo(isDown ? +1 : -1);

      setTimeout(() => {
        snapLockRef.current = false;
      }, COOLDOWN_MS);
    };

    scroller.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown, { passive: false });

    return () => {
      scroller.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedSection, goTo]);


  // ------------------------------
  // Mobile swipe sections
  // ------------------------------
  useEffect(() => {
    if (!isMobile) return;

    const el = mainScrollRef.current;
    if (!el) return;

    const THRESH_X = 60;     // minimum horizontal distance
    const THRESH_Y = 50;     // if vertical movement is too large, ignore
    const EDGE_GUARD = 8;    // ignore if multi-touch, etc.

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };

    const onTouchEnd = (e) => {
      if (!tracking) return;
      tracking = false;

      const t = e.changedTouches?.[0];
      if (!t) return;

      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // Ignore mostly-vertical gestures (normal scrolling)
      if (Math.abs(dy) > THRESH_Y) return;
      if (Math.abs(dx) < THRESH_X) return;

      const idx = LABELS.indexOf(selectedSection);
      if (idx < 0) return;

      // Swipe left -> next section, swipe right -> previous section
      if (dx < -EDGE_GUARD && idx < LABELS.length - 1) {
        goTo(LABELS[idx + 1], { animated: true });
      } else if (dx > EDGE_GUARD && idx > 0) {
        goTo(LABELS[idx - 1], { animated: true });
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [isMobile, selectedSection, goTo]);

  // ------------------------------
  // Sidebar collapse
  // ------------------------------

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((v) => !v);
  }, []);

  // keyboard: Ctrl/Cmd + \
  useEffect(() => {
    const handler = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar]);

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const apply = () => setSidebarCollapsed(true);

    if (mq.matches) setSidebarCollapsed(true);

    const listener = (e) => (e.matches ? apply() : setSidebarCollapsed(false));
    mq.addEventListener?.("change", listener);
    return () => mq.removeEventListener?.("change", listener);
  }, []);

  // ------------------------------
  // Hero collapse logic (unchanged)
  // ------------------------------

  const PINNED_SET = useMemo(() => new Set(SIDEBAR_GROUPS.pinned), []);
  const skipNextPinnedExpand = useRef(false);

  const [sharedCollapsed, setSharedCollapsed] = useState(true);
  const [heroCollapsed, setHeroCollapsed] = useState(PINNED_SET.has(initialSection) ? false : sharedCollapsed);

  useEffect(() => {
    const isPinned = PINNED_SET.has(selectedSection);

    if (isPinned) {
      if (skipNextPinnedExpand.current) {
        skipNextPinnedExpand.current = false;
        return;
      }
      setHeroCollapsed(false);
    } else {
      setHeroCollapsed(sharedCollapsed);
    }
  }, [selectedSection, sharedCollapsed, PINNED_SET]);

  const setHero = useCallback(
    (collapsed) => {
      setHeroCollapsed(collapsed);

      if (PINNED_SET.has(selectedSection)) {
        if (collapsed) {
          setSharedCollapsed(true);
          skipNextPinnedExpand.current = true;
        }
      } else {
        setSharedCollapsed(collapsed);
      }
    },
    [selectedSection, PINNED_SET]
  );

  const heroMaxHeight = "min(28vh, 175px)";

  // ------------------------------
  // Sidebar UI components (unchanged)
  // ------------------------------

  const NavButton = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      title={sidebarCollapsed ? label : undefined}
      aria-label={label}
      className={`
        relative isolate overflow-hidden group
        w-full text-left rounded-xl font-medium font-jakarta
        flex items-center gap-3 transition-all duration-200
        text-sm md:text-[13.5px]
        ${sidebarCollapsed ? "px-3 py-2 justify-center" : "px-5 py-2"}
        text-gray-700 dark:text-gray-300
      `}
    >
      <span
        className={`
          pointer-events-none absolute inset-0 rounded-xl z-0
          transition-shadow duration-200
          ${
            active
              ? "bg-purple-100 dark:bg-purple-800 text-purple-900 dark:text-purple-100 shadow-inner ring-1 ring-inset ring-purple-300 dark:ring-purple-600 scale-[0.92]"
              : "group-hover:bg-purple-50 group-hover:dark:bg-[#2b2b3c] group-hover:text-gray-700 group-hover:dark:text-gray-300 group-hover:scale-[0.92]"
          }
        `}
        style={{ transformOrigin: "center" }}
      />

      <span className="relative z-10 flex items-center gap-3">
        <span className="shrink-0">{ICONS[label]}</span>
        {!sidebarCollapsed && <span className="truncate">{label}</span>}
      </span>
    </button>
  );

  const PINNED = SIDEBAR_GROUPS.pinned;
  const recruiterQuickLookBody = recruiterQuickLook.filter((i) => !PINNED.includes(i));

  const Group = ({ title, items, titleClassName = "", headerRight = null }) => (
    <div className="space-y-3">
      {!sidebarCollapsed && (
        <div
          className={`px-3 pt-3 pb-1 font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${titleClassName}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span>{title}</span>

            {headerRight ? (
              <span className="shrink-0 text-gray-400 dark:text-gray-500">
                {headerRight}
              </span>
            ) : null}
          </div>
        </div>
      )}

      <ul className={`space-y-0.5 ${sidebarCollapsed ? "px-1" : "px-0"}`}>
        {items.map((label) => (
          <li key={label} className="relative group">
            <NavButton label={label} active={selectedSection === label} onClick={() => goTo(label)} />
          </li>
        ))}
      </ul>
    </div>
  );

  const sidebarRound = heroCollapsed ? "rounded-none md:rounded-md" : "rounded-md";

  // ------------------------------
  // Game routing
  // ------------------------------

  const isGamePage = hashPath.startsWith("fun-zone/");

  if (isGamePage) {
    const { game, code } = parseFunZoneRoute(hashPath);

    let title = "Game";
    let gameElement = null;

    if (game === "tictactoe") {
      title = "Tic-Tac-Toe (AI)";
      gameElement = <TicTacToeWeb />;
    } else if (game === "minesweeper") {
      title = "Minesweeper";
      gameElement = <MinesweeperWeb />;
    } else if (game === "battleship") {
      title = code ? `Battleship — Room ${code}` : "Battleship";
      gameElement = <BattleshipWeb />;
    }

    return (
      <GameLayout
        title={title}
        darkMode={darkMode}
        setDarkMode={setDarkModeExplicit} // keep DOM + session in sync even from inside games
      >
        {gameElement ?? (
          <div className="text-gray-700 dark:text-gray-300">
            Unknown game. <a className="underline" href="#/fun-zone">Back to Fun Zone</a>
          </div>
        )}
      </GameLayout>
    );
  }

  return (
    <div className="relative h-screen flex flex-col overflow-hidden bg-transparent text-black dark:text-gray-200 transition-all">
      {/* Background underlay to avoid showing raw/mismatched background during overscroll bounce */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-gray-50 dark:bg-[#181826] transition-colors" />
      {/* Global background wallpaper (subtle + theme-aware) */}
      {/* <div aria-hidden className="tech-wallpaper wallpaper-nodes bg-gray-50 dark:bg-[#181826] transition-colors" /> */}

      {/* Global theme toggle (always available) */}
      <div className="fixed top-4 right-4 z-[90] flex items-center gap-2">
        {isOwner && (
          <div
            className="
              hidden sm:inline-flex items-center gap-2
              px-3 py-2 rounded-full
              bg-gray-200 dark:bg-gray-800
              backdrop-blur-xl
              border border-gray-200/70 dark:border-white/10
              shadow-sm
              text-[12px]
              text-gray-800 dark:text-gray-100
              hover:shadow-md transition
            "
            title="Owner mode enabled"
          >
            <FaUserShield className="text-[15px] text-purple-600 dark:text-purple-300" />
            <span>Owner Mode</span>

            <button
              type="button"
              onClick={() => {
                clearOwnerEnabled();
                try { sessionStorage.removeItem(OWNER_TOKEN_KEY); } catch {}
                setIsOwner(false);
                setSelectedSection(DEFAULT_SECTION); // or goTo(DEFAULT_SECTION)
              }}
              className="
                ml-2
                px-2 py-[2px]
                rounded-full
                bg-red-600 hover:bg-red-700
                text-white
                text-[10px]
                font-semibold
                leading-none
                transition
                shadow-sm
              "
              title="Exit owner mode"
            >
              OFF
            </button>
          </div>
        )}

        <ThemeToggle darkMode={darkMode} onToggle={toggleTheme} />
      </div>

      {/* Collapsible Hero (desktop only) */}
      {!isMobile && (
        <>
          <div
            className="
              w-full z-30 bg-gradient-to-r from-purple-300 to-blue-300
              dark:from-purple-900 dark:to-blue-900 shadow-md relative overflow-hidden
              transition-[max-height] duration-400 ease-out
            "
            style={{ maxHeight: heroCollapsed ? 0 : heroMaxHeight }}
            aria-expanded={!heroCollapsed}
          >

            <div
              className={`transition-all duration-400 ease-out ${
                heroCollapsed ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
              }`}
            >
              <Hero darkMode={darkMode} />
            </div>

            {!heroCollapsed && (
              <HeroHandle
                collapsed={false}
                onToggle={() => setHero(true)}
                placement="bottom"
                width={120}
                height={22}
              />
            )}
          </div>

          {heroCollapsed && (
            <HeroHandle
              collapsed
              onToggle={() => setHero(false)}
              placement="top"
              width={120}
              height={22}
            />
          )}
        </>
      )}

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Sidebar */}
        <nav
          className={`
            hidden md:flex shrink-0 flex-col relative ${sidebarRound}
            backdrop-blur-lg bg-white/10 dark:bg-[#0b0b12]/40
            border border-white/20 dark:border-white/10
            shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-white/10
            transition-all
            h-auto md:h-full pb-4 md:pb-4 md:mt-0
            ${sidebarCollapsed ? "w-full px-2 md:w-[58px] md:px-2" : "w-full px-4 md:w-[220px] md:px-4"}
            order-1 md:order-none
          `}
          aria-label="Primary"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg
                      bg-gradient-to-b from-white/25 to-transparent
                      dark:from-white/10
                      [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.6),rgba(0,0,0,0.2)_60%,transparent)]"
          />

          <div className={`shrink-0 relative ${sidebarCollapsed ? "px-0" : "px-0"}`}>
            {/* Top-right controls (desktop only) */}
            <div className="hidden md:flex absolute top-4 left-2 right-2 z-10 items-center gap-2">

              {/* Collapse button (unchanged) */}
              <button
                onClick={toggleSidebar}
                className="p-2
                          text-gray-700 dark:text-white rounded-full shadow-sm transition
                          hover:ring-2 hover:dark:ring-purple-500/60 hover:ring-purple-300/70
                          focus:outline-none focus:ring-2 focus:dark:ring-purple-500/60 focus:ring-purple-300/70
                          bg-white/10 dark:bg-[#0b0b12]/40 backdrop-blur-xl"
                title={sidebarCollapsed ? "Expand sidebar (Ctrl/Cmd + \\)" : "Collapse sidebar (Ctrl/Cmd + \\)"}
                aria-label="Toggle sidebar"
              >
                <FiSidebar
                  size={16}
                  className={`transform transition-transform duration-300 ${
                    sidebarCollapsed ? "rotate-180" : "rotate-0"
                  }`}
                />
              </button>
            </div>

            <div className="pt-16 space-y-4">
              <ul className={`space-y-0.5 ${sidebarCollapsed ? "px-1" : "px-0"}`}>
                <li>
                  <NavButton label="About Me" active={selectedSection === "About Me"} onClick={() => goTo("About Me")} />
                </li>
              </ul>

              {!sidebarCollapsed && (
                <div className="mx-2 h-[2px] bg-gradient-to-r from-transparent via-gray-200/80 to-transparent dark:via-white/10" />
              )}
            </div>
          </div>

          {/* MIDDLE: scrollable */}
          <div className="relative flex-1 overflow-hidden">
            <div
              className="
                h-full overflow-y-auto no-scrollbar pt-4
                [mask-image:linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-24px),transparent)]
                [mask-size:100%_100%]
                [mask-repeat:no-repeat]
              "
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent, black 24px, black calc(100% - 24px), transparent)",
                WebkitMaskSize: "100% 100%",
                WebkitMaskRepeat: "no-repeat",
              }}
            >
              <div className="space-y-4">
                <Group title="Recruiter" items={recruiterQuickLookBody} titleClassName="text-[11px] md:text-[11px]" />

                {!sidebarCollapsed && <div className="h-px bg-gray-200/70 dark:bg-white/10 mx-2" />}

                <Group title="Hiring Manager" items={hiringManagerQuickLookBody} titleClassName="text-[11px] md:text-[11px]" />

                {!sidebarCollapsed && <div className="h-px bg-gray-200/70 dark:bg-white/10 mx-2" />}

                <Group title="Explore" items={moreAboutMe} titleClassName="text-[11px] md:text-[11px]" />
              </div>
            </div>
          </div>

          {/* BOTTOM: pinned Admin (OWNER ONLY) */}
          {isOwner && adminPinnedItems.length > 0 && (
            <div className="shrink-0 pt-3">
              {!sidebarCollapsed && (
                <div className="mx-2 mb-3 h-[2px] bg-gradient-to-r from-transparent via-gray-200/80 to-transparent dark:via-white/10" />
              )}
              <Group
                title="Admin"
                items={adminPinnedItems}
                titleClassName="text-[11px] md:text-[11px]"
                headerRight={<FaLock className="text-[11px]" />}
              />
            </div>
          )}
        </nav>

        {/* Content + Footer column */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <main
            ref={mainScrollRef}
            onScroll={() => {
              const el = mainScrollRef.current;
              if (!el) return;

              sectionScrollRef.current.set(selectedSection, el.scrollTop);

              // analytics
              trackScrollDepth(selectedSection, el);
            }}
            className="flex-1 overflow-y-auto p-0 sm:p-6 bg-transparent transition-colors"
            role="main"
          >
            <div
              className={`p-6 pb-[140px] md:pb-24 transition-opacity duration-200 ease-out ${
                isSectionTransitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              {sections[selectedSection]}
            </div>
          </main>

          <Footer />
        </div>
      </div>

      <MobileQuickConnectFab>
        <QuickConnectPill />
      </MobileQuickConnectFab>

      {isMobile && !navHintDismissed && (
        <div className="md:hidden fixed left-1/2 -translate-x-1/2 z-[70] bottom-[calc(env(safe-area-inset-bottom)+72px)]">
          <div
            className="
              flex items-center gap-2
              px-3 py-2 rounded-full
              bg-white/80 dark:bg-[#0b0b12]/70
              backdrop-blur-xl
              border border-gray-200/70 dark:border-white/10
              shadow-lg
              text-[12px]
              text-gray-800 dark:text-gray-100
              whitespace-nowrap
            "
          >
            <span>Swipe <span className="font-semibold">← →</span> to switch</span>
            <button
              type="button"
              onClick={dismissNavHint}
              className="
                ml-1 w-6 h-6 rounded-full
                bg-gray-100 dark:bg-white/10
                hover:bg-gray-200 dark:hover:bg-white/15
                transition
              "
              aria-label="Dismiss navigation tip"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Navigation tip (desktop only, overlay — does NOT affect layout) */}
      {!sidebarCollapsed && !navHintDismissed && (
        <div className="hidden md:flex fixed left-1/2 -translate-x-1/2 z-[85] bottom-[62px] px-3">
          <div
            // left-1/2 -translate-x-1/2 This was under relative in below classname 
            className="
              relative
              text-[11px] leading-none px-4 py-2 pr-9 rounded-full
              bg-gray-300/70 dark:bg-white/10
              text-indigo-900 dark:text-indigo-100
              border border-purple-200/70 dark:border-white/10
              backdrop-blur-md shadow-sm
              select-none
            "
            title="Tip: Use ← → to switch sections"
          >
            <span className="block text-center">
              Tip: Use <span className="font-semibold">← →</span> to switch sections
            </span>

            <button
              type="button"
              onClick={dismissNavHint}
              className="
                absolute right-2 top-1/2 -translate-y-1/2
                w-5 h-5 rounded-full
                bg-white/30 dark:bg-white/10
                border border-white/40 dark:border-white/10
                hover:bg-white/50 dark:hover:bg-white/15
                transition
                text-[10px]
                flex items-center justify-center
              "
              aria-label="Dismiss navigation tip"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <MobileDockNav
        items={mobileDockItems}
        activeId={selectedSection}
        onSelect={(id) => goTo(id)}
      />

      <OwnerPasscodeModal
        open={ownerPromptOpen}
        onClose={() => {
          setOwnerPromptOpen(false);
          setOwnerError("");
        }}
        onSubmit={submitOwnerPasscode}
        error={ownerError}
      />

    </div>
  );
}

export default App;
