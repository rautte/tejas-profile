// src/App.js
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

const sections = {
  "About Me": <AboutMe />,
  "Timeline": <Timeline />,
  "Resume": <Resume />,
  "Experience": <Experience />,
  "Skill": <Skill />,
  "Education": <Education />,
  "Project": <Project />,
  "Achievement": <Achievement />,
  "Fun Zone": <FunZone />,
  "Contact": <Contact />,
};

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

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-[#181826] text-black dark:text-gray-200 transition-all">
      {/* Dark mode toggle */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 bg-[#26263a] text-white border border-[#31314a] rounded-full shadow-sm transition hover:ring-2 hover:ring-purple-600"
          title="Toggle dark mode"
        >
          {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-purple-400" />}
        </button>
      </div>

      {/* Hero section */}
      <div className="w-full h-22 bg-gradient-to-r from-purple-300 to-blue-300 dark:from-purple-900 dark:to-blue-900 shadow-md">
        <Hero />
      </div>

      {/* Main content layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {/* <nav className="w-1/4 bg-white dark:bg-[#1c1c2e] shadow-md p-4 overflow-y-auto"> */}
        <nav className="w-[280px] bg-white dark:bg-[#1c1c2e] shadow-md p-4 overflow-y-auto transition-colors">
          <ul className="space-y-4">
            {Object.keys(sections).map((section) => (
              <li key={section}>
                <button
                  className={`w-full text-left px-2 py-1 rounded font-medium text-xl font-epilogue flex items-center gap-2 transition-all ${
                    selectedSection === section
                      ? 'bg-purple-200 dark:bg-purple-700 text-black dark:text-white'
                      : 'hover:bg-purple-100 dark:hover:bg-[#31314a]'
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

        {/* Main section */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-[#181826] transition-colors">
          {sections[selectedSection]}
        </main>
      </div>
    </div>
  );
}

export default App;
