// src/App.js
// https://rautte.github.io/tejas-profile

import './App.css';
import './index.css';
import TicTacToeWeb from "./components/games/tictactoe/TicTacToeWeb";
import MinesweeperWeb from "./components/games/minesweeper/MinesweeperWeb";
import BattleshipWeb from "./components/games/battleship/BattleshipWeb";
import GameLayout from "./components/games/GameLayout";
// import { parseFunZoneRoute } from "lib/mp";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import AboutMe from "./components/AboutMe";
import Timeline from "./components/Timeline";
import Resume from "./components/Resume";
import Experience from "./components/Experience";
import Skills from "./components/Skills";
import Education from "./components/Education";
import Project from "./components/Project";
import Achievement from "./components/Achievement";
import FunZone from "./components/FunZone";
// import Connect from "./components/Connect";
import CodeLab from "./components/CodeLab";
import HeroHandle from "./components/HeroHandle";
import { useLayoutEffect, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { GiConsoleController } from 'react-icons/gi';
import { FiSidebar } from "react-icons/fi";
import {
  FaUser, FaMapMarkedAlt, FaFileAlt, FaBriefcase,
  FaCogs, FaGraduationCap, FaProjectDiagram, FaTrophy,
  FaMoon, FaSun, FaCode
} from 'react-icons/fa';

const ICONS = {
  "About Me": <FaUser className="text-sm" />,
  "Timeline": <FaMapMarkedAlt className="text-sm" />,
  "Resume": <FaFileAlt className="text-sm" />,
  "Experience": <FaBriefcase className="text-sm" />,
  "Skills": <FaCogs className="text-sm" />,
  "Education": <FaGraduationCap className="text-sm" />,
  "Projects": <FaProjectDiagram className="text-sm" />,
  "Achievement": <FaTrophy className="text-sm" />,
  "Fun Zone": <GiConsoleController className="text-sm" />,
  "Code Lab": <FaCode className="text-sm" />,
  // "Connect": <FaEnvelope className="text-sm" />,
};

const LABELS = [
  "About Me","Timeline","Resume","Experience","Skills",
  "Education","Projects","Achievement","Fun Zone","Code Lab"
  // "Education","Project","Achievement","Fun Zone","Connect","Code Lab"
];

const toSlug = (label) =>
  label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

const SLUG_TO_LABEL = LABELS.reduce((acc, l) => {
  acc[toSlug(l)] = l;
  return acc;
}, {});


// ——— Dark mode bootstrap helper (single source of truth) ———
function getInitialTheme() {
  try {
    // 1) URL param override: ?theme=dark|light
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("theme");
    if (fromQuery === "dark") return true;
    if (fromQuery === "light") return false;

    // 2) stored preference
    const stored = sessionStorage.getItem("theme") || localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;

    // 3) OS preference
    if (window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
  } catch {}
  return false;
}

// Accepts: "fun-zone/battleship", "fun-zone/battleship-AX9G", "fun-zone/minesweeper", "fun-zone/tictactoe"
function parseFunZoneRoute(rawHashPath) {
  const path = decodeURIComponent((rawHashPath || "").trim()).toLowerCase();
  // quick-accept fun-zone only
  if (!path.startsWith("fun-zone/")) return { game: null, code: null };

  // battleship variants
  let m = path.match(/^fun-zone\/battleship(?:-([a-z0-9]{4}))?(?:[/?].*)?$/i);
  if (m) return { game: "battleship", code: m[1] ? m[1].toUpperCase() : null };

  if (/^fun-zone\/minesweeper(?:[/?].*)?$/.test(path)) return { game: "minesweeper", code: null };
  if (/^fun-zone\/tictactoe(?:[/?].*)?$/.test(path))   return { game: "tictactoe", code: null };

  return { game: null, code: null };
}

function App() {
  // --- theme (single source of truth, no flash) ---
  const [darkMode, setDarkMode] = useState(getInitialTheme);

  // Apply/remove the class BEFORE paint to avoid flashing
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      // persist to both so any route/page can read it immediately
      sessionStorage.setItem("theme", darkMode ? "dark" : "light");
      localStorage.setItem("theme", darkMode ? "dark" : "light");
    } catch {}
  }, [darkMode]);

  // Keep in sync with OS changes (only if user hasn’t explicitly chosen this session)
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      const explicit = sessionStorage.getItem("theme");
      if (!explicit) setDarkMode(e.matches);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // --- sections (unchanged components) ---
  const sections = useMemo(() => ({
    "About Me": <AboutMe darkMode={darkMode} />,
    "Timeline": <Timeline darkMode={darkMode} />,
    "Resume": <Resume darkMode={darkMode} />,
    "Experience": <Experience darkMode={darkMode} />,
    "Skills": <Skills darkMode={darkMode} />,
    "Education": <Education darkMode={darkMode} />,
    "Projects": <Project darkMode={darkMode} />,
    "Achievement": <Achievement darkMode={darkMode} />,
    "Fun Zone": <FunZone darkMode={darkMode} />,
    // "Connect": <Connect darkMode={darkMode} />,
    "Code Lab": <CodeLab darkMode={darkMode} />,
  }), [darkMode]);

  // --- group nav for recruiters vs more ---
  const recruiterQuickLook = [
    "About Me",
    "Experience",
    "Skills",
    "Education",
    "Resume",
    // "Connect",
  ];

  const hiringManagerQuickLookBody = [
    "Projects",
    "Code Lab", 
    "Fun Zone",
  ];

  const moreAboutMe = [
    "Achievement",
    "Timeline",
  ];

  const goTo = useCallback((label) => {
    setSelectedSection(label);
  }, []);

  // Keep app in sync when user uses browser back/forward
  useEffect(() => {
    const onHash = () => {
      const raw = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      const label = SLUG_TO_LABEL[raw];
      if (label) setSelectedSection(label);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // items to pin in non-scrollable header
  // const PINNED = ["About Me", "Connect"];
  const PINNED = ["About Me"];
  const recruiterQuickLookBody = recruiterQuickLook.filter(i => !PINNED.includes(i));
  // const moreAboutMeBody = moreAboutMe.filter(i => !PINNED.includes(i));

  // figure initial section from hash once
  const initialSection = (() => {
    const raw = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    return SLUG_TO_LABEL[raw] || "About Me";
  })();

  const [selectedSection, setSelectedSection] = useState(initialSection);

  const [hashPath, setHashPath] = useState(() =>
    window.location.hash.replace(/^#\/?/, '').toLowerCase()
  );

  useEffect(() => {
    const onHashOnly = () => {
      const raw = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      setHashPath(raw);
    };
    window.addEventListener('hashchange', onHashOnly);
    return () => window.removeEventListener('hashchange', onHashOnly);
  }, []);

  // whenever the selected section changes, write hash like #/project
  useEffect(() => {
  if (hashPath.startsWith('fun-zone/')) return; // don't clobber game routes
    const slug = toSlug(selectedSection);
    if (window.location.hash !== `#/${slug}`) {
      window.location.hash = `/${slug}`;
    }
  }, [selectedSection, hashPath]);

  // --- collapsible sidebar state ---
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(v => !v);
  }, []);

  // keyboard: Ctrl/Cmd + \
  useEffect(() => {
    const handler = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
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
    const mq = window.matchMedia("(max-width: 1024px)"); // lg breakpoint
    const apply = () => setSidebarCollapsed(true);
    // const relax = () => setSidebarCollapsed(prev => (mq.matches ? true : prev));

    // initialize
    if (mq.matches) setSidebarCollapsed(true);

    // react to changes
    const listener = (e) => (e.matches ? apply() : setSidebarCollapsed(false));
    mq.addEventListener?.("change", listener);
    return () => mq.removeEventListener?.("change", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // treat About Me & Connect as pinned
  // const PINNED_SET = useMemo(() => new Set(["About Me", "Connect"]), []);
  const PINNED_SET = useMemo(() => new Set(["About Me"]), []);

  // used to skip one forced-expand after a *user collapse* on a pinned section
  const skipNextPinnedExpand = useRef(false);

  // one shared collapse state for ALL non-pinned sections
  // default for non-pinned on first load (per tab) = collapsed (true)
  const [sharedCollapsed, setSharedCollapsed] = useState(true);

  // per-view hero state (drives the UI for the current section)
  const [heroCollapsed, setHeroCollapsed] = useState(
    PINNED_SET.has(initialSection) ? false : sharedCollapsed
  );

  // When the selected section changes:
  // - pinned: always show hero (expanded) on navigation
  // - non-pinned: adopt whatever the shared state currently is
  useEffect(() => {
    const isPinned = PINNED_SET.has(selectedSection);

    if (isPinned) {
      // If the *immediately previous* action was a user-driven collapse on a pinned section,
      // honor that once (so no double click), then clear the flag.
      if (skipNextPinnedExpand.current) {
        skipNextPinnedExpand.current = false;
        // keep whatever heroCollapsed currently is (collapsed)
        return;
      }
      // Normal rule: pinned sections show hero when navigated to or when shared changes.
      setHeroCollapsed(false);
    } else {
      // Non-pinned sections mirror the shared state.
      setHeroCollapsed(sharedCollapsed);
    }
  }, [selectedSection, sharedCollapsed, PINNED_SET]);

  // unified setter used by your HeroHandle
  // - In pinned sections: collapsing propagates to shared; expanding does NOT.
  // - In non-pinned sections: keep shared in sync with current toggle.
  const setHero = useCallback(
    (collapsed) => {
      setHeroCollapsed(collapsed);

      if (PINNED_SET.has(selectedSection)) {
        if (collapsed) {
          // collapse from pinned -> propagate to shared AND skip one auto-expand
          setSharedCollapsed(true);
          skipNextPinnedExpand.current = true;   // <<< key line
        }
        // expanding from pinned: do NOT touch shared
      } else {
        // non-pinned: keep shared in sync
        setSharedCollapsed(collapsed);
      }
    },
    [selectedSection, PINNED_SET]
  );

  // helper: the target max-height for the hero when expanded
  // matches previous visual (~175px cap, but responsive up to 28vh)
  const heroMaxHeight = "min(28vh, 175px)";

  // helpers
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
        ${sidebarCollapsed ? 'px-3 py-2 justify-center' : 'px-5 py-2'}
        /* keep text color constant so only the box changes */
        text-gray-700 dark:text-gray-300
      `}
    >
      {/* background highlight box (only this scales) */}
      <span
        className={`
          pointer-events-none absolute inset-0 rounded-xl z-0
          transition-transform transition-colors transition-shadow duration-200
          ${active
            ? 'bg-purple-100 dark:bg-purple-800 text-purple-900 dark:text-purple-100 shadow-inner ring-1 ring-inset ring-purple-300 dark:ring-purple-600 scale-[0.92]'
            : 'group-hover:bg-purple-50 group-hover:dark:bg-[#2b2b3c] group-hover:text-gray-700 group-hover:dark:text-gray-300 group-hover:scale-[0.92]'
          }
        `}
        style={{ transformOrigin: 'center' }}
      />

      {/* content stays crisp, above the bg box */}
      <span className="relative z-10 flex items-center gap-3">
        <span className="shrink-0">{ICONS[label]}</span>
        {!sidebarCollapsed && <span className="truncate">{label}</span>}
      </span>
    </button>
  );

  const Group = ({ title, items, titleClassName = "" }) => (
    <div className="space-y-3">
      {!sidebarCollapsed && (
        <div
          className={`px-3 pt-3 pb-1 font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${titleClassName}`}
        >
          {title}
        </div>
      )}
      <ul className={`space-y-0.5 ${sidebarCollapsed ? 'px-1' : 'px-0'}`}>
        {items.map((label) => (
          <li key={label} className="relative group">
            <NavButton
              label={label}
              active={selectedSection === label}
              onClick={() => goTo(label)}
            />
          </li>
        ))}
      </ul>
    </div>
  );

  const sidebarRound = heroCollapsed ? "rounded-none md:rounded-md" : "rounded-md";

  // treat any #/games/* as a game page
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
      // Hide title on the landing (no code); show room title when code is present
      title = code ? `Battleship — Room ${code}` : "Battleship";
      gameElement = <BattleshipWeb />;
    }

    return (
      <GameLayout title={title} darkMode={darkMode} setDarkMode={setDarkMode}>
        {gameElement ?? (
          <div className="text-gray-700 dark:text-gray-300">
            Unknown game. <a className="underline" href="#/fun-zone">Back to Fun Zone</a>
          </div>
        )}
      </GameLayout>
    );
  }


  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-[#181826] text-black dark:text-gray-200 transition-all">

      {/* Collapsible Hero (in normal flow so the rest moves in sync) */}
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
            title={sidebarCollapsed ? 'Open menu' : 'Close menu'}
            aria-label="Toggle sidebar"
          >
            <FiSidebar className={`${sidebarCollapsed ? 'rotate-180' : 'rotate-0'} transition-transform`} size={18} />
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 bg-[#26263a] text-white border border-[#31314a] rounded-full shadow-sm transition hover:ring-2 hover:ring-purple-600"
            title="Toggle dark mode"
          >
            {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-purple-400" />}
          </button>
        </div>

        {/* Hero content with a soft appear/scale when expanding */}
        <div
          className={`
            transition-all duration-400 ease-out
            ${heroCollapsed ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'}
          `}
        >
          <Hero darkMode={darkMode} />
        </div>

        {/* Bottom-center handle when expanded */}
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

      {/* Sticky top-center handle when collapsed (outside hero) */}
      {heroCollapsed && (
        <HeroHandle
          collapsed
          onToggle={() => setHero(false)}
          placement="top"
          width={120}
          height={22}
        />
      )}

      {/* Floating controls when hero is collapsed (so the toggle doesn’t vanish) */}
      {heroCollapsed && (
        <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
          {/* mobile sidebar toggle (optional to keep) */}
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 bg-white/80 dark:bg-[#26263a] text-gray-700 dark:text-white
                      border border-gray-200 dark:border-[#31314a] rounded-full shadow-sm
                      transition hover:ring-2 hover:dark:ring-purple-600 hover:ring-purple-300"
            title={sidebarCollapsed ? 'Open menu' : 'Close menu'}
            aria-label="Toggle sidebar"
          >
            <FiSidebar className={`${sidebarCollapsed ? 'rotate-180' : 'rotate-0'} transition-transform`} size={18} />
          </button>

          {/* theme toggle (duplicate shown only while collapsed) */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 bg-[#26263a] text-white border border-[#31314a] rounded-full shadow-sm transition hover:ring-2 hover:ring-purple-600"
            title="Toggle dark mode"
          >
            {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-purple-400" />}
          </button>
        </div>
      )}

      {/* Main layout (responsive hero offset + responsive row/column) */}
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
            ${sidebarCollapsed ? 'w-full px-2 md:w-[58px] md:px-2' : 'w-full px-4 md:w-[220px] md:px-4'}
            order-1 md:order-none
          `}
          aria-label="Primary"
        >
          {/* sheen overlay (purely visual) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg
                      bg-gradient-to-b from-white/25 to-transparent
                      dark:from-white/10
                      [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.6),rgba(0,0,0,0.2)_60%,transparent)]"
          />

          {/* --- Fixed (non-scrollable) header inside sidebar --- */}
          <div className={`shrink-0 relative ${sidebarCollapsed ? 'px-0' : 'px-0'}`}>
            {/* collapse button pinned top-right of the sidebar */}
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
              <FiSidebar
                size={16}
                className={`transform transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : "rotate-0"}`}
              />
            </button>

            {/* leave room under the button; render pinned items */}
            <div className="pt-16 space-y-4">
              <ul className={`space-y-0.5 ${sidebarCollapsed ? 'px-1' : 'px-0'}`}>
                <li>
                  <NavButton
                    label="About Me"
                    active={selectedSection === "About Me"}
                    onClick={() => goTo("About Me")}
                  />
                </li>
                {/* <li>
                  <NavButton
                    label="Connect"
                    active={selectedSection === "Connect"}
                    onClick={() => goTo("Connect")}
                  />
                </li> */}
              </ul>

              {/* divider visible only when expanded */}
              {!sidebarCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />}
            </div>
          </div>

          {/* --- Scrollable area for the rest --- */}
          <div className="flex-1 overflow-y-auto no-scrollbar pt-4">
            <div className="space-y-4">
              <Group
                title="Recruiter"
                items={recruiterQuickLookBody}
                titleClassName="text-[11px] md:text-[11px]"
              />

              {!sidebarCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />}

              <Group
                title="Hiring Manager" // Was 'Explore'
                items={hiringManagerQuickLookBody}
                titleClassName="text-[11px] md:text-[11px]"
              />

              {!sidebarCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />}

              <Group
                title="Explore"
                items={moreAboutMe}
                titleClassName="text-[11px] md:text-[11px]"
              />
            </div>
          </div>
        </nav>

        {/* Content + Footer column */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Scrollable content */}
          <main
            className="flex-1 overflow-y-auto p-4 sm:p-6
                      bg-gray-50 backdrop-blur-xl
                      dark:bg-[#181826] transition-colors"
            role="main"
          >
            <div className="flex-1 overflow-y-auto p-6 pb-24">
              {sections[selectedSection]}
            </div>
          </main>

          {/* Footer always visible */}
          <Footer />
        </div>
      </div>
    </div>
  );
}

export default App;


