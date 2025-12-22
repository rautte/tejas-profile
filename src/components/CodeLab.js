// src/components/CodeLab.js
import React from "react";
import { FaCode } from "react-icons/fa";
import { HiOutlineFilter } from "react-icons/hi";
import { FiChevronsDown, FiChevronsUp } from "react-icons/fi";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";


export default function CodeLab({ darkMode }) {
  const snippets = React.useMemo(
    () => [
      {
        title: "Databricks: ADLS Gen2 mount via Key Vault secrets (idempotent + safe logs)",
        lang: "python",
        from: "Formula1 Databricks Project",
        why: "Mounts ADLS the right way: secrets stay out of code, mounts are idempotent, and reruns are predictable across jobs/notebooks.",
        concepts: ["Secrets Management", "Resource Isolation"],
        technology: ["Databricks", "Azure"],
        domain: ["Data Platform"],
        code: `# Sanitized example: mount ADLS Gen2 using SP creds from Key Vault-backed secrets.
    # Scope/key names are placeholders. Keep real names in workspace config, not in public code.

    from dataclasses import dataclass
    from typing import Dict, Tuple

    @dataclass(frozen=True)
    class MountResult:
      mount_point: str
      did_mount: bool

    class Mounts:
      def __init__(self, secrets_scope: str = "<SECRETS_SCOPE_PLACEHOLDER>"):
        # Dummy placeholders so nothing internal leaks.
        client_id = dbutils.secrets.get(scope=secrets_scope, key="<SP_CLIENT_ID_KEY>")
        tenant_id = dbutils.secrets.get(scope=secrets_scope, key="<TENANT_ID_KEY>")
        client_secret = dbutils.secrets.get(scope=secrets_scope, key="<SP_SECRET_KEY>")

        self._configs: Dict[str, str] = {
          "fs.azure.account.auth.type": "OAuth",
          "fs.azure.account.oauth.provider.type":
            "org.apache.hadoop.fs.azurebfs.oauth2.ClientCredsTokenProvider",
          "fs.azure.account.oauth2.client.id": client_id,
          "fs.azure.account.oauth2.client.secret": client_secret,
          "fs.azure.account.oauth2.client.endpoint":
            f"https://login.microsoftonline.com/{tenant_id}/oauth2/token",
        }

      def mount(self, storage_account: str, container: str, mount_name: str, *, force: bool = False) -> MountResult:
        if not storage_account or not container or not mount_name:
          raise ValueError("storage_account/container/mount_name are required")

        source = f"abfss://{container}@{storage_account}.dfs.core.windows.net/"
        mount_point = f"/mnt/{mount_name}"

        existing = {m.mountPoint: m.source for m in dbutils.fs.mounts()}

        # If it exists and matches, we're done.
        if mount_point in existing and existing[mount_point] == source and not force:
          print(f"[mounts] already mounted: {mount_point}")
          return MountResult(mount_point=mount_point, did_mount=False)

        # If it exists but points elsewhere, don't silently stomp it.
        if mount_point in existing and existing[mount_point] != source and not force:
          raise RuntimeError(f"mount point exists but source differs: {mount_point}")

        if mount_point in existing and force:
          print(f"[mounts] remounting (force): {mount_point}")
          dbutils.fs.unmount(mount_point)

        print(f"[mounts] mounting: {mount_point}")  # no secrets printed
        dbutils.fs.mount(source=source, mount_point=mount_point, extra_configs=self._configs)
        return MountResult(mount_point=mount_point, did_mount=True)`,
      },

      {
        title: "Spark: Programmatic schema builder (nested StructType + strict types)",
        lang: "python",
        from: "Formula1 Ingestion Utilities",
        why: "Stops schema drift early. I’d rather fail with a clean message than silently ingest the wrong types.",
        concepts: ["Schema Management", "Data Contracts"],
        technology: ["Spark"],
        domain: ["Data Ingestion"],
        code: `from pyspark.sql.types import (
      StructType, StructField, StringType, IntegerType, LongType, DoubleType, BooleanType, ArrayType
    )

    # schema_dict format (example):
    # {
    #   "driverId": "int",
    #   "name": {"forename": "string", "surname": "string"},
    #   "laps": [{"lap": "int", "time": "string"}]
    # }

    _ALLOWED = {
      "string": StringType(),
      "int": IntegerType(),
      "long": LongType(),
      "double": DoubleType(),
      "boolean": BooleanType(),
    }

    def define_schema(schema_dict: dict, *, nullable: bool = True) -> StructType:
      def to_type(t: str):
        if t not in _ALLOWED:
          raise ValueError(f"unknown type '{t}'. allowed: {sorted(_ALLOWED.keys())}")
        return _ALLOWED[t]

      fields = []
      for key, val in schema_dict.items():
        if isinstance(val, dict):
          fields.append(StructField(key, define_schema(val, nullable=nullable), nullable))
        elif isinstance(val, list) and len(val) == 1 and isinstance(val[0], dict):
          fields.append(StructField(key, ArrayType(define_schema(val[0], nullable=nullable)), nullable))
        else:
          fields.append(StructField(key, to_type(val), nullable))

      return StructType(fields)`,
      },

      {
        title: "Spark: Typed read wrappers (consistent options + bad records path)",
        lang: "python",
        from: "Formula1 Ingestion Utilities",
        why: "Same read behavior everywhere: schema on demand, consistent options, and a place to park bad records when needed.",
        concepts: ["Schema Management", "Error Evidence Preservation"],
        technology: ["Spark"],
        domain: ["Data Ingestion"],
        code: `from typing import Optional

    class Extract:
      def read_json(
        self,
        path: str,
        schema=None,
        *,
        multiline: bool = False,
        bad_records_path: Optional[str] = None,
      ):
        reader = spark.read
        if schema is not None:
          reader = reader.schema(schema)

        if bad_records_path:
          reader = reader.option("badRecordsPath", bad_records_path)

        return (
          reader
            .option("multiline", "true" if multiline else "false")
            .json(path)
        )

      def read_csv(
        self,
        path: str,
        schema=None,
        *,
        header: bool = True,
        bad_records_path: Optional[str] = None,
      ):
        reader = spark.read
        if schema is not None:
          reader = reader.schema(schema)

        if bad_records_path:
          reader = reader.option("badRecordsPath", bad_records_path)

        return (
          reader
            .option("header", "true" if header else "false")
            .csv(path)
        )`,
      },

      {
        title: "Spark: Transform helpers (audit columns + safe rename + drop)",
        lang: "python",
        from: "Formula1 Ingestion Utilities",
        why: "Keeps notebook transforms boring and reusable: audit columns are consistent, and renames don’t hide missing columns.",
        concepts: ["Auditability", "Defensive Programming"],
        technology: ["Spark"],
        domain: ["Analytics Engineering"],
        code: `from pyspark.sql.functions import col, current_timestamp, lit

    class Transform:
      def add_audit_cols(self, df, source_name: str):
        return (
          df
            .withColumn("ingested_at", current_timestamp())
            .withColumn("source", lit(source_name))
        )

      def select_rename(self, df, mapping: dict, *, strict: bool = True):
        # mapping: {"oldName": "new_name", ...}
        if strict:
          missing = [src for src in mapping.keys() if src not in df.columns]
          if missing:
            raise ValueError(f"missing columns for rename: {missing}")

        exprs = [col(src).alias(dst) for src, dst in mapping.items() if src in df.columns]
        return df.select(*exprs)

      def drop_columns(self, df, cols: list[str], *, ignore_missing: bool = True):
        for c in cols:
          if ignore_missing and c not in df.columns:
            continue
          df = df.drop(c)
        return df`,
      },

      {
        title: "Spark: Parquet write wrapper (mode validation + partition support)",
        lang: "python",
        from: "Formula1 Ingestion Utilities",
        why: "Centralizes write behavior so jobs don’t slowly diverge. Defaults are intentional and easy to audit.",
        concepts: ["Write Semantics", "Defensive Programming"],
        technology: ["Spark"],
        domain: ["Data Platform"],
        code: `class Load:
      def write_parquet(
        self,
        df,
        path: str,
        *,
        mode: str = "overwrite",
        partition_by: list[str] | None = None,
        compression: str = "snappy",
      ):
        allowed = {"overwrite", "append", "errorifexists", "ignore"}
        if mode.lower() not in allowed:
          raise ValueError(f"invalid mode '{mode}'. allowed: {sorted(allowed)}")

        writer = df.write.mode(mode).option("compression", compression)

        if partition_by:
          writer = writer.partitionBy(*partition_by)

        writer.parquet(path)
        return path`,
      },

      {
        title: "API Design: Idempotent cash reconciliation endpoint (202 + poll URL)",
        lang: "python",
        from: "Production Reconciliation Platform",
        why: "Clean API boundary: strict request/response contracts, real idempotency, and async orchestration without blocking the API layer.",
        concepts: ["Data Contracts", "Defensive Programming"],
        technology: ["Python"],
        domain: ["FinTech", "Backend Systems"],
        code: `from datetime import date
    from decimal import Decimal
    from uuid import UUID

    from fastapi import BackgroundTasks, HTTPException, Response
    from pydantic import BaseModel, Field, conint, constr

    # ---------- Contracts ----------

    class ReconciliationRequest(BaseModel):
      reconciliation_id: UUID
      business_date: date
      source_system: constr(min_length=1, max_length=64)
      target_system: constr(min_length=1, max_length=64)
      transactions_uri: constr(min_length=1, max_length=2048)  # keep creds out of URIs
      expected_total: Decimal
      currency: constr(min_length=3, max_length=3)
      idempotency_key: constr(min_length=8, max_length=128) = Field(
        ..., description="Idempotency key to avoid duplicate runs"
      )

    class ReconciliationResult(BaseModel):
      reconciliation_id: UUID
      status: str  # PENDING | SUCCESS | PARTIAL | FAILED
      reconciled_total: Decimal
      delta: Decimal
      unmatched_count: conint(ge=0)
      processed_at: str

    # ---------- Control plane ----------

    @app.post("/v1/reconciliation/cash", response_model=ReconciliationResult, status_code=202)
    def reconcile_cash(req: ReconciliationRequest, response: Response, bg: BackgroundTasks):
      """
      I keep the API thin: validate, enforce idempotency, enqueue work.
      The heavy compute stays in workers.
      """

      # Durable idempotency is the whole point here (db/redis). In-memory doesn't count.
      existing = idempotency_lookup(req.idempotency_key)  # returns None or a cached result blob
      if existing:
        response.status_code = 200
        return existing

      # Claim the key before enqueue so concurrent callers don't double-run.
      if not idempotency_claim(req.idempotency_key, reconciliation_id=req.reconciliation_id):
        cached = idempotency_lookup(req.idempotency_key)
        response.status_code = 200
        return cached

      # Async orchestration. Worker updates the final result later.
      bg.add_task(
        enqueue_reconciliation_job,
        reconciliation_id=req.reconciliation_id,
        payload=req.model_dump(),
      )

      # Pollable location is nice for clients.
      response.headers["Location"] = f"/v1/reconciliation/cash/{req.reconciliation_id}"

      return ReconciliationResult(
        reconciliation_id=req.reconciliation_id,
        status="PENDING",
        reconciled_total=Decimal("0.00"),
        delta=Decimal("0.00"),
        unmatched_count=0,
        processed_at=utc_now(),
      )`,
      },

      {
        title: "Go CLI: Cobra root command (global flags + clean error behavior)",
        lang: "go",
        from: "syzmaniac CLI",
        why: "A predictable CLI contract: global flags, consistent help, and errors formatted in one place.",
        concepts: ["Defensive Programming", "Resource Isolation"],
        technology: ["Go"],
        domain: ["Developer Tooling"],
        code: `var rootCmd = &cobra.Command{
      Use:           "syz",
      Short:         "syzmaniac — developer environment manager",
      SilenceUsage:  true,  // usage on validation errors only
      SilenceErrors: true,  // main() owns formatting
    }

    func Execute() {
      if err := rootCmd.Execute(); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
      }
    }

    func init() {
      rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "verbose output")
      rootCmd.PersistentFlags().StringVar(&configPath, "config", "", "path to config file")

      // Default config path is optional; keep it simple.
      rootCmd.PersistentPreRunE = func(cmd *cobra.Command, args []string) error {
        if configPath != "" {
          return config.Load(configPath) // placeholder: load + validate once
        }
        return nil
      }
    }`,
      },

      {
        title: "Go CLI: install command (flags + installer routing + context propagation)",
        lang: "go",
        from: "syzmaniac CLI",
        why: "Single entrypoint for installs. Flags stay consistent and routing stays extensible as new installers land.",
        concepts: ["Defensive Programming", "Resource Isolation"],
        technology: ["Go"],
        domain: ["Developer Tooling"],
        code: `var installCmd = &cobra.Command{
      Use:   "install <app>",
      Short: "Install a tool (idempotent)",
      Args:  cobra.ExactArgs(1),
      RunE: func(cmd *cobra.Command, args []string) error {
        app := args[0]

        version, _ := cmd.Flags().GetString("version")
        force, _ := cmd.Flags().GetBool("force")

        inst, err := installer.Resolve(app) // registry/factory
        if err != nil { return err }

        ctx := installer.Context{
          Version: version,
          Force:   force,
          Verbose: verbose,
        }

        // cmd.Context() carries cancellation/timeouts; keep it flowing through.
        return inst.Install(cmd.Context(), ctx)
      },
    }

    func init() {
      installCmd.Flags().String("version", "", "pin a version")
      installCmd.Flags().Bool("force", false, "force reinstall")
      rootCmd.AddCommand(installCmd)
    }`,
      },

      {
        title: "Frontend: tsParticles init (links preset + grab/push interactions)",
        lang: "javascript",
        from: "Portfolio Hero Section",
        why: "Reusable init that keeps the config small, and interactions feel deliberate instead of noisy.",
        concepts: ["Defensive Programming"],
        technology: ["React", "tsParticles"],
        domain: ["Frontend"],
        code: `import { loadLinksPreset } from "tsparticles-preset-links";
    import { loadExternalGrabInteraction } from "tsparticles-interaction-external-grab";
    import { loadExternalPushInteraction } from "tsparticles-interaction-external-push";
    import { useCallback } from "react";

    const particlesInit = useCallback(async (engine) => {
      await loadLinksPreset(engine);             // links preset
      await loadExternalGrabInteraction(engine); // grab on hover
      await loadExternalPushInteraction(engine); // push on click
    }, []);`,
      },

      {
        title: "Battleship: Save quick-resume blob on tab close (TTL + version tag)",
        lang: "typescript",
        from: "Battleship Multiplayer UX",
        why: "Prevents the ‘lost game’ moment: saves just enough state to resume, but expires it so stale sessions don’t hang around.",
        concepts: ["State Synchronization", "Defensive Programming"],
        technology: ["React", "TypeScript"],
        domain: ["Game Engineering"],
        code: `// Save a tiny resume blob on tab close. Best-effort only.
    React.useEffect(() => {
      const onBeforeUnload = () => {
        if (!roomCode || !roomRef.current) return;

        try {
          saveLocalResume(roomCode, roleRef.current, {
            v: 1, // version tag so future schema changes don't break resumes
            exp: Date.now() + RESUME_WINDOW_MS,
            playerGrid: playerGridRef.current,
            playerFleet: playerFleetRef.current,
            iAmReady: iAmReadyRef.current ?? false,
            turn: turnRef.current,
          });
        } catch {
          // I don't block unload for storage issues.
        }
      };

      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [roomCode, saveLocalResume]);`,
      },

      {
        title: "Battleship: Apply state snapshot defensively (shape guards + no-crash sync)",
        lang: "typescript",
        from: "Battleship State Management",
        why: "Sync stays robust: partial snapshots won’t crash the UI, and placement stays consistent with fleet size.",
        concepts: ["State Synchronization", "Defensive Programming"],
        technology: ["React", "TypeScript"],
        domain: ["Game Engineering"],
        code: `const applyStateSnapshot = React.useCallback((s: any) => {
      // Remote snapshots can be partial or weird. I treat them as untrusted input.
      try {
        if (typeof s?.phase === "string") setPhase(s.phase);
        if (typeof s?.turn === "string") setTurn(s.turn);

        if (s?.playerGrid) setPlayerGrid(s.playerGrid);
        if (s?.playerFleet) setPlayerFleet(s.playerFleet);

        // During placement, keep remaining fleet sizes aligned with what's already placed.
        if (s?.playerFleet && phaseRef.current === "place") {
          try {
            const placedCount = Object.keys(s.playerFleet).length
            setToPlace(FLEET_SIZES.slice(placedCount));
          } catch {}
        }

        if (s?.playerShots) setPlayerShots(s.playerShots);
        if (s?.enemyGrid) setEnemyGrid(s.enemyGrid);
        if (s?.enemyFleet) setEnemyFleet(s.enemyFleet);
        if (s?.enemyShots) setEnemyShots(s.enemyShots);

        if (typeof s?.msg === "string") setMsg(s.msg);

        setEnemyRevealed(false);
      } catch {
        // Never crash the UI because of a bad snapshot.
      }
    }, []);`,
      },

      {
        title: "DevOps: S3 asset sync with session validation (SSO fallback + quiet logs)",
        lang: "bash",
        from: "Battleship Asset Pipeline",
        why: "Reliable uploads on real teams: validates session, supports SSO re-login, and keeps output CI-friendly.",
        concepts: ["Reliability", "Defensive Programming"],
        technology: ["AWS"],
        domain: ["DevOps"],
        code: `#!/usr/bin/env bash
    set -euo pipefail

    # Local env is optional. Keep real bucket/profile out of public code.
    [ -f .env.local ] && set -a && . ./.env.local && set +a

    ASSETS_DIR="\${ASSETS_DIR:-src/assets/ships/sprites}"
    BUCKET="\${ASSETS_BUCKET:?ASSETS_BUCKET not set (put it in .env.local)}"
    PREFIX="\${ASSETS_PREFIX:-ships/sprites/}"
    REGION="\${AWS_REGION:-us-east-1}"
    PROFILE="\${AWS_PROFILE:-}"

    export AWS_SDK_LOAD_CONFIG=1

    command_exists() { command -v "$1" >/dev/null 2>&1; }

    ensure_aws_session() {
      command_exists aws || { echo "[sync:assets] ERROR: aws CLI not found." >&2; return 1; }

      if aws sts get-caller-identity >/dev/null 2>&1; then return 0; fi

      if [[ -n "$PROFILE" ]]; then
        echo "[sync:assets] Session invalid. Trying SSO login for '\${PROFILE}'…"
        aws sso login --profile "$PROFILE"
        aws sts get-caller-identity >/dev/null 2>&1 || return 1
        return 0
      fi

      echo "[sync:assets] ERROR: Not authenticated and AWS_PROFILE is empty." >&2
      return 1
    }

    ensure_aws_session

    # Idempotent sync. Keep logs quiet; callers can add --dryrun if they want.
    aws s3 sync "$ASSETS_DIR" "s3://$BUCKET/$PREFIX" --region "$REGION" \\
      \${PROFILE:+--profile "$PROFILE"} --only-show-errors`,
      },

      {
        title: "DevOps: CloudFront invalidation (paths + SSO fallback + safe arg parsing)",
        lang: "bash",
        from: "Battleship CDN Ops",
        why: "Makes cache busting predictable: env-driven paths, SSO-friendly auth, and no weird quoting issues.",
        concepts: ["Reliability", "Defensive Programming"],
        technology: ["AWS"],
        domain: ["DevOps"],
        code: `#!/usr/bin/env bash
    set -euo pipefail

    # Local env is optional. Keep real distribution IDs out of public code.
    [ -f .env.local ] && set -a && . ./.env.local && set +a

    DISTRIBUTION_ID="\${CDN_DISTRIBUTION_ID:?CDN_DISTRIBUTION_ID not set in .env.local}" # do not commit real IDs
    PATTERNS="\${CDN_INVALIDATE_PATHS:-/ships/sprites/*}" # space-separated is allowed: "/a/* /b/*"
    PROFILE="\${AWS_PROFILE:-}"
    REGION="\${AWS_REGION:-us-east-1}"

    export AWS_SDK_LOAD_CONFIG=1

    command_exists() { command -v "$1" >/dev/null 2>&1; }

    ensure_aws_session() {
      command_exists aws || { echo "[cdn:invalidate] ERROR: aws CLI not found." >&2; return 1; }

      if aws sts get-caller-identity >/dev/null 2>&1; then return 0; fi

      if [[ -n "$PROFILE" ]]; then
        echo "[cdn:invalidate] Session invalid. Trying SSO login for '\${PROFILE}'…"
        aws sso login --profile "$PROFILE"
        aws sts get-caller-identity >/dev/null 2>&1 || return 1
        return 0
      fi

      echo "[cdn:invalidate] ERROR: Not authenticated and AWS_PROFILE is empty." >&2
      return 1
    }

    ensure_aws_session

    # Split patterns safely into args.
    read -r -a PATHS <<< "$PATTERNS"

    aws cloudfront create-invalidation \\
      --distribution-id "$DISTRIBUTION_ID" \\
      --paths "\${PATHS[@]}" \\
      \${PROFILE:+--profile "$PROFILE"} \\
      --region "$REGION" >/dev/null`,
      },

      {
        title: "3D Assets: Batch FBX → GLB via Blender CLI (deterministic exports)",
        lang: "python",
        from: "Battleship 3D Asset Pipeline",
        why: "Reproducible asset builds: clean scene per file, auto texture relink, and consistent GLB export settings.",
        concepts: ["Reliability", "Defensive Programming"],
        technology: ["Blender"],
        domain: ["Game Engineering"],
        code: `# Run:
    # <BLENDER_BIN_PLACEHOLDER> -b -P scripts/blender_fbx_to_glb.py
    # Keep your local Blender path out of git; docs/env is enough.

    import bpy
    import os

    ROOT = os.path.abspath("src/assets/ships/raw")
    OUT  = os.path.abspath("src/assets/ships/glb")
    os.makedirs(OUT, exist_ok=True)

    def process(ship: str) -> None:
      bpy.ops.wm.read_factory_settings(use_empty=True)

      fbx = os.path.join(ROOT, ship, f"{ship}.fbx")
      tex = os.path.join(ROOT, ship, "textures")
      glb = os.path.join(OUT, f"{ship}.glb")

      if not os.path.isfile(fbx):
        print(f"[skip] {ship}: missing {fbx}")
        return

      bpy.ops.import_scene.fbx(filepath=fbx)

      if os.path.isdir(tex):
        bpy.ops.file.find_missing_files(directory=tex)

      bpy.ops.export_scene.gltf(
        filepath=glb,
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
      )

    ships = ["visby", "k130", "saar6", "lcs-freedom", "lcs-independence"]
    for s in ships:
      process(s)

    print("[done]")`,
      },

      {
        title: "UI: Timeline active-card detection + discrete progress (snappy + bounded)",
        lang: "javascript",
        from: "Timeline Carousel UX",
        why: "Keeps the carousel feeling intentional: centered card detection and progress that doesn’t do weird partial fills.",
        concepts: ["Defensive Programming"],
        technology: ["React"],
        domain: ["Frontend"],
        code: `let closestIndex = 0;
    let closestDistance = Infinity;

    // Only consider actual timeline cards.
    const cards = Array.from(container.children).filter(child =>
      child.classList.contains("timeline-card")
    );

    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(center - cardCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    });

    setActiveIndex(closestIndex);

    // Discrete progress; guard empty data.
    const total = Math.max(1, timelineData.length);
    const progress = ((closestIndex + 1) / total) * 100;
    setScrollProgress(progress);`,
      },

      {
        title: "UI: Starter chooser gates board interaction (prevents weird states)",
        lang: "tsx",
        from: "Tic Tac Toe Web",
        why: "Small UX thing, big impact: you choose the starter first, then the board becomes interactive.",
        concepts: ["Defensive Programming", "State Synchronization"],
        technology: ["React"],
        domain: ["Frontend", "Game Engineering"],
        code: `{starter === null && (
      <div className="w-full rounded-2xl bg-gray-100 dark:bg-gray-800 ring-1 ring-black/10 dark:ring-white/10 p-5">
        <div className="mb-3 font-semibold text-gray-800 dark:text-gray-100">
          Who starts first?
        </div>

        {/* Keep the board locked until we pick a starter. */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setBoard(emptyBoard());
              setStrike(null);
              setOver(false);
              setStarter("HUMAN");
              setTurn(HUMAN);
            }}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
          >
            Player starts
          </button>

          <button
            onClick={() => {
              setBoard(emptyBoard());
              setStrike(null);
              setOver(false);
              setStarter("AI");
              setTurn(AI);
            }}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 text-white shadow hover:opacity-90"
          >
            AI starts
          </button>
        </div>
      </div>
    )}`,
      },

      {
        title: "Dotfiles: VS Code config migration (version-aware + safe symlinks)",
        lang: "bash",
        from: "sys_managed dotfiles migration",
        why: "Idempotent migration with versioned layout + logging. Reads like ops hygiene, not a one-off script.",
        concepts: ["Auditability", "Resource Isolation"],
        technology: ["Bash", "VS Code"],
        domain: ["Developer Tooling"],
        code: `#!/bin/bash
    set -euo pipefail

    SCRIPT_NAME="$(basename "$0")"
    LOG_DIR="$HOME/sys_managed/logs/script_logs/dotfiles_migration_logs/ide_dotfiles_migration_logs"
    LOG_FILE="$LOG_DIR/\${SCRIPT_NAME%.sh}.log"
    VSCODE_BASE="$HOME/sys_managed/etc/config/ide/vscode"

    mkdir -p "$VSCODE_BASE" "$LOG_DIR"

    {
      echo "🕒 $(date) — VS Code dotfile migration start"

      # Prefer the VS Code CLI; if it's missing, don't guess paths.
      VSCODE_VERSION=$(code --version 2>/dev/null | head -n1 || true)
      if [[ -z "$VSCODE_VERSION" ]]; then
        echo "⚠️ VS Code CLI not found (code). Skipping migration."
        exit 1
      fi

      VSCODE_DEST="$VSCODE_BASE/$VSCODE_VERSION"
      mkdir -p "$VSCODE_DEST"

      VSCODE_VERSIONED_DOTFILES=(
        "Library/Application Support/Code/User/settings.json"
        "Library/Application Support/Code/User/keybindings.json"
        "Library/Application Support/Code/User/snippets"
      )

      for file in "\${VSCODE_VERSIONED_DOTFILES[@]}"; do
        src="$HOME/$file"
        dest="$VSCODE_DEST/$(basename "$file")"

        if [[ -e "$src" && ! -L "$src" ]]; then
          echo "📦 Move: $src → $dest"
          mv "$src" "$dest"
          ln -s "$dest" "$src"
          echo "🔗 Link: $src → $dest"
        elif [[ -L "$src" ]]; then
          echo "🔁 Already linked: $src"
        else
          echo "➖ Missing: $file"
        fi
      done

      echo "✅ VS Code dotfile migration done"
    } | tee "$LOG_FILE"`,
      },

      {
        title: "Healthcheck: Dotfiles drift detection (structured diff results + logs)",
        lang: "bash",
        from: "sys_managed healthcheck",
        why: "High signal: systematic drift detection with diffs and clean output you can actually scan during fixes.",
        concepts: ["Auditability", "Error Evidence Preservation"],
        technology: ["Bash"],
        domain: ["Developer Tooling"],
        code: `#!/bin/zsh
    healthcheck_dotfiles() {
      local LOG_DIR="$HOME/sys_managed/logs/healthcheck_logs/dir_file_status_logs"
      mkdir -p "$LOG_DIR"
      local TIMESTAMP=$(date "+%Y-%m-%d_%H-%M-%S")
      local LOG_FILE="$LOG_DIR/health_dir_files_$TIMESTAMP.log"

      local match=0 diff=0 src_missing=0 main_missing=0

      {
        echo "🔍 Dotfile healthcheck — $(date)"
        echo "-------------------------------------"

        # Single-file: template vs live.
        if [[ -f "$HOME/.zshrc" && -f "$HOME/dotfiles/.zshrc.template" ]]; then
          if diff -q "$HOME/.zshrc" "$HOME/dotfiles/.zshrc.template" &>/dev/null; then
            echo "✅ Match: ~/.zshrc"; ((match++))
          else
            echo "❌ Difference: ~/.zshrc"; ((diff++))
          fi
        else
          [[ -f "$HOME/.zshrc" ]] || { echo "❌ Source missing: ~/.zshrc"; ((src_missing++)); }
          [[ -f "$HOME/dotfiles/.zshrc.template" ]] || { echo "❌ Main missing: dotfiles/.zshrc.template"; ((main_missing++)); }
        fi

        # Tree diff: dotfiles/requirements ⇆ sys_managed/requirements.
        if [[ -d "$HOME/dotfiles/requirements" && -d "$HOME/sys_managed/requirements" ]]; then
          while IFS= read -r -d '' file; do
            rel_path="\${file#$HOME/dotfiles/requirements/}"
            sys_file="$HOME/sys_managed/requirements/$rel_path"

            if [[ -e "$sys_file" ]]; then
              if diff -q "$file" "$sys_file" &>/dev/null; then
                echo "✅ Match: requirements/$rel_path"; ((match++))
              else
                echo "❌ Difference: requirements/$rel_path"; ((diff++))
              fi
            else
              echo "❌ Main missing: requirements/$rel_path"; ((main_missing++))
            fi
          done < <(find "$HOME/dotfiles/requirements" -type f -print0)
        else
          [[ -d "$HOME/dotfiles/requirements" ]] || { echo "❌ Source missing: dotfiles/requirements/"; ((src_missing++)); }
          [[ -d "$HOME/sys_managed/requirements" ]] || { echo "❌ Main missing: sys_managed/requirements/"; ((main_missing++)); }
        fi

        echo "-------------------------------------"
        echo "📊 Summary: match=$match diff=$diff source_missing=$src_missing main_missing=$main_missing"
      } | tee "$LOG_FILE"
    }`,
      },

      {
        title: "Git Hook: Pre-push asset sync + CloudFront invalidation (fast fail + cache headers)",
        lang: "bash",
        from: "Battleship asset pipeline",
        why: "Deploy hygiene tied to workflow: sync correctness, caching headers, and a clean invalidation step.",
        concepts: ["CI/CD", "Reliability"],
        technology: ["AWS"],
        domain: ["CI/CD"],
        code: `#!/usr/bin/env bash
    set -euo pipefail

    # Env-driven so this hook works across machines.
    # Defaults are placeholders. Real values should come from your shell or repo env files.
    BUCKET="\${BUCKET:-<S3_BUCKET_PLACEHOLDER>}"                 # dummy value
    CF_DIST="\${CF_DIST:-<CF_DISTRIBUTION_ID_PLACEHOLDER>}"      # dummy value
    AWS_REGION="\${AWS_REGION:-us-east-1}"
    AWS_PROFILE="\${AWS_PROFILE:-<AWS_PROFILE_PLACEHOLDER>}"     # dummy value

    if [[ "\${SKIP_ASSET_SYNC:-0}" == "1" || "\${CI:-}" == "true" ]]; then
      echo "[pre-push] Skipping asset sync."
      exit 0
    fi

    aws sts get-caller-identity >/dev/null 2>&1 || {
      echo "[pre-push] ERROR: Not authenticated to AWS." >&2
      exit 1
    }

    echo "[pre-push] Sync sprites → s3://\${BUCKET}/ships/sprites/"
    aws s3 sync src/assets/ships/sprites "s3://\${BUCKET}/ships/sprites/" \\
      --exclude "*/top/*" \\
      --cache-control "public,max-age=86400" \\
      --delete

    echo "[pre-push] Invalidate CloudFront paths"
    aws cloudfront create-invalidation \\
      --distribution-id "\${CF_DIST}" \\
      --paths "/ships/sprites/*" "/ships/glb/*" >/dev/null

    echo "[pre-push] Done."`,
      },

      {
        title: "Bash: Asset sync to S3 (env-driven + auth check + quiet output)",
        lang: "bash",
        from: "Battleship assets / sync-assets.sh",
        why: "Production-ish scripting: strict mode, env injection, auth check, and quiet logs that won’t spam CI.",
        concepts: ["Reliability", "Defensive Programming"],
        technology: ["AWS"],
        domain: ["DevOps"],
        code: `#!/usr/bin/env bash
    set -euo pipefail

    [ -f .env.local ] && set -a && . ./.env.local && set +a

    ASSETS_DIR="\${ASSETS_DIR:-src/assets/ships/sprites}"
    BUCKET="\${ASSETS_BUCKET:?ASSETS_BUCKET not set (put it in .env.local)}"
    PREFIX="\${ASSETS_PREFIX:-ships/sprites/}"
    REGION="\${AWS_REGION:-us-east-1}"
    PROFILE="\${AWS_PROFILE:-}"

    export AWS_SDK_LOAD_CONFIG=1

    aws sts get-caller-identity >/dev/null 2>&1 || {
      echo "[sync:assets] ERROR: Not authenticated to AWS." >&2
      exit 1
    }

    aws s3 sync "$ASSETS_DIR" "s3://$BUCKET/$PREFIX" --region "$REGION" \\
      \${PROFILE:+--profile "$PROFILE"} --only-show-errors`,
      },

      {
        title: "Bash: CloudFront invalidation (CDN cache bust after deploy)",
        lang: "bash",
        from: "Battleship CDN / cdn-invalidate.sh",
        why: "Small script, big impact: env-driven invalidation paths, explicit auth behavior, and predictable deploy hygiene.",
        concepts: ["Reliability", "Defensive Programming"],
        technology: ["AWS"],
        domain: ["DevOps"],
        code: `#!/usr/bin/env bash
    set -euo pipefail

    [ -f .env.local ] && set -a && . ./.env.local && set +a

    DISTRIBUTION_ID="\${CDN_DISTRIBUTION_ID:?CDN_DISTRIBUTION_ID not set in .env.local}" # dummy placeholder
    PATTERNS="\${CDN_INVALIDATE_PATHS:-/ships/sprites/*}"
    PROFILE="\${AWS_PROFILE:-}"
    REGION="\${AWS_REGION:-us-east-1}"

    export AWS_SDK_LOAD_CONFIG=1

    aws sts get-caller-identity >/dev/null 2>&1 || {
      echo "[cdn:invalidate] ERROR: Not authenticated to AWS." >&2
      exit 1
    }

    aws cloudfront create-invalidation \\
      --distribution-id "$DISTRIBUTION_ID" \\
      --paths $PATTERNS \\
      \${PROFILE:+--profile "$PROFILE"} \\
      --region "$REGION" >/dev/null`,
      },

      {
        title: "Snowflake: Dedicated multi-cluster warehouse (guardrails + predictable scaling)",
        lang: "sql",
        from: "Data Platform Ops (Snowflake)",
        why: "Warehouse settings that behave in prod: autosuspend for cost, multi-cluster for concurrency, and sane timeouts.",
        concepts: ["Reliability", "Resource Isolation"],
        technology: ["Snowflake"],
        domain: ["Data Platform"],
        code: `-- Dedicated warehouse for BI/ELT: idle cost control + concurrency scaling.
    CREATE OR REPLACE WAREHOUSE WH_ANALYTICS
      WAREHOUSE_SIZE = 'MEDIUM'
      WAREHOUSE_TYPE = 'STANDARD'
      AUTO_SUSPEND = 120          -- seconds; short on purpose so we don't pay for idle
      AUTO_RESUME = TRUE
      INITIALLY_SUSPENDED = TRUE  -- start cold after deploys
      MIN_CLUSTER_COUNT = 1
      MAX_CLUSTER_COUNT = 3       -- cap scaling so spend stays predictable
      SCALING_POLICY = 'STANDARD'
      STATEMENT_TIMEOUT_IN_SECONDS = 1800
      COMMENT = 'Dedicated analytics warehouse with cost + concurrency guardrails';

    -- Optional safety net: credit quota + auto suspend.
    -- NOTE: CREDIT_QUOTA is a placeholder; set to your org-approved budget.
    -- CREATE OR REPLACE RESOURCE MONITOR RM_ANALYTICS
    --   WITH CREDIT_QUOTA = <CREDIT_QUOTA_PLACEHOLDER> -- dummy value
    --   TRIGGERS ON 80 PERCENT DO NOTIFY
    --            ON 100 PERCENT DO SUSPEND;
    -- ALTER WAREHOUSE WH_ANALYTICS SET RESOURCE_MONITOR = RM_ANALYTICS;`,
      },

      {
        title: "Snowflake: RBAC baseline (role hierarchy + least privilege grants)",
        lang: "sql",
        from: "Security / Access Control",
        why: "Scalable access control: privileges go to roles, roles go to users, and onboarding/offboarding stays safe.",
        concepts: ["Resource Isolation", "Defensive Programming"],
        technology: ["Snowflake"],
        domain: ["Security", "Data Platform"],
        code: `-- Roles: keep objects granted to roles (not users).
    CREATE OR REPLACE ROLE ROLE_PLATFORM_ADMIN;
    CREATE OR REPLACE ROLE ROLE_ANALYST;
    CREATE OR REPLACE ROLE ROLE_ETL;

    -- Admin inherits functional roles.
    GRANT ROLE ROLE_ANALYST TO ROLE ROLE_PLATFORM_ADMIN;
    GRANT ROLE ROLE_ETL     TO ROLE ROLE_PLATFORM_ADMIN;

    -- Analyst: read-only on curated marts.
    -- NOTE: Replace placeholders with your real DB/schema names.
    GRANT USAGE ON DATABASE <DB_ANALYTICS_PLACEHOLDER> TO ROLE ROLE_ANALYST;
    GRANT USAGE ON SCHEMA <DB_ANALYTICS_PLACEHOLDER>.<SCHEMA_MART_PLACEHOLDER> TO ROLE ROLE_ANALYST;
    GRANT SELECT ON ALL TABLES IN SCHEMA <DB_ANALYTICS_PLACEHOLDER>.<SCHEMA_MART_PLACEHOLDER> TO ROLE ROLE_ANALYST;
    GRANT SELECT ON FUTURE TABLES IN SCHEMA <DB_ANALYTICS_PLACEHOLDER>.<SCHEMA_MART_PLACEHOLDER> TO ROLE ROLE_ANALYST;

    -- ETL: write permissions only where we load/build.
    GRANT USAGE, CREATE TABLE, CREATE VIEW, CREATE STAGE, CREATE FILE FORMAT
      ON SCHEMA <DB_ANALYTICS_PLACEHOLDER>.<SCHEMA_STAGING_PLACEHOLDER> TO ROLE ROLE_ETL;

    -- User assignment: still no direct object grants to users.
    -- NOTE: <USER_EMAIL_PLACEHOLDER> is a dummy value.
    -- CREATE OR REPLACE USER <USER_EMAIL_PLACEHOLDER> DEFAULT_ROLE = ROLE_ANALYST MUST_CHANGE_PASSWORD = TRUE;
    -- GRANT ROLE ROLE_ANALYST TO USER <USER_EMAIL_PLACEHOLDER>;`,
      },

      {
        title: "Snowflake: S3 storage integration + external stage (no access keys in SQL)",
        lang: "sql",
        from: "External Data Access (S3 → Snowflake)",
        why: "Secure S3 access without embedding keys. Easier audits, safer rotation, and less accidental credential leakage.",
        concepts: ["Secrets Management", "Resource Isolation"],
        technology: ["Snowflake", "AWS"],
        domain: ["External Data Access", "Data Platform"],
        code: `-- Storage integration: preferred over access keys. Created once by an admin.
    CREATE OR REPLACE STORAGE INTEGRATION S3_INT_ANALYTICS
      TYPE = EXTERNAL_STAGE
      STORAGE_PROVIDER = S3
      ENABLED = TRUE
      STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<AWS_ACCOUNT_ID_PLACEHOLDER>:role/<SNOWFLAKE_ASSUME_ROLE_PLACEHOLDER>' -- dummy values
      STORAGE_ALLOWED_LOCATIONS = ('s3://<S3_BUCKET_PLACEHOLDER>/<S3_PREFIX_PLACEHOLDER>/'); -- dummy values

    -- Use these outputs to finalize AWS trust (external ID + Snowflake IAM user).
    DESC INTEGRATION S3_INT_ANALYTICS;

    -- File format (CSV example). Keep defaults explicit.
    CREATE OR REPLACE FILE FORMAT FF_CSV_STD
      TYPE = CSV
      SKIP_HEADER = 1
      FIELD_OPTIONALLY_ENCLOSED_BY = '"'
      NULL_IF = ('', 'NULL', 'null')
      EMPTY_FIELD_AS_NULL = TRUE;

    -- Stage wired to the integration (no credentials in SQL).
    CREATE OR REPLACE STAGE STG_S3_RAW
      URL = 's3://<S3_BUCKET_PLACEHOLDER>/<S3_PREFIX_PLACEHOLDER>/' -- dummy values
      STORAGE_INTEGRATION = S3_INT_ANALYTICS
      FILE_FORMAT = FF_CSV_STD;

    LIST @STG_S3_RAW;`,
      },

      {
        title: "Snowflake: Snowpipe + Stream + Tasks (error capture + stream-gated processing)",
        lang: "sql",
        from: "Orchestration / Near-Real-Time Ingestion",
        why: "End-to-end ingest pattern: auto-ingest into raw, capture pipe errors for ops, then stream-gated load into curated.",
        concepts: ["Orchestration", "Error Evidence Preservation", "Write Semantics"],
        technology: ["Snowflake"],
        domain: ["Data Ingestion", "Data Platform"],
        code: `-- Raw landing table (minimal typing; keep payload as VARIANT).
    CREATE OR REPLACE TABLE STG_EVENTS_RAW (
      event_id STRING,
      event_ts STRING,
      payload VARIANT
    );

    -- Snowpipe: stage -> raw. ON_ERROR CONTINUE so bad rows don't block the pipe.
    CREATE OR REPLACE PIPE PIPE_EVENTS_RAW
      AUTO_INGEST = TRUE
    AS
    COPY INTO STG_EVENTS_RAW (event_id, event_ts, payload)
    FROM (
      SELECT
        $1:event_id::STRING,
        $1:event_ts::STRING,
        $1
      FROM @STG_S3_RAW
    )
    FILE_FORMAT = (TYPE = JSON)
    ON_ERROR = 'CONTINUE';

    -- Stream: incremental view of inserts into the raw table.
    CREATE OR REPLACE STREAM STRM_EVENTS_RAW
      ON TABLE STG_EVENTS_RAW;

    -- Error sink: keep it queryable and time-bound.
    CREATE OR REPLACE TABLE PIPE_LOAD_ERRORS (
      file_name STRING,
      line_number INT,
      error_message STRING,
      error_category STRING,
      error_phase STRING,
      inserted_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    );

    -- Capture recent pipe errors. Use placeholders so nothing internal leaks.
    CREATE OR REPLACE TASK T_CAPTURE_PIPE_ERRORS
      WAREHOUSE = '<WAREHOUSE_NAME_PLACEHOLDER>' -- dummy value
      SCHEDULE = 'USING CRON * * * * * UTC'
    AS
    INSERT INTO PIPE_LOAD_ERRORS (file_name, line_number, error_message, error_category, error_phase)
    SELECT
      FILE AS file_name,
      ROW_NUMBER AS line_number,
      ERROR AS error_message,
      CATEGORY AS error_category,
      'Pipe Load Error' AS error_phase
    FROM TABLE(VALIDATE_PIPE_LOAD(
      PIPE_NAME => '<PIPE_NAME_PLACEHOLDER>', -- dummy value
      START_TIME => DATEADD(MINUTE, -5, CURRENT_TIMESTAMP())
    ))
    WHERE ERROR IS NOT NULL;

    -- Curated table.
    CREATE OR REPLACE TABLE EVENTS_CURATED (
      event_id STRING,
      event_time TIMESTAMP_NTZ,
      payload VARIANT,
      ingested_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    );

    -- Process stream only when it has data (saves warehouse cycles).
    CREATE OR REPLACE TASK T_PROCESS_EVENTS
      WAREHOUSE = '<WAREHOUSE_NAME_PLACEHOLDER>' -- dummy value
      AFTER T_CAPTURE_PIPE_ERRORS
      WHEN SYSTEM$STREAM_HAS_DATA('STRM_EVENTS_RAW')
    AS
    INSERT INTO EVENTS_CURATED (event_id, event_time, payload)
    SELECT
      event_id,
      TRY_TO_TIMESTAMP_NTZ(event_ts),
      payload
    FROM STRM_EVENTS_RAW
    WHERE METADATA$ACTION = 'INSERT';

    -- Enable when you're ready.
    -- ALTER TASK T_CAPTURE_PIPE_ERRORS RESUME;
    -- ALTER TASK T_PROCESS_EVENTS RESUME;`,
      },

      {
        title: "Snowflake: Quarantine rejected rows + deduped evidence (pipe validate pattern)",
        lang: "sql",
        from: "Data Quality / Cleaning",
        why: "I keep rejects and error metadata instead of dropping rows. Makes RCA and replay possible when formats change upstream.",
        concepts: ["Data Quality", "Error Evidence Preservation", "Auditability"],
        technology: ["Snowflake"],
        domain: ["Data Quality"],
        code: `-- Capture rejected payloads so we can debug/replay later.
    CREATE OR REPLACE TABLE REJECTED_RECORDS (
      rejects STRING,
      first_seen_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    );

    -- Error metadata is useful for trend + RCA.
    CREATE OR REPLACE TABLE LOAD_ERROR_INFO (
      file_name STRING,
      line_number INT,
      error_message STRING,
      column_name STRING,
      error_category STRING,
      error_phase STRING,
      inserted_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    );

    -- Pull recent pipe errors (last 10 minutes).
    -- NOTE: PIPE_NAME is a placeholder so we don't leak internal identifiers.
    INSERT INTO LOAD_ERROR_INFO (file_name, line_number, error_message, column_name, error_category, error_phase)
    SELECT
      FILE AS file_name,
      ROW_NUMBER AS line_number,
      ERROR AS error_message,
      SPLIT_PART(COLUMN_NAME,'"',4) AS column_name,
      CATEGORY AS error_category,
      'Pipe Load Error' AS error_phase
    FROM TABLE(VALIDATE_PIPE_LOAD(
      PIPE_NAME => '<PIPE_NAME_PLACEHOLDER>', -- dummy value
      START_TIME => DATEADD(MINUTE, -10, CURRENT_TIMESTAMP())
    ))
    WHERE ERROR IS NOT NULL;

    -- Dedup rejects via MERGE (more reliable than relying on constraints).
    MERGE INTO REJECTED_RECORDS t
    USING (
      SELECT DISTINCT REJECTED_RECORD AS rejects
      FROM TABLE(VALIDATE_PIPE_LOAD(
        PIPE_NAME => '<PIPE_NAME_PLACEHOLDER>', -- dummy value
        START_TIME => DATEADD(MINUTE, -10, CURRENT_TIMESTAMP())
      ))
      WHERE REJECTED_RECORD IS NOT NULL
    ) s
    ON t.rejects = s.rejects
    WHEN NOT MATCHED THEN
      INSERT (rejects) VALUES (s.rejects);`,
      },

      {
        from: "Tabular Iceberg API - Backoff & Retry",
        title: "Airflow Partition Sensor (Tabular Iceberg API) — token refresh + bounded retries",
        lang: "python",
        why: "Polling sensor as a callable: refreshes OAuth, queries table metadata, and retries with bounds + logs you can use in incidents.",
        concepts: ["Reliability", "Error Handling", "Defensive Programming"],
        technology: ["Airflow", "Iceberg"],
        domain: ["Data Orchestration", "Data Platform"],
        code: String.raw`import time
    import logging
    import random
    import requests
    from urllib.parse import urlencode
    from datetime import datetime, timedelta

    TOKEN = {"access_token": None}
    EXPIRATION_DATE = datetime.min

    def get_tabular_access_token(tabular_credential: str) -> dict | None:
        # Real secret comes from Airflow Variables/Secrets backend (client_id:client_secret).
        # Example format only (do not hardcode): "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET"
        token_url = "https://api.tabular.io/ws/v1/oauth/tokens"
        client_id, client_secret = tabular_credential.split(":", 1)

        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        body = urlencode(
            {"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret}
        )

        try:
            resp = requests.post(token_url, headers=headers, data=body, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logging.error(f"token error: {e}")
            return None

    def refresh_token_if_needed(tabular_credential: str) -> None:
        global TOKEN, EXPIRATION_DATE

        if (not TOKEN.get("access_token")) or (EXPIRATION_DATE <= datetime.now()):
            token = get_tabular_access_token(tabular_credential)
            if not token:
                raise RuntimeError("failed to refresh Tabular access token")

            TOKEN = token
            expires_in = int(token.get("expires_in", 3600))
            EXPIRATION_DATE = datetime.now() + timedelta(seconds=max(300, expires_in - 60))

    def query_table_partitions(table_name: str, partition_path: str, tabular_credential: str, warehouse: str) -> bool:
        refresh_token_if_needed(tabular_credential)

        database, table = table_name.split(".", 1)
        access_token = TOKEN["access_token"]

        url = (
            f"https://api.tabular.io/ws/v1/ice/warehouses/{warehouse}"
            f"/namespaces/{database}/tables/{table}"
        )
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {access_token}"}

        try:
            resp = requests.get(url, headers=headers, timeout=20)
            resp.raise_for_status()
            payload = resp.json()

            full_partition_path = f"partitions.{partition_path}"

            snapshots = payload.get("metadata", {}).get("snapshots", []) or []
            for snapshot in snapshots:
                summary = snapshot.get("summary", {}) or {}
                if full_partition_path in summary:
                    logging.info(f"partition found: table={table_name} partition={partition_path}")
                    return True

            return False
        except requests.RequestException as e:
            logging.error(f"partition query error: table={table_name} err={e}")
            return False

    def poke_tabular_partition(
        table: str,
        partition: str,
        tabular_credential: str,
        warehouse: str,
        max_retries: int = 10,
        wait_time: int = 60,
    ) -> bool:
        # Bounded polling with jitter so retries don't thump the API in lockstep.
        for attempt in range(1, max_retries + 1):
            if query_table_partitions(table, partition, tabular_credential, warehouse):
                logging.info(f"partition ready after {attempt} attempt(s)")
                return True

            sleep_s = wait_time + random.randint(0, min(10, wait_time // 4))
            logging.warning(f"attempt {attempt}/{max_retries}: not ready, retrying in {sleep_s}s")
            time.sleep(sleep_s)

        logging.error(f"partition not found after {max_retries} attempts")
        return False`,
      },

      {
        from: "Airflow Orchestration SCD Type-II",
        title: "Airflow Orchestration — SCD history build with partition gate + DQ check (Trino + Iceberg)",
        lang: "python",
        why: "Yearly DAG: wait for upstream partition, build staging, run a DQ gate, then apply SCD mutations. Good template for safe backfills.",
        concepts: ["Orchestration", "Change Data Capture (CDC / SCD)", "Data Quality", "Error Handling"],
        technology: ["Airflow", "Snowflake"],
        domain: ["Analytics Engineering", "Data Platform"],
        code: String.raw`from airflow.decorators import dag
    from airflow.operators.python_operator import PythonOperator
    from airflow.utils.dates import datetime, timedelta
    from airflow.models import Variable

    from include.eczachly.poke_tabular_partition import poke_tabular_partition
    from include.eczachly.trino_queries import run_trino_query_dq_check, execute_trino_query

    TABULAR_CREDENTIAL = Variable.get("TABULAR_CREDENTIAL")  # stored in Variables/Secrets backend

    @dag(
        description="Incremental SCD load into Iceberg using Trino; partition-gated with DQ checks",
        default_args={
            "owner": "Tejas Raut",
            "start_date": datetime(2020, 1, 1),  # sane baseline; catchup does the rest
            "retries": 1,
            "execution_timeout": timedelta(hours=1),
        },
        max_active_runs=1,
        schedule_interval="@yearly",
        catchup=True,
        tags=["orchestration", "iceberg", "scd"],
    )
    def actors_history_scd_dag():
        run_ds = "{{ ds }}"

        upstream_table = "bootcamp.actor_films"
        production_table = "YOUR_SCHEMA.actors_history_scd"   # placeholder
        staging_table = "YOUR_SCHEMA.actors_history_stg"      # placeholder

        wait_for_upstream_partition = PythonOperator(
            task_id="wait_for_upstream_partition",
            python_callable=poke_tabular_partition,
            op_kwargs={
                "tabular_credential": TABULAR_CREDENTIAL,
                "table": upstream_table,
                "partition": "year = YEAR(DATE('{run_ds}'))",
            },
            provide_context=True,
        )

        create_prod = PythonOperator(
            task_id="create_prod",
            depends_on_past=True,
            python_callable=execute_trino_query,
            op_kwargs={
                "query": f"""
                CREATE OR REPLACE TABLE {production_table} (
                    actor_id VARCHAR,
                    actor_name VARCHAR,
                    is_active BOOLEAN,
                    start_year INTEGER,
                    end_year INTEGER,
                    current_year INTEGER
                )
                WITH (
                    FORMAT = 'PARQUET',
                    partitioning = ARRAY['current_year']
                )
                """
            },
        )

        create_stg = PythonOperator(
            task_id="create_stg",
            depends_on_past=True,
            python_callable=execute_trino_query,
            op_kwargs={
                "query": f"""
                CREATE OR REPLACE TABLE {staging_table} (
                    actor_id VARCHAR,
                    actor VARCHAR,
                    year INTEGER
                )
                """
            },
        )

        clear_prod_partition = PythonOperator(
            task_id="clear_prod_partition",
            depends_on_past=True,
            python_callable=execute_trino_query,
            op_kwargs={"query": f"DELETE FROM {production_table} WHERE current_year = YEAR(DATE('{run_ds}'))"},
        )

        clear_stg_partition = PythonOperator(
            task_id="clear_stg_partition",
            depends_on_past=True,
            python_callable=execute_trino_query,
            op_kwargs={"query": f"DELETE FROM {staging_table} WHERE year = YEAR(DATE('{run_ds}'))"},
        )

        load_stg = PythonOperator(
            task_id="load_stg",
            depends_on_past=True,
            python_callable=execute_trino_query,
            op_kwargs={
                "query": f"""
                SELECT
                    CASE WHEN u.actor_id IS NULL THEN p.actor_id ELSE u.actor_id END AS actor_id,
                    CASE WHEN u.actor IS NULL THEN p.actor_name ELSE u.actor END AS actor,
                    year
                FROM {upstream_table} u
                LEFT JOIN {production_table} p
                  ON u.actor_id = p.actor_id OR u.actor = p.actor_name
                WHERE u.year = YEAR(DATE('{run_ds}'))
                GROUP BY 1,2,3
                """
            },
        )

        pre_dq_check = PythonOperator(
            task_id="pre_dq_check",
            depends_on_past=True,
            python_callable=run_trino_query_dq_check,
            op_kwargs={
                "query": f"""
                SELECT CASE WHEN COUNT(1) > 0 THEN 1 ELSE 0 END AS data_exists
                FROM {staging_table}
                WHERE year = YEAR(DATE('{run_ds}'))
                """
            },
        )

        scd_step = PythonOperator(
            task_id="scd_step",
            depends_on_past=True,
            python_callable=execute_trino_query,
            op_kwargs={
                "query": f"""
                -- SCD merge/update logic goes here (Type-2 style history table).
                -- Read from {staging_table} for YEAR(DATE('{run_ds}')) and write into {production_table}
                -- scoped to current_year = YEAR(DATE('{run_ds}')).
                """
            },
        )

        wait_for_upstream_partition >> create_prod >> create_stg
        create_stg >> clear_prod_partition >> clear_stg_partition >> load_stg >> pre_dq_check >> scd_step

    actors_history_scd_dag()`,
      },

      {
        from: "dbt Snowflake Configuration",
        title: "dbt (Snowflake) — profiles + project + packages (CI-friendly defaults)",
        lang: "yaml",
        why: "Clean dbt baseline: env-driven schema, conservative threads, pinned packages, and no secrets committed.",
        concepts: ["Configuration Management", "Secrets Management", "Resource Isolation", "CI/CD"],
        technology: ["dbt", "Snowflake"],
        domain: ["Analytics Engineering"],
        code: String.raw`# profiles.yml
    # Keep secrets out of this file. Use env vars or a secrets manager in CI/CD.
    haunted_houses:
      target: dev
      outputs:
        dev:
          type: snowflake

          # Placeholder only. Real account locator/region should come from env.
          account: "{{ env_var('SNOWFLAKE_ACCOUNT') }}"  # dummy in public snippets

          # Prefer keypair auth / SSO in real setups.
          user: "{{ env_var('SNOWFLAKE_USER') }}"
          role: "{{ env_var('SNOWFLAKE_ROLE') }}"
          database: "{{ env_var('SNOWFLAKE_DATABASE') }}"
          warehouse: "{{ env_var('SNOWFLAKE_WAREHOUSE') }}"

          # Schema via env var so branches/users can isolate cleanly.
          schema: "{{ env_var('DBT_SCHEMA') }}"
          threads: 1
          client_session_keep_alive: false
          query_tag: "{{ env_var('DBT_SCHEMA') }}"

          connect_timeout: 10
          connect_retries: 0
          retry_on_database_errors: false
          reuse_connections: true


    # dbt_project.yml
    name: "haunted_houses"
    config-version: 2
    version: "0.1"
    profile: "haunted_houses"

    model-paths: ["models"]
    seed-paths: ["seeds"]
    test-paths: ["tests", "data-tests"]
    analysis-paths: ["analysis"]
    macro-paths: ["macros"]

    target-path: "target"
    clean-targets: ["target", "dbt_modules", "logs"]

    require-dbt-version: [">=1.0.0", "<2.0.0"]

    models:
      haunted_houses:
        +materialized: table
        staging:
          +materialized: view


    # packages.yml
    # Keep versions pinned; update intentionally.
    packages:
      - package: dbt-labs/dbt_utils
        version: 1.3.0
      - package: calogica/dbt_expectations
        version: 0.10.4
      - package: dbt-labs/codegen
        version: 0.12.1
      - package: calogica/dbt_date
        version: 0.10.1`,
      },

      {
        from: "Airflow dbt Orchestration Taskgroup",
        title: "Airflow → dbt orchestration (deps → run → test) — TaskGroup template",
        lang: "python",
        why: "Simple Airflow pattern that reads like prod: idempotent deps, fail-fast build, and tests as a real gate.",
        concepts: ["Orchestration", "CI/CD", "Data Quality", "Reliability"],
        technology: ["Airflow", "dbt"],
        domain: ["Analytics Engineering", "Data Orchestration"],
        code: String.raw`from airflow.decorators import dag
    from airflow.utils.task_group import TaskGroup
    from airflow.operators.bash import BashOperator
    from airflow.utils.dates import datetime, timedelta

    DBT_PROJECT_DIR = "/path/to/dbt/project"  # placeholder: set via env/Variable
    DBT_TARGET = "dev"                       # maps to profiles.yml target

    @dag(
        schedule="@daily",
        start_date=datetime(2024, 1, 1),
        catchup=False,
        default_args={"retries": 1, "retry_delay": timedelta(minutes=5)},
        tags=["dbt", "orchestration"],
    )
    def dbt_daily_pipeline():
        with TaskGroup(group_id="dbt") as dbt_tg:
            dbt_deps = BashOperator(
                task_id="deps",
                bash_command=f"set -euo pipefail; cd {DBT_PROJECT_DIR} && dbt deps",
            )

            dbt_run = BashOperator(
                task_id="run",
                bash_command=f"set -euo pipefail; cd {DBT_PROJECT_DIR} && dbt run --target {DBT_TARGET} --fail-fast",
            )

            dbt_test = BashOperator(
                task_id="test",
                bash_command=f"set -euo pipefail; cd {DBT_PROJECT_DIR} && dbt test --target {DBT_TARGET}",
            )

            dbt_deps >> dbt_run >> dbt_test

    dbt_daily_pipeline()`,
      },
    ],
    []
  );

  // -----------------------------
  // Filters (Project.js-style)
  // -----------------------------
  const [filters, setFilters] = React.useState([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownRef = React.useRef(null);

  const toggleFilter = (value) => {
    setFilters((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };
  const resetFilters = () => setFilters([]);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Derive metadata for filtering (hiring-manager friendly)
  const allWithMeta = React.useMemo(() => {
    const toArray = (v) => {
      if (!v) return [];
      return Array.isArray(v) ? v.filter(Boolean) : [v];
    };

    return snippets.map((s, idx) => ({
      ...s,
      __idx: idx, // keep original index so open/anchors/scroll never desync
      technology: toArray(s.technology),
      concepts: toArray(s.concepts),
      domain: Array.isArray(s.domain) ? (s.domain[0] || "Other") : (s.domain || "Other"),
      language: (s.lang || "other").toLowerCase(),
    }));
  }, [snippets]);

  const filterOptions = React.useMemo(() => {
    const uniq = (arr) => Array.from(new Set(arr)).filter(Boolean).sort((a, b) => a.localeCompare(b));

    return {
      Technology: uniq(allWithMeta.flatMap((s) => s.technology || [])),
      Concept: uniq(allWithMeta.flatMap((s) => s.concepts || [])),
      Domain: uniq(allWithMeta.map((s) => s.domain)),
      Language: uniq(allWithMeta.map((s) => s.language)),
    };
  }, [allWithMeta]);

  const getCount = (category, value) => {
    return allWithMeta.filter((s) => {
      if (category === "Technology") return (s.technology || []).includes(value);
      if (category === "Concept") return (s.concepts || []).includes(value);
      if (category === "Domain") return s.domain === value;
      if (category === "Language") return s.language === value;
      return false;
    }).length;
  };

  const filteredSnippets = React.useMemo(() => {
    if (filters.length === 0) return allWithMeta;

    // filters holds strings like "Technology::AWS"
    const selected = filters.reduce((acc, f) => {
      const [cat, val] = f.split("::");
      if (!acc[cat]) acc[cat] = new Set();
      acc[cat].add(val);
      return acc;
    }, {});

    return allWithMeta.filter((s) => {
      // AND across categories, OR within a category
      for (const [cat, set] of Object.entries(selected)) {
        if (cat === "Technology") {
          const tech = s.technology || [];
          if (![...set].some((v) => tech.includes(v))) return false;
        } else if (cat === "Concept") {
          const concepts = s.concepts || [];
          if (![...set].some((v) => concepts.includes(v))) return false;
        } else if (cat === "Domain") {
          if (![...set].some((v) => s.domain === v)) return false;
        } else if (cat === "Language") {
          if (![...set].some((v) => s.language === v)) return false;
        }
      }
      return true;
    });
  }, [allWithMeta, filters]);


  // -----------------------------
  // Collapsible state (accordion: only one open)
  // -----------------------------
  const [openIdx, setOpenIdx] = React.useState(null);

  // when switching, we briefly keep the previous one mounted but collapsing
  const [closingIdx, setClosingIdx] = React.useState(null);

  const anchorsRef = React.useRef([]);
  const cardRefs = React.useRef({});

  // per-snippet scroll anchor (where user was when they clicked "View")
  const expandScrollYRef = React.useRef({});

  // On Hide, restore scroll AFTER collapse finishes (so it doesn't fight layout).
  const pendingRestoreYRef = React.useRef(null);

  // During switch: scroll to the new card AND keep it pinned while the old one collapses.
  // shape:
  // { idx, desiredTop, durationMs, startTs, startScrollY, targetScrollY }
  const pinDuringSwitchRef = React.useRef(null);

  const PIN_TOP_OFFSET = 12;     // px from viewport top
  const SWITCH_DURATION = 420;   // a touch longer = fewer visible “frame steps”

  const getCardTopY = (el, desiredTopPx) => {
    if (!el) return window.scrollY;
    const rect = el.getBoundingClientRect();
    return window.scrollY + (rect.top - desiredTopPx);
  };

  const toggle = (idx) => {
    const cardEl = cardRefs.current[idx];

    // ---- HIDE (same card) ----
    if (openIdx === idx) {
      // restore AFTER collapse so the scroll doesn't get fought by shrinking layout
      const y = expandScrollYRef.current[idx];
      if (typeof y === "number") pendingRestoreYRef.current = y;

      setOpenIdx(null);
      return;
    }

    // Save "where it was viewed from" using the card top (stable)
    const anchorY = cardEl
      ? cardEl.getBoundingClientRect().top + window.scrollY - PIN_TOP_OFFSET
      : window.scrollY;

    expandScrollYRef.current[idx] = anchorY;
    markExpanded(snippets[idx]?.title);

    // ---- SWITCH (some other is open) ----
    if (openIdx !== null && openIdx !== idx) {
      const prev = openIdx;

      // New one becomes active immediately
      setOpenIdx(idx);

      // Collapse old one but keep it mounted briefly
      setClosingIdx(prev);

      const desiredTop = PIN_TOP_OFFSET;
      const startScrollY = window.scrollY;

      // IMPORTANT: compute target from the card element’s top (stable),
      // not from any focused button position.
      const targetScrollY = getCardTopY(cardEl, desiredTop);

      pinDuringSwitchRef.current = {
        idx,
        desiredTop,
        durationMs: SWITCH_DURATION,
        startTs: performance.now(),
        startScrollY,
        targetScrollY,
        lastScrollY: startScrollY, // for smoothing
      };

      return;
    }

    // ---- OPEN (nothing else open) ----
    setOpenIdx(idx);
  };


  React.useEffect(() => {
    const info = pinDuringSwitchRef.current;
    if (!info) return;

    let raf = 0;

    // const easeInOutCubic = (x) =>
    //   x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

    const tick = () => {
      const el = cardRefs.current[info.idx];
      if (!el) {
        pinDuringSwitchRef.current = null;
        setClosingIdx(null);
        return;
      }

      const now = performance.now();
      const rawT = Math.min(1, (now - info.startTs) / info.durationMs);
      // const t = easeInOutCubic(rawT);

      // Where should the card be pinned right now?
      // This recomputes every frame, so if A collapsing changes B's document top,
      // we follow it smoothly instead of "correcting after the fact".
      const docTop = el.getBoundingClientRect().top + window.scrollY;
      const desiredScrollY = docTop - info.desiredTop;

      // Smoothly chase the moving target (silky).
      // Slightly higher smoothing = fewer visible "step" jumps.
      const alpha = 0.28; // try 0.24–0.34 if you want it tighter/looser
      const next = info.lastScrollY + (desiredScrollY - info.lastScrollY) * alpha;

      info.lastScrollY = next;
      window.scrollTo({ top: next, behavior: "auto" });

      if (rawT < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }

      pinDuringSwitchRef.current = null;
      setClosingIdx(null);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [openIdx]);


  React.useEffect(() => {
    if (openIdx !== null) return;

    const y = pendingRestoreYRef.current;
    if (typeof y !== "number") return;

    const t = window.setTimeout(() => {
      window.scrollTo({ top: y, behavior: "auto" });
      pendingRestoreYRef.current = null;
    }, SWITCH_DURATION);

    return () => window.clearTimeout(t);
  }, [openIdx]);


  const SESSION_KEY = "codelab_expanded_titles_v1";
  const [expandedThisSession, setExpandedThisSession] = React.useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });


  const markExpanded = React.useCallback((title) => {
    setExpandedThisSession((prev) => {
      const next = new Set(prev);
      next.add(title);
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);


  function PreviewBlock({ code }) {
    // Keep it short so initial load is fast.
    const maxLines = 10;
    const preview = React.useMemo(() => {
      const lines = String(code ?? "").split("\n");
      const head = lines.slice(0, maxLines).join("\n");
      return lines.length > maxLines ? `${head}\n…` : head;
    }, [code]);

    return (
      <pre
        className="overflow-hidden text-xs text-gray-700 dark:text-gray-300"
        style={{
          margin: 0,
          background: "transparent",
          padding: "16px",
          lineHeight: "1.6",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        <code>{preview}</code>
      </pre>
    );
  }


  // -----------------------------
  // CodeBlock
  // - SAME code style for light + dark (vscDarkPlus)
  // - Unified background color
  // - No extra shine, no nested card feel
  // -----------------------------
  function CodeBlock({ code, lang, enhanceOnIdle = false }) {
    const [phase, setPhase] = React.useState(enhanceOnIdle ? "plain" : "prism");

    const wheelScrollChain = (e) => {
      const el = e.currentTarget;

      // If the element isn't scrollable, let the page handle it
      if (el.scrollHeight <= el.clientHeight) return;

      const deltaY = e.deltaY;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      // If we can scroll inside the code block, consume the wheel
      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
        e.preventDefault();
        el.scrollTop += deltaY; // manual scroll so page doesn’t also move
      }
      // else: we’re at an edge in that direction -> allow page scroll naturally
    };

    React.useEffect(() => {
      if (!enhanceOnIdle) return;

      let raf1 = 0;
      let raf2 = 0;
      let cancelled = false;

      // Let expand paint happen, then fade to Prism.
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (!cancelled) setPhase("prism");
        });
      });

      return () => {
        cancelled = true;
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }, [enhanceOnIdle]);

    const wrapperStyle = {
      margin: 0,
      background: "transparent",
      padding: "16px",
      fontSize: "14px",
      lineHeight: "1.65",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    };

    return (
      <div className="relative rounded-2xl overflow-hidden bg-gray-200/50 dark:bg-[#0f1320] max-h-[70vh]">
        {/* Measuring layer: keeps height stable even while crossfading */}
        <pre style={wrapperStyle} className="opacity-0 pointer-events-none select-none">
          <code>{code}</code>
        </pre>

        {/* Plain layer */}
        <pre
          style={wrapperStyle}
          onWheel={wheelScrollChain}
          className={[
            "absolute inset-0 overflow-auto overscroll-auto transition-opacity duration-300",
            phase === "plain" ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <code>{code}</code>
        </pre>

        {/* Prism layer */}
        <div
          onWheel={wheelScrollChain}
          className={[
            "absolute inset-0 overflow-auto overscroll-auto transition-opacity duration-300",
            phase === "prism" ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{ pointerEvents: phase === "prism" ? "auto" : "none" }}
        >
          <SyntaxHighlighter
            language={lang}
            style={darkMode ? vscDarkPlus : oneLight}
            showLineNumbers
            wrapLongLines
            customStyle={{ ...wrapperStyle, margin: 0 }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  function SnippetCard({ snippet, idx }) {
    const isOpen = openIdx === idx;
    const isClosing = closingIdx === idx;
    const shouldShowExpanded = isOpen || isClosing;

    const { title, code, lang, why, from } = snippet;
    const wasExpanded = expandedThisSession.has(title);

    return (
      <article
        ref={(el) => {
          if (el) cardRefs.current[idx] = el;
        }}
        className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-[#1f2230] shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-4 py-3 border-b border-gray-200 dark:border-gray-700 overflow-hidden">
          {wasExpanded && (
            <div
              className="
                pointer-events-none absolute top-0 left-0 h-full w-[35rem]
                bg-gradient-to-r
                from-purple-300/60 via-purple-200/40 to-transparent
                dark:from-purple-600/30 dark:via-purple-600/20
              "
            />
          )}
         {/* Header content (kept above the purple fade) */}
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                {title}
              </h3>

              <span className="shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-white">
                {lang}
              </span>
            </div>

            <p className="mt-0 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {why}
            </p>

            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <span className="font-semibold text-gray-900 dark:text-gray-300">From:</span>{" "}
              {from}
            </div>

          </div>
        </div>

        {/* Collapsible body */}
        <div className="relative">
          {!shouldShowExpanded && (
            <div className="relative">
              <div className="px-4 py-3 max-h-24 overflow-hidden">
                <div className="rounded-2xl overflow-hidden bg-gray-200/50 dark:bg-[#0f1320]">
                  <PreviewBlock code={code} />
                </div>
              </div>

              {/* Fade overlay */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white dark:from-[#1f2230] to-transparent" />

              {/* View control */}
              <div className="absolute inset-x-0 bottom-2 flex justify-center">
                <button
                  ref={(el) => (anchorsRef.current[idx] = el)}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // stops focus-scroll drift
                  onClick={() => toggle(idx)}
                  className="
                    inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full
                    bg-white/90 dark:bg-white/10
                    border border-gray-200 dark:border-gray-700
                    text-purple-800 dark:text-purple-200
                    shadow-sm hover:shadow-md
                    transition
                  "
                >
                  <span>View</span>
                  <FiChevronsDown className="text-base opacity-80" />
                </button>
              </div>
            </div>
          )}

          
          <div
            className={[
              "grid transition-[grid-template-rows] duration-300 ease-in-out",
              isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]", // closing uses 0fr but stays mounted
            ].join(" ")}
          >
            <div className="overflow-hidden">
              {shouldShowExpanded && (
                <div className="px-4 py-4">
                  <CodeBlock code={code} lang={lang} enhanceOnIdle />

                  <div className="mt-4 flex justify-center">
                    <button
                      ref={(el) => (anchorsRef.current[idx] = el)}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()} // stops focus-scroll drift
                      onClick={() => toggle(idx)}
                      className="
                        inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full
                        bg-white/90 dark:bg-white/10
                        border border-gray-200 dark:border-gray-700
                        text-purple-800 dark:text-purple-200
                        shadow-sm hover:shadow-md
                        transition
                      "
                    >
                      <span>Hide</span>
                      <FiChevronsUp className="text-base opacity-80" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section
      className="py-0 px-4 bg-gray-50 dark:bg-[#181826] transition-colors"
      style={{ overflowAnchor: "none" }}
    >
      <div className="px-6 max-w-6xl mx-auto">
        <div className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
              <FaCode className="text-3xl" />
              Code Lab
            </h2>

            <p className="mt-5 text-gray-600 dark:text-gray-400 max-w-3xl">
              A curated set of small, sanitized, and production-minded snippets that reflect how I build:
              secure access, deterministic ingestion, reusable transforms, orchestration, and consistent writes.
            </p>
          </div>

          {/* Filter Button + Dropdown (same vibe as Projects) */}
          <div className="relative w-fit text-left" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="bg-gray-200/40 dark:bg-white/10 backdrop-blur-xl border border-gray-300 dark:border-white/30 rounded-xl px-3 py-1 font-medium text-gray-800 dark:text-white shadow-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-all flex items-center gap-2"
              type="button"
            >
              <HiOutlineFilter className="text-lg" />
              Filter ▾
            </button>

            {showDropdown && (
              <div
                className="absolute right-0 mt-2 w-80 max-h-[500px] overflow-y-auto p-4 z-20
                  bg-gray-300/40 dark:bg-gray-600/40 text-gray-800 dark:text-gray-200
                  backdrop-blur-xl backdrop-saturate-150
                  rounded-2xl border border-white/20 dark:border-white/20
                  shadow-xl ring-1 ring-white/20 transition-all text-left scroll-smooth"
              >
                {Object.entries(filterOptions).map(([category, values]) => (
                  <div key={category} className="mb-10">
                    <h4 className="text-sm text-gray-700 dark:text-white/70 font-semibold uppercase mb-2">
                      {category}
                    </h4>
                    <div className="w-full h-[1px] bg-gray-300 dark:bg-gray-600 mb-3" />
                    <div className="flex flex-wrap gap-2">
                      {values.map((option) => (
                        <button
                          key={option}
                          onClick={() => toggleFilter(`${category}::${option}`)}
                          type="button"
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all border
                            ${
                              filters.includes(`${category}::${option}`)
                                ? "bg-purple-600 text-white border-purple-700"
                                : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200 dark:bg-white/20 dark:text-white dark:border-white/30 dark:hover:bg-white/30"
                            }`}
                        >
                          {option} ({getCount(category, option)})
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  onClick={resetFilters}
                  type="button"
                  className="mt-2 text-sm text-purple-600 dark:text-purple-300 hover:underline"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredSnippets.map((snip) => (
            <SnippetCard
              key={`${snip.__idx}-${snip.title}`}
              snippet={snip}
              idx={snip.__idx}
            />
          ))}
        </div>
      </div>
    </section>
  );
}