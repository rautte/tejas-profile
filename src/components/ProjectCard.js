// src/components/ProjectCard.js
export default function ProjectCard({ title, description, stack, github, demo }) {
  return (
    <div className="bg-white dark:bg-[#26263a] border border-gray-200 dark:border-[#31314a] rounded-xl p-6 shadow-sm transition-all">
      <h3 className="text-2xl font-semibold mb-2 text-purple-700 dark:text-purple-300">
        {title}
      </h3>

      <p className="text-gray-700 dark:text-gray-300 mb-4">{description}</p>

      {/* Tech Stack */}
      <div className="flex flex-wrap gap-2 mb-4">
        {stack.map((tech, index) => (
          <span
            key={index}
            className="bg-purple-100 dark:bg-[#31314a] text-purple-800 dark:text-purple-200 px-3 py-1 text-sm rounded-full font-medium"
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Links */}
      <div className="flex gap-4">
        {demo && (
          <a
            href={demo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:opacity-90 transition"
          >
            Live Demo
          </a>
        )}
        {github && (
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 border border-purple-600 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-[#31314a] transition"
          >
            GitHub
          </a>
        )}
      </div>
    </div>
  );
}
