// src/data/resume/index.js
// Single source of truth for resume content used by <Resume />

export const RESUME_DATA = {
  header: {
    name: "Tejas Rajendra Raut",
    location: "San Francisco, Bay Area",
    email: "raut.tejas@outlook.com",
    phone: "(857) 264-8844",
    website: "rautte.github.io",
    linkedin: "linkedin.com/tejas-raut/",
  },

  education: [
    {
      school: "Northeastern University",
      location: "Boston, MA",
      date: "May 2023",
      degree: "Master of Science",
      program: "Engineering Management - Database Management",
    },
    {
      school: "Vellore Institute of Technology",
      location: "Vellore, India",
      date: "Apr 2020",
      degree: "Bachelor of Technology",
      program: "Mechanical Engineering",
    },
  ],

  experience: [
    {
      company: "CloudBig Technology",
      title: "Software Engineer",
      location: "San Francisco, CA",
      dates: "Jun 2024 - Present",
      bullets: [
        "Designed and deployed AWS Lambda functions to process notification events from SNS and SQS, incorporating specialized logic for failure recovery, notification handling, and systematized message resubmission",
        "Developed a scalable OpenSearch ingestion pipeline using AWS CDK to process over 90 million records per month, optimizing bulk write operations and document update patterns for data consistency and performance",
        "Implemented advanced error handling strategies in Lambda functions, leveraging SQS visibility timeouts and dead-letter queues to ensure a 99.9% success rate in event-driven processing",
        "Engineered AWS CDK integration tests and CI/CD pipelines with staged rollouts and mechanized rollback for reliable deployments",
      ],
    },
    {
      company: "Mystry Inc.",
      title: "Data Engineer",
      location: "Bellevue, WA",
      dates: "Oct 2023 - Jun 2024",
      bullets: [
        "Migrated on-prem data systems to Azure Cloud, optimizing storage and query design to improve performance by 35% and reduce costs by 25%",
        "Designed and automated Azure ETL pipelines to process 2 TB+ of data daily and enhanced CI/CD workflows, increasing deployment throughput by 40% and minimizing downtime by 30%",
        "Built data marts and clustering models in Python, enabling refined customer segmentation that boosted marketing engagement by 15%",
      ],
    },
    {
      company: "Highbar Technologies",
      title: "BI Engineer",
      location: "Mumbai, India",
      dates: "May 2020 - Jun 2021",
      bullets: [
        "Enabled an 11% revenue uplift for enterprise clients by developing KPI-focused Tableau dashboards and optimizing SAP HANA queries to deliver real-time insights across finance and operations",
        "Strengthened credit and operational risk models by 20% by building Python and Excel-based variance and stress testing tools that improved the accuracy of investment planning",
        "Optimized financial workflows by rebuilding ETL pipelines in Azure Data Factory, automating reporting to reduce refresh time",
      ],
    },
  ],

  skills: {
    "Programming Languages": [
      "Python",
      "R",
      "SQL",
      "Transact-SQL",
      "Scala",
      "Java",
      "JavaScript",
      "TypeScript",
      "HTML/CSS",
    ],
    "Python Libraries and APIs": [
      "NumPy",
      "Pandas",
      "TensorFlow",
      "Scikit-learn",
      "Matplotlib",
      "Seaborn",
      "PySpark",
    ],
    "Databases and Big Data Technologies": [
      "PostgreSQL",
      "MySQL",
      "MongoDB",
      "Azure Cosmos",
      "Kafka",
      "Airflow",
      "Spark",
      "Hive",
    ],
    "Frameworks & Tools": [
      "Databricks",
      "Snowflakes",
      "AWS",
      "Azure",
      "Git",
      "Node.js",
      "Angular",
      "Tableau",
      "Power BI",
      "Microsoft Excel",
      "Minitab",
      "MATLAB",
    ],
  },

  projects: [
    {
      name: "Battleship Web Game",
      dates: "Jan 2024 - Apr 2024",
      stack: ["React", "TypeScript", "Firebase", "AWS S3", "CloudFront"],
      bullets: [
        "Built a real-time 1v1 Battleship game in React/TypeScript with Firebase rooms, turn sync, and 30-second auto-resume; implemented full game logic, compass-based ship control, and an AI bot with hit-streak heuristics",
        "Created a CDN pipeline for 240-frame ship animations using AWS S3 + CloudFront with auto-sync hooks for Blender-rendered assets; optimized GPU rendering and z-layering to improve in-game responsiveness",
      ],
    },
    {
      name: "SyzManiac – Developer Environment Automation Framework",
      dates: "May 2023 - Dec 2024",
      stack: ["Go", "Shell", "GitHub"],
      bullets: [
        "Designed and built a Go-based automation framework to deterministically provision and restore an entire macOS development environment, including dependency installs, versioned dotfile migration, and lifecycle orchestration via a custom syz CLI",
        "Implemented idempotent workflows, fast system state scanning, structured logging, and healthchecks to enable one-command bootstrap and recovery, treating a developer workstation as a reproducible, self-healing system",
      ],
    },
    {
      name: "Formula-1 Data for Reporting",
      dates: "Jan 2023 - May 2023",
      stack: ["Azure", "PySpark", "Spark SQL", "Power BI"],
      bullets: [
        "Engineered a PySpark ETL pipeline on Azure to ingest Formula 1 data from the Ergast API into Delta Lake, implementing partitioning, schema evolution, and incremental loads for efficient querying",
        "Orchestrated Azure Data Factory workflows with automated triggers and monitoring for near-real-time Power BI analytics",
      ],
    },
  ],
};
