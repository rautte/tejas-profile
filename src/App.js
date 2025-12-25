// src/App.js
// https://rautte.github.io/tejas-profile

/**
 * TODO CONSIDER:
 * When selectedSection changes, restore last-known scroll for that section OR set the scroll container’s scrollTop = 0 (absolute)
 *
 * TODO FIX:
 * When using TAB key on keyboard then the highlight pill for the left section pane should be the same as hover (right now it is a bigger border that does not look good)
 * Clean the code prod-like with modular, reliable, and scalable structure
 */

import "./App.css";
import "./index.css";

import { useLayoutEffect, useEffect, useMemo, useState, useCallback, useRef } from "react";

import { DEFAULT_SECTION, SECTION_ORDER, SIDEBAR_GROUPS } from "./data/App";

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
  FaMoon,
  FaSun,
  FaCode,
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
  // "Connect": <FaEnvelope className="text-sm" />,
};

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
  // Sections
  // ------------------------------

  const sections = useMemo(
    () => ({
      "About Me": <AboutMe darkMode={darkMode} />,
      Experience: <Experience darkMode={darkMode} />,
      Skills: <Skills darkMode={darkMode} />,
      Education: <Education darkMode={darkMode} />,
      Resume: <Resume darkMode={darkMode} />,
      Projects: <Project darkMode={darkMode} />,
      "Code Lab": <CodeLab darkMode={darkMode} />,
      "Fun Zone": <FunZone darkMode={darkMode} />,
      Timeline: <Timeline darkMode={darkMode} />,
    }),
    [darkMode]
  );

  const recruiterQuickLook = [DEFAULT_SECTION, ...SIDEBAR_GROUPS.recruiter];
  const hiringManagerQuickLookBody = SIDEBAR_GROUPS.hiringManager;
  const moreAboutMe = SIDEBAR_GROUPS.explore;

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
  const boundaryPushRef = useRef(0);
  const lastBoundaryRef = useRef(null); // "top" | "bottom" | null

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

  const [hashPath, setHashPath] = useState(() =>
    window.location.hash.replace(/^#\/?/, "").split("?")[0].toLowerCase()
  );

  const goTo = useCallback(
    (label, { animated = false } = {}) => {
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
    [isSectionTransitioning]
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

    const onWheel = (e) => {
      if (isEditableTarget(e.target)) return;
      if (e.shiftKey) return;

      const dy = e.deltaY;
      if (Math.abs(dy) < INTENT) return;

      const now = Date.now();
      if (snapLockRef.current) return;
      if (now - lastSnapTsRef.current < COOLDOWN_MS) return;

      const goingDown = dy > 0;
      const goingUp = dy < 0;

      const top = atTop();
      const bottom = atBottom();

      // If content fits (top && bottom), decide boundary by direction.
      let boundary = null;
      if (top && bottom) boundary = goingDown ? "bottom" : "top";
      else boundary = top ? "top" : bottom ? "bottom" : null;

      if (!boundary) {
        boundaryPushRef.current = 0;
        lastBoundaryRef.current = null;
        return;
      }

      // arm boundary (prevents “lazy scroll” from snapping instantly)
      if (lastBoundaryRef.current !== boundary) {
        lastBoundaryRef.current = boundary;
        boundaryPushRef.current = 0;
        return;
      }

      if ((boundary === "top" && !goingUp) || (boundary === "bottom" && !goingDown)) {
        boundaryPushRef.current = 0;
        return;
      }

      boundaryPushRef.current += Math.abs(dy);

      // tuned knob
      const threshold = Math.max(250, scroller.clientHeight * 0.7);

      if (boundaryPushRef.current < threshold) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      boundaryPushRef.current = 0;

      snapLockRef.current = true;
      lastSnapTsRef.current = now;

      if (boundary === "bottom" && goingDown) snapTo(+1);
      else if (boundary === "top" && goingUp) snapTo(-1);

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
        if (selectedSection === "Timeline") return;

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

  const Group = ({ title, items, titleClassName = "" }) => (
    <div className="space-y-3">
      {!sidebarCollapsed && (
        <div className={`px-3 pt-3 pb-1 font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${titleClassName}`}>
          {title}
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

      {/* Collapsible Hero */}
      <div
        className="
          w-full z-30 bg-gradient-to-r from-purple-300 to-blue-300
          dark:from-purple-900 dark:to-blue-900 shadow-md relative overflow-hidden
          transition-[max-height] duration-400 ease-out
        "
        style={{ maxHeight: heroCollapsed ? 0 : heroMaxHeight }}
        aria-expanded={!heroCollapsed}
      >
        {/* Top-right controls */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 bg-white/80 dark:bg-[#26263a] text-gray-700 dark:text-white
                      border border-gray-200 dark:border-[#31314a] rounded-full shadow-sm
                      transition hover:ring-2 hover:dark:ring-purple-600 hover:ring-purple-300"
            title={sidebarCollapsed ? "Open menu" : "Close menu"}
            aria-label="Toggle sidebar"
          >
            <FiSidebar className={`${sidebarCollapsed ? "rotate-180" : "rotate-0"} transition-transform`} size={18} />
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 bg-[#26263a] text-white border border-[#31314a] rounded-full shadow-sm transition hover:ring-2 hover:ring-purple-600"
            title="Toggle dark mode"
          >
            {darkMode ? <FaSun className="text-yellow-400" /> : <FaMoon className="text-purple-400" />}
          </button>
        </div>

        <div className={`transition-all duration-400 ease-out ${heroCollapsed ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"}`}>
          <Hero darkMode={darkMode} />
        </div>

        {!heroCollapsed && (
          <HeroHandle collapsed={false} onToggle={() => setHero(true)} placement="bottom" width={120} height={22} />
        )}
      </div>

      {heroCollapsed && (
        <HeroHandle collapsed onToggle={() => setHero(false)} placement="top" width={120} height={22} />
      )}

      {/* Floating controls when hero is collapsed */}
      {heroCollapsed && (
        <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 bg-white/80 dark:bg-[#26263a] text-gray-700 dark:text-white
                      border border-gray-200 dark:border-[#31314a] rounded-full shadow-sm
                      transition hover:ring-2 hover:dark:ring-purple-600 hover:ring-purple-300"
            title={sidebarCollapsed ? "Open menu" : "Close menu"}
            aria-label="Toggle sidebar"
          >
            <FiSidebar className={`${sidebarCollapsed ? "rotate-180" : "rotate-0"} transition-transform`} size={18} />
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 bg-[#26263a] text-white border border-[#31314a] rounded-full shadow-sm transition hover:ring-2 hover:ring-purple-600"
            title="Toggle dark mode"
          >
            {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-purple-400" />}
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Sidebar */}
        <nav
          className={`
            shrink-0 flex flex-col relative ${sidebarRound}
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
            <button
              onClick={toggleSidebar}
              className="hidden md:inline-flex absolute mb-2 top-4 right-1 z-10 p-2
                        text-gray-700 dark:text-white rounded-full shadow-sm transition
                        hover:ring-2 hover:dark:ring-purple-500/60 hover:ring-purple-300/70
                        focus:outline-none focus:ring-2 focus:dark:ring-purple-500/60 focus:ring-purple-300/70
                        bg-white/10 dark:bg-[#0b0b12]/40 backdrop-blur-xl"
              title={sidebarCollapsed ? "Expand sidebar (Ctrl/Cmd + \\)" : "Collapse sidebar (Ctrl/Cmd + \\)"}
              aria-label="Toggle sidebar"
            >
              <FiSidebar size={16} className={`transform transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : "rotate-0"}`} />
            </button>

            <div className="pt-16 space-y-4">
              <ul className={`space-y-0.5 ${sidebarCollapsed ? "px-1" : "px-0"}`}>
                <li>
                  <NavButton label="About Me" active={selectedSection === "About Me"} onClick={() => goTo("About Me")} />
                </li>
              </ul>

              {!sidebarCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pt-4">
            <div className="space-y-4">
              <Group title="Recruiter" items={recruiterQuickLookBody} titleClassName="text-[11px] md:text-[11px]" />

              {!sidebarCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />}

              <Group title="Hiring Manager" items={hiringManagerQuickLookBody} titleClassName="text-[11px] md:text-[11px]" />

              {!sidebarCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />}

              <Group title="Explore" items={moreAboutMe} titleClassName="text-[11px] md:text-[11px]" />
            </div>
          </div>
        </nav>

        {/* Content + Footer column */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <main
            ref={mainScrollRef}
            onScroll={() => {
              const el = mainScrollRef.current;
              if (!el) return;
              sectionScrollRef.current.set(selectedSection, el.scrollTop);
            }}
            className="flex-1 overflow-y-auto p-4 sm:p-6 bg-transparent transition-colors"
            role="main"
          >
            <div
              className={`flex-1 overflow-y-auto p-6 pb-24 transition-opacity duration-200 ease-out ${
                isSectionTransitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              {sections[selectedSection]}
            </div>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
}

export default App;
