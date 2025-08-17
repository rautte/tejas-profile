// src/App.js
// https://rautte.github.io/my-profile

import './App.css';
import './index.css';
import Hero from "./components/Hero";
import AboutMe from "./components/AboutMe";
import Timeline from "./components/Timeline";
import Resume from "./components/Resume";
import Experience from "./components/Experience";
import Skill from "./components/Skill";
import Education from "./components/Education";
import Project from "./components/Project";
import Achievement from "./components/Achievement";
import FunZone from "./components/FunZone";
import Connect from "./components/Connect";
import CodeLab from "./components/CodeLab";
import HeroHandle from "./components/HeroHandle";
import { useEffect, useMemo, useState, useCallback } from "react";
import { GiConsoleController } from 'react-icons/gi';
import { FiSidebar } from "react-icons/fi";
import {
  FaUser, FaMapMarkedAlt, FaFileAlt, FaBriefcase,
  FaCogs, FaGraduationCap, FaProjectDiagram, FaTrophy,
  FaEnvelope, FaMoon, FaSun, FaCode
} from 'react-icons/fa';

const ICONS = {
  "About Me": <FaUser className="text-sm" />,
  "Timeline": <FaMapMarkedAlt className="text-sm" />,
  "Resume": <FaFileAlt className="text-sm" />,
  "Experience": <FaBriefcase className="text-sm" />,
  "Skill": <FaCogs className="text-sm" />,
  "Education": <FaGraduationCap className="text-sm" />,
  "Project": <FaProjectDiagram className="text-sm" />,
  "Achievement": <FaTrophy className="text-sm" />,
  "Fun Zone": <GiConsoleController className="text-sm" />,
  "Code Lab": <FaCode className="text-sm" />,
  "Connect": <FaEnvelope className="text-sm" />,
};

