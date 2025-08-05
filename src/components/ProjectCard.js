export default function ProjectCard({ title, description, stack, github, demo, status }) {
  return (
    <div className="bg-white dark:bg-[#26263a] border border-gray-200 dark:border-[#31314a] rounded-xl p-6 shadow-sm transition-all">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-2xl font-semibold text-purple-700 dark:text-purple-300">
          {title}
        </h3>
        {status && (
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${
            status === 'In Progress'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }`}>
            {status === 'In Progress' ? '🛠️ In Progress' : '✅ Deployed'}
          </span>
        )}
      </div>

      <p className="text-gray-700 dark:text-gray-300 mb-4">{description}</p>

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

      <div className="flex gap-4">
        {demo && (
          <a
            href={demo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
          >
            Live Demo
          </a>
        )}
        {github && (
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 border border-purple-600 text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition"
          >
            GitHub
          </a>
        )}
      </div>
    </div>
  );
}