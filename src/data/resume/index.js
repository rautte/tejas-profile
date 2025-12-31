// src/data/resume/index.js
// Single source of truth for resume content used by <Resume />

export const RESUME_DATA = {
  header: {
    name: "Tejas Rajendra Raut",
    location: "San Francisco, Bay Area",
    linkedin: "linkedin.com/in/tejas-raut",
    linkedinURL: "linkedin.com/in/tejas-raut",
    email: "raut.tejas@outlook.com",
    website: "rautte.github.io",
    websiteURL: "github.com/rautte/rautte.github.io",
    phone: "(857) 264-8844",
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
        "Architected event-driven AWS Lambda services processing SNS and SQS notification streams, implementing failure recovery, retry orchestration, and controlled message reprocessing to maintain system correctness under partial failures",
        "Ingested and materialized high-throughput OpenSearch indices processing over 90M+ records per month, tuned bulk indexing paths and mitigated write amplification to preserve query latency under load",
        "Operationalized resilient error-handling strategies using SQS visibility timeouts, DLQs, and idempotent consumers, achieving 99.9% success rate across asynchronous event processing workflows",
        "Codified CDK-based integration tests and CI/CD pipelines with staged deployments and automated rollback mechanisms to ensure safe releases for production infrastructure",
      ],
    },
    {
      company: "Mystry Inc.",
      title: "Data Engineer",
      location: "Bellevue, WA",
      dates: "Oct 2023 - Jun 2024",
      bullets: [
        "Owned the migration of on-premises data systems to Azure Cloud, redesigning storage layouts and query patterns to improve analytical performance by 35% while reducing infrastructure costs by 25%",
        "Orchestrated Azure-based ETL pipelines processing 2TB+ daily, implementing CI/CD-driven data workflows that increased deployment throughput by 40% and reduced downtime by 30%",
        "Developed Python-based data marts and clustering models to support customer segmentation and downstream analytics, increasing marketing engagement by 15% through improved data accessibility",
      ],
    },
    {
      company: "Highbar Technologies",
      title: "BI Engineer",
      location: "Mumbai, India",
      dates: "May 2020 - Jun 2021",
      bullets: [
        "Enabled an 11% revenue uplift by designing KPI-driven Tableau dashboards and optimizing SAP HANA queries to deliver near-real-time insights across finance and operations teams",
        "Improved credit and operational risk modeling accuracy by 20% by building Python and Excel-based variance analysis and stress testing tools used in investment planning workflows",
        "Automated financial ETL pipelines using Azure Data Factory, automating reporting workflows to significantly reduce data refresh latency and manual intervention",
      ],
    },
  ],

  skills: {
    "Programming Languages": [
      "Python",
      "SQL",
      "JavaScript",
      "TypeScript",
      "Java",
      "R",
      "Transact-SQL",
      "HTML/CSS",
    ],
    "Data & ML Libraries": [
      "NumPy",
      "Pandas",
      "PySpark",
      "TensorFlow",
      "Scikit-learn",
      "Matplotlib",
      "Seaborn",
    ],
    "Data Platforms & Distributed Systems": [
      "PostgreSQL",
      "MySQL",
      "MongoDB",
      "Azure Cosmos",
      "Kafka",
      "Spark",
      "Hive",
      "Airflow",
    ],
    "Cloud, Frameworks & Tools": [
      "AWS",
      "Azure",
      "Databricks",
      "Snowflake",
      "Git",
      "Node.js",
      "Angular",
      "Tableau",
      "Power BI",
      "Minitab",
      "MATLAB",
    ],
  },

  projects: [
    {
      name: "Battleship Multiplayer Web Game",
      dates: "Jan 2024 - Apr 2024",
      stack: ["React", "TypeScript", "Firebase", "AWS S3", "CloudFront"],
      bullets: [
        "Created a real-time 1v1 multiplayer Battleship web game in React and TypeScript using Firebase for room coordination, turn synchronization, and fault-tolerant session recovery, including AI bot logic with hit-streak heuristics",
        "Engineered a CDN-backed asset pipeline using AWS S3 and CloudFront to serve 240-frame ship animations, optimizing GPU rendering paths and z-layering for improved runtime responsiveness",
      ],
    },
    {
      name: "SyzManiac – Developer Environment Automation CLI Platform",
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
