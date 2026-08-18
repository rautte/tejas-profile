// src/data/experience/index.js
// keep this as "edit-only" stuff

export const EXPERIENCE = [
  {
    company: "CloudBig Technology",
    role: "Software Engineer",
    employmentType: "Full-time",
    duration: "Jun 2024 – Mar 2026",
    location: "Remote · Seattle, WA",
    highlights: [
      "Architected high-throughput event-driven pipelines processing 90M+ records per month using SNS, SQS, and OpenSearch, reducing query latency by ~40% and improving throughput under peak production load.",
      "Led zero-downtime migration of a large-scale monitoring and notification platform (3500+ workflows) to AWS-native architecture, redesigning scheduling and execution using EventBridge and Lambda, improving alert accuracy by ~35% and system reliability.",
      "Engineered fault-tolerant asynchronous processing systems using DLQs, retries, visibility timeouts, and idempotent consumers, achieving 99.9%+ processing success and reducing duplicate processing failures by ~90%.",
      "Designed end-to-end CI/CD pipelines with automated integration, load, and canary testing (Hydra), enabling safe production deployments through automated validation and rollback mechanisms.",
      "Built LLM-driven autonomous remediation agents to analyze production failures and execute runbook actions, reducing on-call effort by ~20% and decreasing MTTR by ~50% across distributed systems.",
      "Drove architectural decisions across compute and scheduling layers, evaluating compute and orchestration tradeoffs (Lambda vs Fargate) and scheduling strategies to reduce infrastructure cost by ~25% while improving latency and scalability.",
    ],
    tags: [
      "AWS",
      "Event-Driven Systems",
      "AWS CDK",
      "Lambda",
      "ECS Fargate",
      "EventBridge",
      "SQS / SNS",
      "OpenSearch",
      "CI/CD",
      "LLM",
      "Reliability Engineering",
    ],
  },
  {
    company: "Mystry Inc.",
    role: "Software Engineer",
    employmentType: "Full-time",
    duration: "Oct 2023 – Jun 2024",
    location: "Remote · Seattle, WA",
    highlights: [
      "Led migration from on-prem to Azure, redesigning storage and query patterns to improve performance by 35% and reduce platform cost by 25%.",
      "Built automated Azure ETL pipelines processing 2TB+ daily, improving deployment throughput by 40% and reducing downtime by 30% through stronger CI/CD and operational safeguards.",
      "Designed analytics-ready data marts and segmentation models in Python, improving customer targeting and increasing marketing engagement by 15%.",
    ],
    tags: [
      "Azure",
      "ETL Pipelines",
      "Data Warehousing",
      "Data Modeling",
      "Python",
      "CI/CD",
      "Inventory Optimization",
    ],
  },
  {
    company: "Highbar Technologies Ltd.",
    role: "Business Intelligence Engineer – Investment Risk Analysis",
    employmentType: "Full-time",
    duration: "May 2020 – Jun 2021",
    location: "Mumbai, India · On-site",
    highlights: [
      "Delivered an 11% revenue uplift by building KPI-driven Tableau dashboards and optimizing SAP HANA queries for faster, decision-grade reporting across finance and operations.",
      "Improved risk planning accuracy by 20% by building Python/Excel variance and stress-testing tools for credit and operational risk models.",
      "Automated reporting workflows using Azure Data Factory, reducing refresh latency and improving reliability of scheduled reporting runs.",
    ],
    tags: [
      "Business Intelligence",
      "Tableau",
      "Risk Analytics",
      "SQL",
      "SAP HANA",
      "Azure Data Factory",
      "Automation",
    ],
  },
];

// export const EARLY_EXPERIENCE = [
//   {
//     company: "Pravega Racing (Formula Student)",
//     role: "Data Analyst – Vehicle Dynamics Design Optimization",
//     employmentType: "Team / Project",
//     duration: "Sep 2018 – Aug 2019",
//     location: "Vellore, India · On-site",
//     highlights: [
//       "Led a cross-functional team of 4 across chassis, wheel assembly, and aero packages; owned analysis workflow and delivery timelines under competition constraints.",
//       "Built Python and MATLAB simulations for kinematics and vehicle dynamics to guide design tradeoffs and validate geometry changes before fabrication.",
//       "Analyzed 100k+ data points across tires and suspension; computed Lateral Load Transfer Distribution and Center of Pressure to improve handling and stability.",
//     ],
//     tags: [
//       "Systems Modeling",
//       "Optimization",
//       "Python",
//       "MATLAB",
//       "Simulation",
//       "Data Analysis",
//       "Cross-Functional Leadership",
//     ],
//   },
//   {
//     company: "Filtrum Autocomp Private Limited",
//     role: "Supply Chain Analyst Intern",
//     employmentType: "Internship",
//     duration: "Aug 2019 – Nov 2019",
//     location: "Pune, India · On-site",
//     highlights: [
//       "Applied a replenishment model to manage demand variability and improve warehouse capacity utilization by 15% through data-backed inventory tuning.",
//       "Performed value stream mapping to reduce lead time by 5% and improve parts availability by aligning procurement cadence with demand patterns.",
//     ],
//     tags: [
//       "Operations",
//       "Optimization",
//       "Analytics",
//       "Supply Chain",
//       "Process Improvement",
//       "Excel",
//     ],
//   },
// ];