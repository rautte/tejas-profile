// src/data/resume/index.js
// Single source of truth for resume content used by <Resume />

export const RESUME_DATA = {
  pdfAssetId:
    "resume.primary",

  // Order the resume's own internal sections render in. Owner-editable
  // from Admin -> Data; this is the historical fixed order.
  sectionOrder: [
    "experience",
    "education",
    "projects",
    "skills",
  ],

  header: {
    name: "Tejas Rajendra Raut",
    location: "Pune, India",
    linkedin: "linkedin.com/in/tejas-raut",
    linkedinURL: "linkedin.com/in/tejas-raut",
    email: "raut.tejas@outlook.com",
    website: "rautte.github.io",
    websiteURL: "github.com/rautte/rautte.github.io",
    phone: "+91 7057733771",
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
      location: "Seattle, WA",
      dates: "Jun 2024 - Mar 2026",
      bullets: [
        "Architected high-throughput event-driven pipelines processing 90M+ records per month using SNS, SQS, and OpenSearch, reducing query latency by ~40% and improving throughput under peak production load",
        "Led zero-downtime migration of a large-scale monitoring and notification platform (3500+ workflows) to AWS-native architecture, redesigning scheduling and execution using EventBridge and Lambda, improving alert accuracy by ~35% and system reliability",
        "Engineered fault-tolerant asynchronous processing systems using DLQs, retries, visibility timeouts, and idempotent consumers, achieving 99.9%+ processing success and reducing duplicate processing failures by ~90%",
        "Designed end-to-end CI/CD pipelines with automated integration, load, and canary testing (Hydra), enabling safe production deployments through automated validation and rollback mechanisms",
        "Built LLM-driven autonomous remediation agents to analyze production failures and execute runbook actions, reducing on-call effort by ~20% and decreasing MTTR by ~50% across distributed systems",
        "Drove architectural decisions across compute and scheduling layers, evaluating compute and orchestration tradeoffs (Lambda vs Fargate) and scheduling strategies to reduce infrastructure cost by ~25% while improving latency and scalability",
      ],
    },
    {
      company: "Mystry Inc.",
      title: "Software Engineer (Data Migration)",
      location: "Seattle, WA",
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
    "Frameworks & Tools": [
      "React",
      "Node.js",
      "Databricks",
      "Snowflake",
      "Git",
      "Angular",
      "Tableau",
      "Power BI",
      "Minitab",
      "MATLAB",
    ],
    "AWS": [
      "Lambda",
      "ECS Fargate",
      "Step Functions",
      "CloudFormation",
      "CDK",
      "S3",
      "SQS",
      "EventBridge",
      "API Gateway",
      "SES",
      "KMS",
      "CloudWatch",
      "RDS",
      "EC2",
      "VPC",
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
