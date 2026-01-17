// src/data/experience/index.js
// keep this as "edit-only" stuff

export const EXPERIENCE = [
  {
    company: "CloudBig Technology",
    role: "Software Engineer",
    employmentType: "Full-time",
    duration: "Jun 2024 – Present",
    location: "Remote · Bellevue, WA",
    highlights: [
      "Owned event-driven notification processing on AWS (SNS/SQS → Lambda), implementing failure recovery, idempotency guards, and automated resubmission to reduce operational toil.",
      "Built and scaled an OpenSearch ingestion pipeline using AWS CDK, reliably processing 90M+ records/month by optimizing bulk indexing, update semantics, and document versioning patterns.",
      "Improved reliability to 99.9% successful processing by engineering DLQ strategies, visibility-timeout tuning, and retry policies with clear runbooks and alarm thresholds.",
      "Implemented CDK integration tests and CI/CD with staged rollouts plus automated rollback mechanisms to reduce deployment risk and improve change velocity.",
    ],
    tags: [
      "AWS",
      "Event-Driven Systems",
      "AWS CDK",
      "Lambda",
      "SQS / SNS",
      "OpenSearch",
      "CI/CD",
      "Reliability Engineering",
    ],
  },
  {
    company: "Mystry Inc.",
    role: "Data Engineer",
    employmentType: "Full-time",
    duration: "Oct 2023 – Jun 2024",
    location: "Remote · Bellevue, WA",
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