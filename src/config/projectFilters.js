// src/config/projectFilters.js

/**
 * Platform-owned Projects filter taxonomy.
 *
 * Profile Variants provide the projects themselves.
 * The current Platform decides how projects can be filtered.
 */
export const PROJECT_FILTER_OPTIONS =
  Object.freeze({
    "Tech Stack": [
      "React",
      "TailwindCSS",
      "GitHub Pages",
      "JavaScript",
      "Airflow",
      "AWS",
      "Azure",
      "DBT",
      "FastAPI",
      "NLTK",
      "PyTorch",
      "Python",
      "Go(Lang)",
      "MySQL",
      "PostgreSQL",
      "MongoDB",
      "Snowflakes",
    ],

    Domain: [
      "Data Engineering",
      "Data Analysis",
      "Financial Analysis",
      "Backend",
      "Frontend",
      "AI/ML",
    ],

    Industry: [
      "Product Retail",
      "Tech",
      "Automobile",
    ],

    "Project Status": [
      "Deployed",
      "Completed",
      "In-Progress",
    ],

    Links: [
      "Live Demo",
      "GitHub",
    ],
  });