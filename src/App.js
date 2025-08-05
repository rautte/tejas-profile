// src/App.js
// https://rautte.github.io/my-profile/

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
import { useState } from "react";

// ✅ Icon imports
import { FaUser, FaRegCalendarAlt, FaFileAlt, FaBriefcase, FaTools, FaGraduationCap, FaProjectDiagram, FaTrophy, FaGamepad, FaEnvelope } from 'react-icons/fa';

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

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Hero Section */}
      <div className="w-full h-22 bg-gradient-to-r from-purple-300 to-blue-300 shadow-md">
        <Hero />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Navigation */}
        <nav className="w-1/4 bg-white shadow-lg p-4 overflow-y-auto">
          <ul className="space-y-4">
            {Object.keys(sections).map((section) => (
              <li key={section}>
                <button
                  className={`w-full text-left px-2 py-1 rounded hover:bg-purple-100 font-medium text-xl font-epilogue flex items-center gap-2 ${selectedSection === section ? 'bg-purple-200' : ''}`}
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
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {sections[selectedSection]}
        </main>
      </div>
    </div>
  );
}

export default App;
