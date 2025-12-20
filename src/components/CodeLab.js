 // src/components/CodeLab.js
import React from "react";
import { FaCode } from "react-icons/fa";

export default function CodeLab() {
  const snippets = [
    {
      title: "Databricks: Secure ADLS Gen2 Mount (Key Vault → dbutils.secrets)",
      lang: "python",
      from: "Formula1 Databricks Project",
      why: "Keeps credentials out of code, enables rotation, and standardizes storage access across notebooks/jobs.",
      code: `# Sanitized example: mount ADLS Gen2 via Service Principal + Key Vault-backed secrets

class Mounts:
  def __init__(self):
    client_id = dbutils.secrets.get(scope="formula1-scope", key="sp-client-id")
    tenant_id = dbutils.secrets.get(scope="formula1-scope", key="tenant-id")
    client_secret = dbutils.secrets.get(scope="formula1-scope", key="sp-client-secret")

    self.configs = {
      "fs.azure.account.auth.type": "OAuth",
      "fs.azure.account.oauth.provider.type":
        "org.apache.hadoop.fs.azurebfs.oauth2.ClientCredsTokenProvider",
      "fs.azure.account.oauth2.client.id": client_id,
      "fs.azure.account.oauth2.client.secret": client_secret,
      "fs.azure.account.oauth2.client.endpoint":
        f"https://login.microsoftonline.com/{tenant_id}/oauth2/token",
    }

  def mount(self, storage_account: str, container: str, mount_name: str):
    source = f"abfss://{container}@{storage_account}.dfs.core.windows.net/"
    mount_point = f"/mnt/{mount_name}"

    # idempotent mount: only mount if missing
    mounts = [m.mountPoint for m in dbutils.fs.mounts()]
    if mount_point not in mounts:
      dbutils.fs.mount(source=source, mount_point=mount_point, extra_configs=self.configs)
    return mount_point`,
    },

    {
      title: "Spark: Programmatic Schema Builder (nested StructType)",
      lang: "python",
      from: "Formula1 Ingestion Utilities",
      why: "Makes ingestion deterministic and resilient: prevents silent type drift and avoids schema inference surprises.",
      code: `from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType, ArrayType

# schema_dict format (example):
# {
#   "driverId": "int",
#   "name": {"forename": "string", "surname": "string"},
#   "laps": [{"lap": "int", "time": "string"}]
# }

def define_schema(schema_dict):
  def to_type(t):
    return {
      "string": StringType(),
      "int": IntegerType(),
      "double": DoubleType(),
    }[t]

  fields = []
  for key, val in schema_dict.items():
    if isinstance(val, dict):
      fields.append(StructField(key, define_schema(val), True))
    elif isinstance(val, list) and len(val) == 1 and isinstance(val[0], dict):
      fields.append(StructField(key, ArrayType(define_schema(val[0])), True))
    else:
      fields.append(StructField(key, to_type(val), True))

  return StructType(fields)`,
    },

    {
      title: "Spark: Typed Read Wrapper (raw ingestion pattern)",
      lang: "python",
      from: "Formula1 Ingestion Utilities",
      why: "Standardizes ingestion across datasets and keeps reads consistent (paths, schema, options, bad records handling).",
      code: `class Extract:
  def read_json(self, path: str, schema=None, multiline: bool=False):
    reader = spark.read
    if schema is not None:
      reader = reader.schema(schema)

    df = (
      reader
        .option("multiline", "true" if multiline else "false")
        .json(path)
    )
    return df

  def read_csv(self, path: str, schema=None, header: bool=True):
    reader = spark.read
    if schema is not None:
      reader = reader.schema(schema)

    df = (
      reader
        .option("header", "true" if header else "false")
        .csv(path)
    )
    return df`,
    },

    {
      title: "Spark: Transform Helpers (standardize + audit columns)",
      lang: "python",
      from: "Formula1 Ingestion Utilities",
      why: "Turns notebook transforms into reusable primitives (cleaner pipelines, less copy-paste, easier reviews).",
      code: `from pyspark.sql.functions import col, current_timestamp, lit

class Transform:
  def add_audit_cols(self, df, source_name: str):
    return (
      df
        .withColumn("ingested_at", current_timestamp())
        .withColumn("source", lit(source_name))
    )

  def select_rename(self, df, mapping: dict):
    # mapping: {"oldName": "new_name", ...}
    exprs = [col(src).alias(dst) for src, dst in mapping.items()]
    return df.select(*exprs)

  def drop_columns(self, df, cols: list[str]):
    for c in cols:
      df = df.drop(c)
    return df`,
    },

    {
      title: "Spark: Load Wrapper (write Parquet with safe defaults)",
      lang: "python",
      from: "Formula1 Ingestion Utilities",
      why: "Centralizes write behavior (mode, partitioning, compression) and avoids inconsistent writes across jobs.",
      code: `class Load:
  def write_parquet(
    self,
    df,
    path: str,
    mode: str="overwrite",
    partition_by: list[str] | None = None,
    compression: str="snappy",
  ):
    writer = df.write.mode(mode).option("compression", compression)
    if partition_by:
      writer = writer.partitionBy(*partition_by)
    writer.parquet(path)
    return path`,
    },
  ];

  return (
    <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* ✅ One shared container for header + content (matches Projects/Education) */}
      <div className="px-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
            <FaCode className="text-3xl text-purple-700 dark:text-purple-300" />
            Code Lab
          </h2>

          {/* underline (same as your other sections) */}
          {/* <div className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]"></div> */}

          <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-3xl">
            A curated set of small, production-minded snippets that reflect how I build: secure access, deterministic ingestion,
            reusable transforms, and consistent writes.
          </p>
        </div>

        {/* ✅ Cards — single column, full width inside the same rails */}
        <div className="grid grid-cols-1 gap-6">
          {snippets.map(({ title, code, lang, why, from }, i) => (
            <article
              key={i}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-[#1f2230] shadow-lg overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                    {title}
                  </h3>
                  <span className="shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-white">
                    {lang}
                  </span>
                </div>

                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">From:</span>{" "}
                  {from}
                </div>

                <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {why}
                </div>
              </div>

              <pre className="p-4 overflow-x-auto text-sm leading-relaxed bg-gray-50 dark:bg-[#191b28] text-gray-800 dark:text-gray-200">
                <code>{code}</code>
              </pre>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