function App() {
  // --- theme ---
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // --- sections (unchanged components) ---
  const sections = useMemo(() => ({
    "About Me": <AboutMe darkMode={darkMode} />,
    "Timeline": <Timeline darkMode={darkMode} />,
    "Resume": <Resume darkMode={darkMode} />,
    "Experience": <Experience darkMode={darkMode} />,
    "Skill": <Skill darkMode={darkMode} />,
    "Education": <Education darkMode={darkMode} />,
    "Project": <Project darkMode={darkMode} />,
    "Achievement": <Achievement darkMode={darkMode} />,
    "Fun Zone": <FunZone darkMode={darkMode} />,
    "Connect": <Connect darkMode={darkMode} />,
    "Code Lab": <CodeLab darkMode={darkMode} />,
  }), [darkMode]);

  // --- group nav for recruiters vs more ---
  const recruiterQuickLook = [
    "About Me",
    "Education",
    "Experience",
    "Project",
    "Skill",
    "Resume",
    "Connect",
  ];

  const moreAboutMe = [
    "Achievement",
    "Code Lab", 
    "Timeline",
    "Fun Zone",
  ];

  // items to pin in non-scrollable header
  const PINNED = ["About Me", "Connect"];
  const recruiterQuickLookBody = recruiterQuickLook.filter(i => !PINNED.includes(i));
  const moreAboutMeBody = moreAboutMe.filter(i => !PINNED.includes(i));

  // default section
  const [selectedSection, setSelectedSection] = useState("About Me");

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
    const relax = () => setSidebarCollapsed(prev => (mq.matches ? true : prev));

    // initialize
    if (mq.matches) setSidebarCollapsed(true);

    // react to changes
    const listener = (e) => (e.matches ? apply() : setSidebarCollapsed(false));
    mq.addEventListener?.("change", listener);
    return () => mq.removeEventListener?.("change", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- hero collapse state ---
  const [heroCollapsed, setHeroCollapsed] = useState(() => {
    return localStorage.getItem("heroCollapsed") === "1";
  });
  useEffect(() => {
    localStorage.setItem("heroCollapsed", heroCollapsed ? "1" : "0");
  }, [heroCollapsed]);

  // helper: the target max-height for the hero when expanded
  // matches your previous visual (~175px cap, but responsive up to 28vh)
  const heroMaxHeight = "min(28vh, 175px)";

  // helpers
  const NavButton = ({ label, active, onClick }) => (
    <button
      className={`w-full text-left rounded-xl font-medium font-jakarta flex items-center gap-3 transition-all duration-200 text-sm md:text-[15px]   /* smaller font size */
        ${active
          ? 'bg-purple-100 dark:bg-purple-800 text-purple-900 dark:text-purple-100 shadow-inner ring-1 ring-inset ring-purple-300 dark:ring-purple-600'
          : 'hover:bg-purple-50 dark:hover:bg-[#2b2b3c] text-gray-700 dark:text-gray-300'
        }
        ${sidebarCollapsed ? 'px-3 py-2 justify-center' : 'px-5 py-2'}
      `}
      onClick={onClick}
      title={sidebarCollapsed ? label : undefined}
      aria-label={label}
    >
      <span className="shrink-0">{ICONS[label]}</span>
      {!sidebarCollapsed && <span className="truncate">{label}</span>}
    </button>
  );

  const Group = ({ title, items }) => (
    <div className="space-y-3">
      {!sidebarCollapsed && (
        <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {title}
        </div>
      )}
      <ul className={`space-y-1 ${sidebarCollapsed ? 'px-1' : 'px-0'}`}>
        {items.map((label) => (
          <li key={label} className="relative group">
            <NavButton
              label={label}
              active={selectedSection === label}
              onClick={() => setSelectedSection(label)}
            />
          </li>
        ))}
      </ul>
    </div>
  );

  const sidebarRound = heroCollapsed ? "rounded-none md:rounded-md" : "rounded-md";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-[#181826] text-black dark:text-gray-200 transition-all">

      {/* Collapsible Hero (in normal flow so the rest moves in sync) */}
      <div
        className="
          w-full z-30 bg-gradient-to-r from-purple-300 to-blue-300
          dark:from-purple-900 dark:to-blue-900 shadow-md relative overflow-hidden
          transition-[max-height] duration-400 ease-out
        "
        style={{
          maxHeight: heroCollapsed ? 0 : heroMaxHeight,
        }}
        aria-expanded={!heroCollapsed}
      >
        {/* Top-right controls (unchanged) */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          {/* mobile sidebar toggle stays if you want it; otherwise remove */}
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

          {/* theme toggle (unchanged) */}
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
            onToggle={() => setHeroCollapsed(true)}
            placement="bottom"
            width={120}
            height={22}
          />
        )}
      </div>

      {/* Sticky top-center handle when collapsed */}
      {heroCollapsed && (
        <HeroHandle
          collapsed
          onToggle={() => setHeroCollapsed(false)}
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
            ${sidebarCollapsed ? 'w-full px-2 md:w-[59px] md:px-2' : 'w-full px-4 md:w-[220px] md:px-4'}
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
            <div className="pt-16 space-y-5">
              <ul className={`space-y-1 ${sidebarCollapsed ? 'px-1' : 'px-0'}`}>
                <li>
                  <NavButton
                    label="About Me"
                    active={selectedSection === "About Me"}
                    onClick={() => setSelectedSection("About Me")}
                  />
                </li>
                <li>
                  <NavButton
                    label="Connect"
                    active={selectedSection === "Connect"}
                    onClick={() => setSelectedSection("Connect")}
                  />
                </li>
              </ul>

              {/* divider visible only when expanded */}
              {!sidebarCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />}
            </div>
          </div>

          {/* --- Scrollable area for the rest --- */}
          <div className="flex-1 overflow-y-auto no-scrollbar pt-5">
            <div className="space-y-5">
              <Group title="Recruiter" items={recruiterQuickLookBody} />
              {!sidebarCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />}
              <Group title="Explore" items={moreAboutMeBody} />
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main
          className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 bg-gray-50 backdrop-blur-xl dark:bg-[#181826] transition-colors order-2"
          role="main"
        >
          {sections[selectedSection]}
        </main>
      </div>
    </div>
  );
}

export default App;

