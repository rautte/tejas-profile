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
import { useEffect, useMemo, useState, useCallback } from "react";
import { GiConsoleController } from 'react-icons/gi';
import { FiSidebar } from "react-icons/fi";
import {
  FaUser, FaMapMarkedAlt, FaFileAlt, FaBriefcase,
  FaCogs, FaGraduationCap, FaProjectDiagram, FaTrophy,
  FaEnvelope, FaMoon, FaSun
} from 'react-icons/fa';

const ICONS = {
  "About Me": <FaUser className="text-lg" />,
  "Timeline": <FaMapMarkedAlt className="text-lg" />,
  "Resume": <FaFileAlt className="text-lg" />,
  "Experience": <FaBriefcase className="text-lg" />,
  "Skill": <FaCogs className="text-lg" />,
  "Education": <FaGraduationCap className="text-lg" />,
  "Project": <FaProjectDiagram className="text-lg" />,
  "Achievement": <FaTrophy className="text-lg" />,
  "Fun Zone": <GiConsoleController className="text-lg" />,
  "Connect": <FaEnvelope className="text-lg" />,
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
  }), [darkMode]);

  // --- group nav for recruiters vs more ---
  const recruiterQuickLook = [
    "About Me",
    "Experience",
    "Project",
    "Skill",
    "Resume",
  ];

  const moreAboutMe = [
    "Education",
    "Achievement",
    "Timeline",
    "Fun Zone",
    "Connect",
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

  // helpers
  const NavButton = ({ label, active, onClick }) => (
    <button
      className={`w-full text-left rounded-xl font-medium font-jakarta flex items-center gap-3 transition-all duration-200
        ${active
          ? 'bg-purple-100 dark:bg-purple-800 text-purple-900 dark:text-purple-100 shadow-inner ring-1 ring-purple-300 dark:ring-purple-600'
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
    <div className="space-y-2">
      {!sidebarCollapsed && (
        <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {title}
        </div>
      )}
      <ul className={`space-y-2 ${sidebarCollapsed ? 'px-1' : 'px-0'}`}>
        {items.map((label) => (
          <li key={label} className="relative group">
            {/* selection bar */}
            {!sidebarCollapsed && selectedSection === label && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-1.5 bg-purple-500 rounded-r-full shadow-md" />
            )}
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-[#181826] text-black dark:text-gray-200 transition-all">
      {/* Fixed Hero */}
      <div className="fixed top-0 left-0 w-full z-30 bg-gradient-to-r from-purple-300 to-blue-300 dark:from-purple-900 dark:to-blue-900 shadow-md">
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          {/* mobile sidebar toggle (only < md) */}
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 bg-white/80 dark:bg-[#26263a] text-gray-700 dark:text-white
                      border border-gray-200 dark:border-[#31314a] rounded-full shadow-sm
                      transition hover:ring-2 hover:dark:ring-purple-600 hover:ring-purple-300"
            title={sidebarCollapsed ? "Open menu" : "Close menu"}
            aria-label="Toggle sidebar"
          >
            <FiSidebar className={`${sidebarCollapsed ? 'rotate-180' : 'rotate-0'} transition-transform`} size={18} />
          </button>

          {/* theme toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 bg-[#26263a] text-white border border-[#31314a] rounded-full shadow-sm transition hover:ring-2 hover:ring-purple-600"
            title="Toggle dark mode"
          >
            {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-purple-400" />}
          </button>
        </div>
        <Hero darkMode={darkMode} />
      </div>

      {/* Main layout (responsive hero offset + responsive row/column) */}
      <div
        className="flex flex-1 overflow-hidden flex-col md:flex-row"
        style={{ paddingTop: 'min(28vh, 175px)' }}
      >
        {/* Sidebar */}
        <nav
          className={`
            shrink-0 flex flex-col relative
            backdrop-blur-xl bg-white/60 dark:bg-white/5 border-r border-gray-200 dark:border-gray-700 shadow-lg transition-all

            /* height & spacing */
            h-auto md:h-full pb-4 md:pb-6 md:mt-3

            /* width: full on mobile, fixed rail on desktop */
            ${sidebarCollapsed
              ? 'w-full px-2 md:w-[64px] md:px-2'
              : 'w-full px-4 md:w-[270px] md:px-4'
            }

            /* stack above main on mobile, normal order on desktop */
            order-1 md:order-none
          `}
          aria-label="Primary"
        >
          {/* --- Fixed (non-scrollable) header inside sidebar --- */}
          <div className={`shrink-0 relative ${sidebarCollapsed ? 'px-0' : 'px-0'}`}>
            {/* collapse button pinned top-right of the sidebar */}
            <button
              onClick={toggleSidebar}
              className="hidden md:inline-flex absolute mb-2 top-4 right-4 z-10 p-2 
                         text-gray-700 dark:text-white 
                         rounded-full shadow-sm transition hover:ring-2 hover:dark:ring-purple-600 hover:ring-purple-300"
              title={sidebarCollapsed ? "Expand sidebar (Ctrl/Cmd + \\)" : "Collapse sidebar (Ctrl/Cmd + \\)"}
              aria-label="Toggle sidebar"
            >
              <FiSidebar
                size={18}
                className={`transform transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : "rotate-0"}`}
              />
            </button>

            {/* leave room under the button; render pinned items */}
            <div className="pt-14 space-y-6">
              <ul className={`space-y-2 ${sidebarCollapsed ? 'px-1' : 'px-0'}`}>
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
          <div className="flex-1 overflow-y-auto no-scrollbar pt-6">
            <div className="space-y-6">
              <Group title="Recruiter Picks" items={recruiterQuickLookBody} />
              {!sidebarCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />}
              <Group title="Explore More" items={moreAboutMeBody} />
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



// // src/App.js
// // https://rautte.github.io/my-profile

// import './App.css';
// import './index.css';
// import Hero from "./components/Hero";
// import AboutMe from "./components/AboutMe";
// import Timeline from "./components/Timeline";
// import Resume from "./components/Resume";
// import Experience from "./components/Experience";
// import Skill from "./components/Skill";
// import Education from "./components/Education";
// import Project from "./components/Project";
// import Achievement from "./components/Achievement";
// import FunZone from "./components/FunZone";
// import Connect from "./components/Connect";
// import { useEffect, useMemo, useState, useCallback } from "react";
// import { GiConsoleController } from 'react-icons/gi';
// import { FiSidebar } from "react-icons/fi";
// import {
//   FaUser, FaMapMarkedAlt, FaFileAlt, FaBriefcase,
//   FaCogs, FaGraduationCap, FaProjectDiagram, FaTrophy,
//   FaEnvelope, FaMoon, FaSun
// } from 'react-icons/fa';

// const ICONS = {
//   "About Me": <FaUser className="text-lg" />,
//   "Timeline": <FaMapMarkedAlt className="text-lg" />,
//   "Resume": <FaFileAlt className="text-lg" />,
//   "Experience": <FaBriefcase className="text-lg" />,
//   "Skill": <FaCogs className="text-lg" />,
//   "Education": <FaGraduationCap className="text-lg" />,
//   "Project": <FaProjectDiagram className="text-lg" />,
//   "Achievement": <FaTrophy className="text-lg" />,
//   "Fun Zone": <GiConsoleController className="text-lg" />,
//   "Connect": <FaEnvelope className="text-lg" />,
// };

// function App() {
//   // --- theme ---
//   const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
//   useEffect(() => {
//     const root = document.documentElement;
//     if (darkMode) {
//       root.classList.add("dark");
//       localStorage.setItem("theme", "dark");
//     } else {
//       root.classList.remove("dark");
//       localStorage.setItem("theme", "light");
//     }
//   }, [darkMode]);

//   // --- sections (unchanged components) ---
//   const sections = useMemo(() => ({
//     "About Me": <AboutMe darkMode={darkMode} />,
//     "Timeline": <Timeline darkMode={darkMode} />,
//     "Resume": <Resume darkMode={darkMode} />,
//     "Experience": <Experience darkMode={darkMode} />,
//     "Skill": <Skill darkMode={darkMode} />,
//     "Education": <Education darkMode={darkMode} />,
//     "Project": <Project darkMode={darkMode} />,
//     "Achievement": <Achievement darkMode={darkMode} />,
//     "Fun Zone": <FunZone darkMode={darkMode} />,
//     "Connect": <Connect darkMode={darkMode} />,
//   }), [darkMode]);

//   // --- group nav for recruiters vs more ---
//   const recruiterQuickLook = [
//     "About Me",
//     "Experience",
//     "Project",
//     "Skill",
//     "Resume",
//   ];

//   const moreAboutMe = [
//     "Education",
//     "Achievement",
//     "Timeline",
//     "Fun Zone",
//     "Connect",
//   ];

//   // default section stays your previous default
//   const [selectedSection, setSelectedSection] = useState("About Me");

//   // --- collapsible sidebar state ---
//   const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
//     const saved = localStorage.getItem("sidebarCollapsed");
//     return saved ? JSON.parse(saved) : false;
//   });

//   useEffect(() => {
//     localStorage.setItem("sidebarCollapsed", JSON.stringify(sidebarCollapsed));
//   }, [sidebarCollapsed]);

//   const toggleSidebar = useCallback(() => {
//     setSidebarCollapsed((v) => !v);
//   }, []);

//   // keyboard: Ctrl/Cmd + \
//   useEffect(() => {
//     const handler = (e) => {
//       const isMac = navigator.platform.toUpperCase().includes('MAC');
//       if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "\\") {
//         e.preventDefault();
//         toggleSidebar();
//       }
//     };
//     window.addEventListener("keydown", handler);
//     return () => window.removeEventListener("keydown", handler);
//   }, [toggleSidebar]);

//   // helpers
//   const NavButton = ({ label, active, onClick }) => (
//     <button
//       className={`w-full text-left rounded-xl font-medium font-jakarta flex items-center gap-3 transition-all duration-200
//         ${active
//           ? 'bg-purple-100 dark:bg-purple-800 text-purple-900 dark:text-purple-100 shadow-inner ring-1 ring-purple-300 dark:ring-purple-600'
//           : 'hover:bg-purple-50 dark:hover:bg-[#2b2b3c] text-gray-700 dark:text-gray-300'
//         }
//         ${sidebarCollapsed ? 'px-3 py-2 justify-center' : 'px-5 py-2'}
//       `}
//       onClick={onClick}
//       title={sidebarCollapsed ? label : undefined}
//       aria-label={label}
//     >
//       <span className="shrink-0">{ICONS[label]}</span>
//       {!sidebarCollapsed && <span className="truncate">{label}</span>}
//     </button>
//   );

//   const Group = ({ title, items }) => (
//     <div className="space-y-2">
//       {!sidebarCollapsed && (
//         <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
//           {title}
//         </div>
//       )}
//       <ul className={`space-y-2 ${sidebarCollapsed ? 'px-1' : 'px-0'}`}>
//         {items.map((label) => (
//           <li key={label} className="relative group">
//             {/* selection bar */}
//             {!sidebarCollapsed && selectedSection === label && (
//               <span className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-1.5 bg-purple-500 rounded-r-full shadow-md" />
//             )}
//             <NavButton
//               label={label}
//               active={selectedSection === label}
//               onClick={() => setSelectedSection(label)}
//             />
//           </li>
//         ))}
//       </ul>
//     </div>
//   );

//   return (
//     <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-[#181826] text-black dark:text-gray-200 transition-all">
//       {/* Fixed Hero */}
//       <div className="fixed top-0 left-0 w-full z-30 bg-gradient-to-r from-purple-300 to-blue-300 dark:from-purple-900 dark:to-blue-900 shadow-md">
//         <div className="absolute top-4 right-4 z-50 flex items-center gap-2">

//           {/* theme toggle */}
//           <button
//             onClick={() => setDarkMode(!darkMode)}
//             className="p-2 bg-[#26263a] text-white border border-[#31314a] rounded-full shadow-sm transition hover:ring-2 hover:ring-purple-600"
//             title="Toggle dark mode"
//           >
//             {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-purple-400" />}
//           </button>
//         </div>
//         <Hero darkMode={darkMode} />
//       </div>

//       {/* Main layout (with top padding for fixed hero) */}
//       <div className="flex flex-1 pt-[175px] overflow-hidden">

//         {/* Sidebar */}
//         <nav
//           className={`
//             h-full pt-16 pb-6 overflow-y-auto no-scrollbar
//             backdrop-blur-xl bg-white/60 dark:bg-white/5 border-r border-gray-200 dark:border-gray-700 shadow-lg transition-all relative
//             ${sidebarCollapsed ? 'w-[64px] px-2' : 'w-[300px] px-4'}
//           `}
//           aria-label="Primary"
//         >
//           {/* collapse button (desktop) */}
//           <button
//             onClick={toggleSidebar}
//             className="hidden md:inline-flex absolute mb-2 top-4 right-4 z-10 p-2 
//                       text-gray-700 dark:text-white 
//                       rounded-full shadow-sm transition hover:ring-2 hover:dark:ring-purple-600 hover:ring-purple-300"
//             title={sidebarCollapsed ? "Expand sidebar (Ctrl/Cmd + \\)" : "Collapse sidebar (Ctrl/Cmd + \\)"}
//           >
//             <FiSidebar
//               size={18}
//               className={`transform transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : "rotate-0"}`}
//             />
//           </button>

//           {/* groups */}
//           <div className="space-y-6">
//             <Group title="Recruiter Picks" items={recruiterQuickLook} />
//             <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />
//             <Group title="Explore More" items={moreAboutMe} />
//           </div>
//         </nav>

//         {/* Main content */}
//         <main className="flex-1 overflow-y-auto p-6 bg-gray-50 backdrop-blur-xl dark:bg-[#181826] transition-colors">
//           {sections[selectedSection]}
//         </main>
//       </div>
//     </div>
//   );
// }

// export default App;

