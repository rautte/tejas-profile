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

// ✅ Icon imports
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

  // ✅ Dark mode state (load from localStorage if set)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // ✅ Apply or remove `dark` class on <html>
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
    // <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-black dark:text-white transition-all">
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white transition-all">
      {/* 🔘 Dark Mode Toggle (top-right corner) */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 bg-gray-200 dark:bg-gray-800 border border-gray-400 dark:border-gray-600 rounded-full shadow transition-all"
          title="Toggle dark mode"
        >
          {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-purple-700" />}
        </button>
      </div>

      {/* Top Hero Section */}
      <div className="w-full h-22 bg-gradient-to-r from-purple-300 to-blue-300 dark:from-purple-900 dark:to-blue-900 shadow-md">
        <Hero />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Navigation */}
        {/* <nav className="w-1/4 bg-white dark:bg-gray-800 shadow-lg p-4 overflow-y-auto transition-colors"> */}
        <nav className="w-1/4 bg-white dark:bg-gray-900 shadow-lg p-4 overflow-y-auto transition-colors">
          <ul className="space-y-4">
            {Object.keys(sections).map((section) => (
              <li key={section}>
                <button
                  className={`w-full text-left px-2 py-1 rounded font-medium text-xl font-epilogue flex items-center gap-2 transition-all ${
                    selectedSection === section
                      ? 'bg-purple-200 dark:bg-purple-700 text-black dark:text-white'
                      : 'hover:bg-purple-100 dark:hover:bg-purple-900'
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

        {/* Scrollable Section */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950 transition-colors">
          {sections[selectedSection]}
        </main>
      </div>
    </div>
  );
}

export default App;
