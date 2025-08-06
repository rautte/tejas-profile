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
import Contact from "./components/Contact";
import { useEffect, useState } from "react";
import {
  FaUser, FaRegCalendarAlt, FaFileAlt, FaBriefcase,
  FaTools, FaGraduationCap, FaProjectDiagram, FaTrophy,
  FaGamepad, FaEnvelope, FaMoon, FaSun
} from 'react-icons/fa';

const icons = {
  "About Me": <FaUser className="inline-block mr-2" />,
  "Timeline": <FaRegCalendarAlt className="inline-block mr-2" />,
  "Resume": <FaFileAlt className="inline-block mr-2" />,
  "Experience": <FaBriefcase className="inline-block mr-2" />,
  "Skill": <FaTools className="inline-block mr-2" />,
  "Education": <FaGraduationCap className="inline-block mr-2" />,
  "Project": <FaProjectDiagram className="inline-block mr-2" />,
  "Achievement": <FaTrophy className="inline-block mr-2" />,
  "Fun Zone": <FaGamepad className="inline-block mr-2" />,
  "Contact": <FaEnvelope className="inline-block mr-2" />,
};

function App() {
  const [selectedSection, setSelectedSection] = useState("About Me");
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

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

  const sections = {
    "About Me": <AboutMe darkMode={darkMode} />,
    "Timeline": <Timeline darkMode={darkMode} />,
    "Resume": <Resume darkMode={darkMode} />,
    "Experience": <Experience darkMode={darkMode} />,
    "Skill": <Skill darkMode={darkMode} />,
    "Education": <Education darkMode={darkMode} />,
    "Project": <Project darkMode={darkMode} />,
    "Achievement": <Achievement darkMode={darkMode} />,
    "Fun Zone": <FunZone darkMode={darkMode} />,
    "Contact": <Contact darkMode={darkMode} />,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-[#181826] text-black dark:text-gray-200 transition-all">

      {/* Fixed Hero */}
      <div className="fixed top-0 left-0 w-full z-30 bg-gradient-to-r from-purple-300 to-blue-300 dark:from-purple-900 dark:to-blue-900 shadow-md">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 bg-[#26263a] text-white border border-[#31314a] rounded-full shadow-sm transition hover:ring-2 hover:ring-purple-600"
            title="Toggle dark mode"
          >
            {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-purple-400" />}
          </button>
        </div>
        <Hero darkMode={darkMode} />
        {/* <div className="w-full h-px bg-gray-300 dark:bg-gray-700" /> */}
      </div>

      {/* Main content layout with top padding for fixed hero */}
      <div className="flex flex-1 pt-[175px] overflow-hidden">
        {/* Sidebar */}
        <nav className="w-[300px] h-full px-4 py-6 backdrop-blur-xl bg-white/60 dark:bg-white/5 border-r border-gray-200 dark:border-gray-700 shadow-lg transition-all relative">
          <ul className="space-y-2 relative">
            {Object.keys(sections).map((section, index) => (
              <li key={section} className="relative group">
                {/* Glowing selection bar */}
                {selectedSection === section && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-1.5 bg-purple-500 rounded-r-full shadow-md transition-all" />
                )}

                <button
                  className={`w-full text-left px-5 py-2 rounded-xl font-medium text-[1.05rem] font-jakarta flex items-center gap-3 transition-all duration-200
                    ${
                      selectedSection === section
                        ? 'bg-purple-100 dark:bg-purple-800 text-purple-900 dark:text-purple-100 shadow-inner ring-1 ring-purple-300 dark:ring-purple-600'
                        : 'hover:bg-purple-50 dark:hover:bg-[#2b2b3c] text-gray-700 dark:text-gray-300'
                    }`}
                  onClick={() => setSelectedSection(section)}
                >
                  {icons[section]}
                  {section}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main scrollable section */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 backdrop-blur-xl dark:bg-[#181826] transition-colors">
          {sections[selectedSection]}
        </main>
      </div>
    </div>
  );
}

export default App;
