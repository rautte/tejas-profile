// src/data/projects/index.js

export const PROJECTS = [
  {
    title: "Smart Chatbot",
    description:
      "An end-to-end conversational AI system built using Python and PyTorch, inspired by NeuralNine’s chatbot architecture. The project implements intent classification and response selection using NLP techniques such as tokenization, stemming, and bag-of-words with a custom training pipeline. Focused on understanding model behavior, training workflows, and inference logic rather than just UI integration.",
    techStack: ["React", "Python", "PyTorch", "NLTK"],
    domain: "AI/ML",
    industry: "Tech",
    github: "https://github.com/rautte/chatbot",
    status: "Completed",
  },

  {
    title: "Portfolio Website",
    description:
      "A fully responsive personal portfolio built with React and Tailwind CSS, designed to showcase projects, experience, and system-level thinking. The site emphasizes modular UI architecture, reusable components, dark and light mode theming, and scalable data-driven sections. Deployed via GitHub Pages with a focus on maintainability and iterative improvement.",
    techStack: ["React", "TailwindCSS", "JavaScript", "GitHub Pages"],
    domain: "Frontend",
    industry: "Tech",
    demo: "https://rautte.github.io/tejas-profile",
    github: "https://github.com/rautte/tejas-profile",
    status: "Deployed",
  },

  {
    title: "Battleship Web Game",
    description:
      "A real-time multiplayer Battleship game built in React and TypeScript with Firebase-backed room management, turn synchronization, and game state recovery. Implemented full game logic, compass-based ship placement, and an AI bot using hit-streak heuristics. Designed the system with a strong focus on state consistency, latency handling, and predictable gameplay behavior.",
    techStack: ["React", "JavaScript", "AWS"],
    domain: "Backend",
    industry: "Tech",
    demo: "https://rautte.github.io/tejas-profile/#/fun-zone/battleship",
    github: "",
    status: "Deployed",
  },

  {
    title: "Formula 1 Data Platform",
    description:
      "An end-to-end data engineering project that ingests Formula 1 race data from public APIs into a cloud-based analytics platform. Built PySpark ETL pipelines with partitioning, incremental loads, and schema evolution, orchestrated through Azure Data Factory. The system supports near real-time analytics and reporting through Power BI, with an emphasis on data correctness and scalable processing.",
    techStack: ["Azure", "Python"],
    domain: "Data Engineering",
    industry: "Automobile",
    github: "",
    status: "Completed",
  },

  // --- Core systems projects ---
  {
    title: "SyzManiac",
    description:
      "A Go-based developer automation CLI that rebuilds an entire macOS development environment from scratch using a single command. The tool manages application installs, dotfile migration, health checks, versioned requirements, logging, and snapshot-style workflows. Designed with a production mindset, emphasizing idempotency, rollback safety, and long-term maintainability.",
    techStack: ["Go(Lang)", "GitHub"],
    domain: "Backend",
    industry: "Tech",
    github: "",
    status: "Completed",
  },

  {
    title: "Voice Assistant (Orchestrator + XTTS + GPT)",
    description:
      "A cloud-backed voice and reasoning system connecting a FastAPI orchestrator with a GPT-based planning layer and an XTTS voice server running on EC2. Deployed using AWS CDK, the system focuses on orchestration, request routing, and infrastructure ownership rather than model usage alone, highlighting end-to-end system design and automation.",
    techStack: ["FastAPI", "Python", "AWS"],
    domain: "AI/ML",
    industry: "Tech",
    github: "",
    status: "In-Progress",
  },
];

export const PROJECT_FILTER_OPTIONS = {
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
  Industry: ["Product Retail", "Tech", "Automobile"],
  "Project Status": ["Deployed", "Completed", "In-Progress"],
  Links: ["Live Demo", "GitHub"],
};
