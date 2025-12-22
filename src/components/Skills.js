// import React from "react";
import { FaCode, FaDatabase, FaCloud, FaTools, FaChartBar, FaCogs } from "react-icons/fa";

const skillsData = [
  {
    category: "Programming Languages",
    icon: <FaCode className="text-gray-600 dark:text-gray-200 text-lg" />,
    skills: ["Python", "R", "SQL", "T-SQL", "Scala", "Java", "JavaScript", "TypeScript", "HTML/CSS"]
  },
  {
    category: "Python Libraries & ML/AI",
    icon: <FaCode className="text-pink-500 dark:text-pink-400 text-lg" />,
    skills: ["NumPy", "Pandas", "TensorFlow", "Scikit-learn", "Matplotlib", "Seaborn", "PySpark"]
  },
  {
    category: "Databases & Big Data",
    icon: <FaDatabase className="text-green-600 dark:text-green-400 text-lg" />,
    skills: ["PostgreSQL", "MySQL", "MongoDB", "Azure Cosmos", "Airflow", "Spark", "Hive"]
  },
  {
    category: "Cloud & DevOps",
    icon: <FaCloud className="text-blue-500 dark:text-blue-400 text-lg" />,
    skills: ["AWS", "Azure", "Databricks", "Snowflake", "GIT", "GitHub"]
  },
  {
    category: "Frameworks & Web",
    icon: <FaTools className="text-yellow-500 dark:text-yellow-400 text-lg" />,
    skills: ["Node.js", "Express.js", "Angular"]
  },
  {
    category: "Visualization & ERP",
    icon: <FaChartBar className="text-indigo-500 dark:text-indigo-300 text-lg" />,
    skills: ["Tableau", "Power BI", "MATLAB", "Minitab", "MS Excel", "SAP HANA", "MS Dynamics"]
  }
];

export default function Skills() {
  return (
    <section className="py-0 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* Header */}
      <div className="px-6 mb-10">
        <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
          <FaCogs className="text-3xl text-purple-700 dark:text-purple-300" />
          Skills
        </h2>
        {/* <div className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]"></div> */}
      </div>

      <div className="grid md:grid-cols-2 gap-8 px-6">
        {skillsData.map(({ category, icon, skills }) => (
          <div
            key={category}
            className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3 mb-4">
              {icon}
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                {category}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map((skills) => (
                <span
                  key={skills}
                  className="text-xs font-medium px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-purple-200 dark:hover:bg-purple-600 transition-colors"
                >
                  {skills}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
