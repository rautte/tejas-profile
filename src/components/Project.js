import { useState, useRef, useEffect } from "react";
import ProjectCard from "./ProjectCard";

export default function Project() {
  const allProjects = [
    {
      title: "Portfolio Website",
      description: "Personal portfolio to showcase my skills, projects, and resume.",
      stack: ["React", "TailwindCSS", "GitHub Pages"],
      github: "https://github.com/rautte/my-profile",
      demo: "https://rautte.github.io/my-profile/",
      status: "✅ Deployed"
    },
    {
      title: "AI Chatbot",
      description: "Built a Python-based chatbot with NLTK and PyTorch, served via FastAPI.",
      stack: ["Python", "FastAPI", "NLTK", "PyTorch"],
      github: "https://github.com/rautte/ai-chatbot",
      status: "🛠️ In Progress"
    },
    {
      title: "E-commerce API",
      description: "RESTful API with authentication, product listings, and checkout flow.",
      stack: ["Node.js", "Express", "MongoDB", "JWT"],
      github: "https://github.com/rautte/ecommerce-api",
      status: "✅ Deployed"
    },
  ];

  const allTechs = [...new Set(allProjects.flatMap(p => p.stack))];
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleTech = (tech) => {
    setSelectedTechs((prev) =>
      prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]
    );
  };

  const filteredProjects = selectedTechs.length === 0
    ? allProjects
    : allProjects.filter(p => p.stack.some(tech => selectedTechs.includes(tech)));

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <section className="py-16 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        <h2 className="text-3xl font-bold text-center text-purple-700 dark:text-purple-300 font-epilogue">
          Projects
        </h2>

        {/* Multi-Select Dropdown Filter */}
        <div className="relative w-fit mx-auto" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="px-4 py-2 bg-white dark:bg-[#2b2b3c] text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded shadow font-medium"
          >
            {selectedTechs.length > 0
              ? `Filter by: ${selectedTechs.join(", ")}`
              : "🔽 Filter by Tech Stack"}
          </button>

          {dropdownOpen && (
            <div className="absolute z-10 mt-2 w-60 bg-white dark:bg-[#2b2b3c] border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
              {allTechs.map((tech, idx) => (
                <label
                  key={idx}
                  className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#3d3d55] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={selectedTechs.includes(tech)}
                    onChange={() => toggleTech(tech)}
                  />
                  <span className="text-gray-800 dark:text-gray-200">{tech}</span>
                </label>
              ))}
              <div className="px-4 py-2">
                <button
                  onClick={() => setSelectedTechs([])}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Project Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((proj, idx) => (
            <ProjectCard key={idx} {...proj} />
          ))}
        </div>
      </div>
    </section>
  );
}
