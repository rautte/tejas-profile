import React, { useState, useEffect, useRef } from "react";
import { HiOutlineFilter } from "react-icons/hi";
// import ProjectCard from "./ProjectCard";



// Sample project data
const allProjects = [
  {
    title: "Smart Chatbot",
    description: "An AI-powered chatbot using NLP and PyTorch.",
    techStack: ["React", "Python", "PyTorch", "NLTK"],
    domain: "AI/ML",
    industry: "Tech",
    github: "https://github.com/rautte/chatbot",
    status: "In Progress"
  },
  {
    title: "Portfolio Website",
    description: "Personal portfolio built with React and Tailwind.",
    techStack: ["React", "TailwindCSS", "JavaScript", "GitHub Pages"],
    domain: "Frontend",
    industry: "Tech",
    demo: "https://rautte.github.io/my-profile",
    github: "https://github.com/rautte/my-profile",
    status: "Deployed"
  },
  {
    title: "Sales Analytics",
    description: "Financial analysis dashboard using Python and Pandas.",
    techStack: ["Python"],
    domain: "Financial Analysis",
    industry: "Product Retail",
    github: "",
    status: "Deployed"
  },
  {
    title: "Car Data Pipeline",
    description: "Backend pipeline for automobile sensor data.",
    techStack: ["FastAPI", "Python"],
    domain: "Data Engineering",
    industry: "Automobile",
    github: "https://github.com/rautte/car-pipeline",
    status: "In Progress"
  }
];

// Filter categories
const filterOptions = {
  "Tech Stack": [
    "React", "TailwindCSS", "GitHub Pages", "JavaScript", "Airflow", "AWS", "Azure", "DBT", 
    "FastAPI", "NLTK", "PyTorch", "Python", "Go(Lang)", "MySQL", "PostgreSQL", "MongoDB", "Snowflakes"
  ],
  "Domain": [
    "Data Engineering", "Data Analysis", "Financial Analysis",
    "Backend", "Frontend", "AI/ML"
  ],
  "Industry": ["Product Retail", "Tech", "Automobile"]
};

export default function Project() {
  const [filters, setFilters] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // ✅ Filter handler
  const toggleFilter = (value) => {
    setFilters((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const resetFilters = () => setFilters([]);

  // ✅ Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Filter logic
  const filteredProjects = allProjects.filter((project) => {
    if (filters.length === 0) return true;
    const combined = [
      ...project.techStack,
      project.domain,
      project.industry
    ];
    return filters.every((f) => combined.includes(f));
  });

  // ✅ Count occurrences for each filter
  const getCount = (value) => {
    return allProjects.filter((p) =>
      [...p.techStack, p.domain, p.industry].includes(value)
    ).length;
  };

  return (
    <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* Header with Title and Filter Button */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 mb-10">
        {/* Title and divider */}
        <div>
          <h2 className="text-4xl font-bold text-purple-700 dark:text-purple-300 font-epilogue">
            Projects
          </h2>
          <div className="w-64 h-1 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-300 dark:via-purple-500 dark:to-purple-200 shadow-lg backdrop-blur-sm opacity-80"></div>
        </div>

        {/* Filter Button with Dropdown */}
        <div className="relative w-fit text-left" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="bg-gray-100 dark:bg-white/10 backdrop-blur-xl border border-gray-300 dark:border-white/30 rounded-xl px-3 py-1 font-medium text-gray-800 dark:text-white shadow-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <HiOutlineFilter className="text-lg" />
            Filter ▾
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div
              className="absolute right-0 mt-2 w-80 max-h-[500px] overflow-y-auto p-4 z-20
                bg-white/30 dark:bg-white/10 text-gray-800 dark:text-gray-200
                backdrop-blur-xl backdrop-saturate-150
                rounded-2xl border border-white/20 dark:border-white/20
                shadow-xl ring-1 ring-white/20 transition-all text-left scroll-smooth"
            >
              {Object.entries(filterOptions).map(([category, values]) => (
                <div key={category} className="mb-10">
                  <h4 className="text-sm text-gray-700 dark:text-white/70 font-semibold uppercase mb-2">
                    {category}
                  </h4>
                  <div className="w-full h-[1px] bg-gray-300 dark:bg-gray-600 mb-3" /> {/* Bar under heading */}
                  <div className="flex flex-wrap gap-2">
                    {values.map((option) => (
                      <button
                        key={option}
                        onClick={() => toggleFilter(option)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all border
                          ${
                            filters.includes(option)
                              ? "bg-purple-600 text-white border-purple-700"
                              : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200 dark:bg-white/20 dark:text-white dark:border-white/30 dark:hover:bg-white/30"
                          }`}
                      >
                        {option} ({getCount(option)})
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={resetFilters}
                className="mt-2 text-sm text-purple-600 dark:text-purple-300 hover:underline"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid md:grid-cols-2 gap-x-16 gap-y-10 px-6 py-4 md:px-25">
        {filteredProjects.map((project, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-900 rounded-xl p-6 text-left shadow-md transition-all border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold font-epilogue">
                {project.title}
              </h3>
              <span
                className={`text-xs px-2 py-1 text-white rounded-full ${
                  project.status === "Deployed"
                    ? "bg-green-500 dark:bg-green-600"
                    : "bg-indigo-500 dark:bg-indigo-600"
                }`}
              >
                {project.status}
              </span>
              {/* <span className="text-xs px-2 py-1 bg-green-500 dark:bg-green-600 text-white rounded-full">
                {project.status}
              </span> */}
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {project.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              {project.techStack.map((tech) => (
                <span
                  key={tech}
                  className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-white rounded-full"
                >
                  {tech}
                </span>
              ))}
            </div>

            <p className="text-xs mb-1 text-gray-500 dark:text-gray-400">
              <strong>Domain:</strong> {project.domain}
            </p>
            <p className="text-xs mb-3 text-gray-500 dark:text-gray-400">
              <strong>Industry:</strong> {project.industry}
            </p>

            {/* ✅ New GitHub + Live Demo Buttons */}
            <div className="flex gap-3 mt-2">
              {project.demo && (
                <a
                  href={project.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:opacity-90 transition font-medium"
                >
                  Live Demo
                </a>
              )}
              {project.github && (
                <a
                  href={project.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm px-4 py-2 border border-purple-600 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-[#31314a] transition font-medium"
                >
                  GitHub
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}