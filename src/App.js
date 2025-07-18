// import logo from './logo.svg';
// import './App.css';
// import './index.css';
// import Hero from "./components/Hero";
// import About from "./components/About";
// import Projects from "./components/Projects";
// import Fun from "./components/Fun";
// import Contact from "./components/Contact";

// function App() {
//   return (
//     <div className="bg-gradient-to-br from-purple-100 to-blue-100 min-h-screen font-sans">
//       <Hero />
//       <About />
//       <Projects />
//       <Fun />         {/* 👈 New section for your games */}
//       <Contact />
//     </div>
//   );
// }

// export default App;



// src/App.js
import './App.css';
import './index.css';
import Hero from "./components/Hero";
import About from "./components/About";
import Projects from "./components/Projects";
import Fun from "./components/Fun";
import Contact from "./components/Contact";
import { useState } from "react";

const sections = {
  About: <About />, // These should be real components
  Projects: <Projects />,
  Fun: <Fun />,
  Contact: <Contact />,
};

function App() {
  const [selectedSection, setSelectedSection] = useState("About");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Hero Section */}
      <div className="w-full h-24 bg-gradient-to-r from-purple-300 to-blue-300 shadow-md">
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
                  className={`w-full text-left px-2 py-1 rounded hover:bg-purple-100 font-medium ${selectedSection === section ? 'bg-purple-200' : ''}`}
                  onClick={() => setSelectedSection(section)}
                >
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