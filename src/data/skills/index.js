// src/data/skills/index.js
// keep this as "edit-only" stuff

import { FaCode, FaDatabase, FaCloud, FaTools, FaChartBar, FaAws } from "react-icons/fa";

export const SKILLS = [
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
    category: "AWS",
    icon: <FaAws className="text-indigo-500 dark:text-indigo-300 text-lg" />,
    skills: ["Lambda", "ECS Fargate", "Step Functions", "CloudFormation", "CDK", "S3", "SQS", "EventBridge", "API Gateway", "SES", "KMS", "CloudWatch", "RDS", "EC2", "VPC"]
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
    skills: ["React", "Node.js", "Express.js", "Angular"]
  },
  {
    category: "Visualization & ERP",
    icon: <FaChartBar className="text-indigo-500 dark:text-indigo-300 text-lg" />,
    skills: ["Tableau", "Power BI", "MATLAB", "Minitab", "MS Excel", "SAP HANA", "MS Dynamics"]
  }
];