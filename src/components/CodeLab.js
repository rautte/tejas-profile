// src/components/CodeLab.js
import React from "react";
import { FaCode } from "react-icons/fa";
import { FiChevronsDown, FiChevronsUp } from "react-icons/fi";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";


export default function CodeLab({ darkMode }) {
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

    {
      title: "Go CLI: Cobra Root Command with global flags + UX defaults",
      lang: "go",
      from: "syzmaniac CLI",
      why: "Sets a clean CLI contract: consistent help, global verbosity, and predictable error behavior across subcommands.",
      code: `var rootCmd = &cobra.Command{
    Use:          "syz",
    Short:        "syzmaniac — developer environment manager",
    SilenceUsage: true,  // don't print usage on runtime errors
    SilenceErrors: true, // let main() handle formatting
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
  }`,
    },

    {
      title: "Go CLI: Install command with structured flags (version, force) + routing",
      lang: "go",
      from: "syzmaniac CLI",
      why: "Encodes installer UX cleanly: one entrypoint, consistent flags, and routing to app-specific installers.",
      code: `var installCmd = &cobra.Command{
    Use:   "install <app>",
    Short: "Install a tool (idempotent)",
    Args:  cobra.ExactArgs(1),
    RunE: func(cmd *cobra.Command, args []string) error {
      app := args[0]

      version, _ := cmd.Flags().GetString("version")
      force, _ := cmd.Flags().GetBool("force")

      // resolve installer by name (registry/factory pattern)
      inst, err := installer.Resolve(app)
      if err != nil { return err }

      ctx := installer.Context{
        Version: version,
        Force:   force,
        Verbose: verbose,
      }
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
      title: "Frontend: Hero Particles init (links preset + grab/push interactions)",
      lang: "javascript",
      from: "Portfolio Hero Section",
      why: "Keeps animation ‘cool but controlled’: reusable init, minimal config, and interactions that feel intentional.",
      code: `import { loadLinksPreset } from "tsparticles-preset-links";
  import { loadExternalGrabInteraction } from "tsparticles-interaction-external-grab";
  import { loadExternalPushInteraction } from "tsparticles-interaction-external-push";
  import { useCallback } from "react";

  const particlesInit = useCallback(async (engine) => {
    await loadLinksPreset(engine);               // links preset
    await loadExternalGrabInteraction(engine);   // grab on hover
    await loadExternalPushInteraction(engine);   // push on click
  }, []);`,
    },

    {
      title: "Battleship: Persist quick-resume state on tab close (sane TTL)",
      lang: "typescript",
      from: "Battleship Multiplayer UX",
      why: "Avoids ‘lost game’ frustration: saves a minimal resume blob with an expiry so stale sessions don’t linger.",
      code: `// persist a quick-resume blob on tab close
  React.useEffect(() => {
    const onBeforeUnload = () => {
      if (!roomCode || !roomRef.current) return;
      try {
        saveLocalResume(roomCode, roleRef.current, {
          exp: Date.now() + RESUME_WINDOW_MS,
          playerGrid: playerGridRef.current,
          playerFleet: playerFleetRef.current,
          iAmReady: iAmReadyRef.current ?? false,
          turn: turnRef.current,
        });
      } catch {}
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [roomCode, saveLocalResume]);`,
    },

    {
      title: "Battleship: Apply remote/local snapshot defensively (no-crash sync)",
      lang: "typescript",
      from: "Battleship State Management",
      why: "Makes sync robust: partial snapshots won’t crash the UI, and placement state stays consistent with fleet size.",
      code: `const applyStateSnapshot = React.useCallback((s: any) => {
    try {
      if (s.phase) setPhase(s.phase);
      if (s.turn) setTurn(s.turn);
      if (s.playerGrid) setPlayerGrid(s.playerGrid);
      if (s.playerFleet) setPlayerFleet(s.playerFleet);

      if (s.playerFleet && phaseRef.current === "place") {
        try { setToPlace(FLEET_SIZES.slice(Object.keys(s.playerFleet).length)); } catch {}
      }

      if (s.playerShots) setPlayerShots(s.playerShots);
      if (s.enemyGrid) setEnemyGrid(s.enemyGrid);
      if (s.enemyFleet) setEnemyFleet(s.enemyFleet);
      if (s.enemyShots) setEnemyShots(s.enemyShots);
      if (typeof s.msg === "string") setMsg(s.msg);

      setEnemyRevealed(false);
    } catch {}
  }, []);`,
    },

    {
      title: "DevOps Script: S3 asset sync with session validation (AWS SSO aware)",
      lang: "bash",
      from: "Battleship Asset Pipeline",
      why: "Makes uploads reliable on real teams: validates session, supports SSO re-login, and avoids noisy output.",
      code: `#!/usr/bin/env bash
  set -euo pipefail

  [ -f .env.local ] && set -a && . ./.env.local && set +a

  ASSETS_DIR="\${ASSETS_DIR:-src/assets/ships/sprites}"
  BUCKET="\${ASSETS_BUCKET:?ASSETS_BUCKET not set (put it in .env.local)}"
  PREFIX="\${ASSETS_PREFIX:-ships/sprites/}"
  REGION="\${AWS_REGION:-us-east-1}"
  PROFILE="\${AWS_PROFILE:-}"

  export AWS_SDK_LOAD_CONFIG=1

  ensure_aws_session() {
    if aws sts get-caller-identity >/dev/null 2>&1; then return 0; fi
    if [[ -n "$PROFILE" ]]; then
      echo "[sync:assets] AWS session invalid. Trying SSO login for '$PROFILE'…"
      aws sso login --profile "$PROFILE"
      aws sts get-caller-identity >/dev/null 2>&1 || return 1
      return 0
    fi
    echo "[sync:assets] ERROR: Not authenticated and AWS_PROFILE is empty." >&2
    return 1
  }

  ensure_aws_session
  aws s3 sync "$ASSETS_DIR" "s3://$BUCKET/$PREFIX" --region "$REGION" \\
    \${PROFILE:+--profile "$PROFILE"} --only-show-errors`,
    },

    {
      title: "DevOps Script: CloudFront invalidation with SSO fallback",
      lang: "bash",
      from: "Battleship CDN Ops",
      why: "Keeps cache updates predictable: env-driven paths, SSO-friendly auth, and a single command for deploy hygiene.",
      code: `#!/usr/bin/env bash
  set -euo pipefail

  [ -f .env.local ] && set -a && . ./.env.local && set +a

  DISTRIBUTION_ID="\${CDN_DISTRIBUTION_ID:?CDN_DISTRIBUTION_ID not set in .env.local}"
  PATTERNS="\${CDN_INVALIDATE_PATHS:-/ships/sprites/*}"
  PROFILE="\${AWS_PROFILE:-}"
  REGION="\${AWS_REGION:-us-east-1}"

  export AWS_SDK_LOAD_CONFIG=1

  ensure_aws_session() {
    if aws sts get-caller-identity >/dev/null 2>&1; then return 0; fi
    if [[ -n "$PROFILE" ]]; then
      echo "[cdn:invalidate] Session invalid. Trying SSO login for '$PROFILE'…"
      aws sso login --profile "$PROFILE"
      aws sts get-caller-identity >/dev/null 2>&1 || return 1
      return 0
    fi
    echo "[cdn:invalidate] ERROR: Not authenticated and AWS_PROFILE is empty." >&2
    return 1
  }

  ensure_aws_session
  aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths $PATTERNS \\
    \${PROFILE:+--profile "$PROFILE"} --region "$REGION" >/dev/null`,
    },

    {
      title: "3D Asset Tooling: Batch FBX → GLB conversion via Blender CLI",
      lang: "python",
      from: "Battleship 3D Asset Pipeline",
      why: "Makes 3D assets reproducible: clean factory settings, auto texture relinking, and deterministic GLB exports.",
      code: `# /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_fbx_to_glb.py

  import bpy, os

  ROOT = os.path.abspath("src/assets/ships/raw")
  OUT  = os.path.abspath("src/assets/ships/glb")
  os.makedirs(OUT, exist_ok=True)

  def process(ship):
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

  ships = ["visby","k130","saar6","lcs-freedom","lcs-independence"]
  for s in ships: process(s)
  print("[done]")`,
    },

    {
      title: "UI Logic: Timeline active-card detection + discrete progress calc",
      lang: "javascript",
      from: "Timeline Carousel UX",
      why: "Makes the horizontal timeline feel ‘snappy’: tracks the centered card and computes progress without weird partial fills.",
      code: `let closestIndex = 0;
  let closestDistance = Infinity;

  // cards are children with ".timeline-card"
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

  // discrete progress based on active index
  const maxScroll = timelineData.length;
  const progress = ((closestIndex + 1) / maxScroll) * 100;
  setScrollProgress(progress);`,
    },

    {
      title: "UI Pattern: Starter chooser gating game board interaction",
      lang: "tsx",
      from: "Tic Tac Toe Web",
      why: "A small UX move that prevents weird states: you choose the starter first, then the board becomes interactive.",
      code: `{starter === null && (
    <div className="w-full rounded-2xl bg-gray-100 dark:bg-gray-800 ring-1 ring-black/10 dark:ring-white/10 p-5">
      <div className="mb-3 font-semibold text-gray-800 dark:text-gray-100">
        Who starts first?
      </div>

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
    title: "Dotfiles: VS Code config migration (move + symlink, version-aware)",
    lang: "bash",
    from: "sys_managed dotfiles migration",
    why: "Shows idempotent migration + versioned config layout + logging. This is the kind of ops hygiene recruiters love.",
    code: `#!/bin/bash
  set -euo pipefail

  SCRIPT_NAME="$(basename "$0")"
  LOG_DIR="$HOME/sys_managed/logs/script_logs/dotfiles_migration_logs/ide_dotfiles_migration_logs"
  LOG_FILE="$LOG_DIR/\${SCRIPT_NAME%.sh}.log"
  VSCODE_BASE="$HOME/sys_managed/etc/config/ide/vscode"

  mkdir -p "$VSCODE_BASE" "$LOG_DIR"

  {
    echo "🕒 $(date) — Starting VSCode dotfile migration"

    VSCODE_VERSION=$(code --version 2>/dev/null | head -n1)
    if [[ -z "$VSCODE_VERSION" ]]; then
      echo "⚠️ VSCode not found. Skipping migration."
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
        echo "📦 Moving $src → $dest"
        mv "$src" "$dest"
        ln -s "$dest" "$src"
        echo "🔗 Symlink: $src → $dest"
      elif [[ -L "$src" ]]; then
        echo "🔁 Already symlinked: $src"
      else
        echo "❓ Not found: $file"
      fi
    done

    echo "✅ Migration complete."
  } | tee "$LOG_FILE"`,
  },

  {
    title: "Healthcheck: Dotfiles drift detection (diff source-of-truth vs live system)",
    lang: "bash",
    from: "sys_managed healthcheck",
    why: "This is high-signal: systematic config drift detection with diffs + structured output.",
    code: `#!/bin/zsh
  healthcheck_dotfiles() {
    local LOG_DIR="$HOME/sys_managed/logs/healthcheck_logs/dir_file_status_logs"
    mkdir -p "$LOG_DIR"
    local TIMESTAMP=$(date "+%Y-%m-%d_%H-%M-%S")
    local LOG_FILE="$LOG_DIR/health_dir_files_$TIMESTAMP.log"

    {
      echo "🔍 Dotfile Health Check — $(date)"
      echo "-------------------------------------"

      # Compare a single-file template ⇆ runtime file
      if [[ -f "$HOME/.zshrc" && -f "$HOME/dotfiles/.zshrc.template" ]]; then
        if diff -q "$HOME/.zshrc" "$HOME/dotfiles/.zshrc.template" &>/dev/null; then
          echo "✅ Match: ~/.zshrc"
        else
          echo "❌ Difference: ~/.zshrc"
        fi
      fi

      # Recursively compare requirements trees (example pattern)
      if [[ -d "$HOME/dotfiles/requirements" && -d "$HOME/sys_managed/requirements" ]]; then
        while IFS= read -r -d '' file; do
          rel_path="\${file#$HOME/dotfiles/requirements/}"
          sys_file="$HOME/sys_managed/requirements/$rel_path"
          if [[ -e "$sys_file" ]]; then
            diff -q "$file" "$sys_file" &>/dev/null && \
              echo "✅ Match: $rel_path" || echo "❌ Difference: $rel_path"
          else
            echo "❌ Main missing: $rel_path"
          fi
        done < <(find "$HOME/dotfiles/requirements" -type f -print0)
      fi
    } | tee "$LOG_FILE"
  }`,
  },

  {
    title: "Git Hook: Pre-push asset sync + CloudFront invalidation (deploy hygiene)",
    lang: "bash",
    from: "Battleship asset pipeline",
    why: "Proves you think about real delivery: caching, sync correctness, and CDN invalidation tied to dev workflow.",
    code: `#!/usr/bin/env bash
  set -euo pipefail

  BUCKET="\${BUCKET:-<your-bucket>}"
  CF_DIST="\${CF_DIST:-<your-distribution>}"
  AWS_REGION="\${AWS_REGION:-us-east-1}"
  AWS_PROFILE="\${AWS_PROFILE:-<your-sso-profile>}"

  # Skip in CI or on demand
  if [[ "\${SKIP_ASSET_SYNC:-0}" == "1" || "\${CI:-}" == "true" ]]; then
    echo "[pre-push] Skipping asset sync."
    exit 0
  fi

  echo "[pre-push] Sync sprites to s3://\${BUCKET}/ships/sprites/"
  aws s3 sync src/assets/ships/sprites "s3://\${BUCKET}/ships/sprites/" \\
    --exclude "*/top/*" \\
    --cache-control "public,max-age=86400" \\
    --delete

  echo "[pre-push] Invalidate CloudFront"
  aws cloudfront create-invalidation \\
    --distribution-id "\${CF_DIST}" \\
    --paths "/ships/sprites/*" "/ships/glb/*" >/dev/null

  echo "[pre-push] Done."`,
  },
  {
    title: "Bash: Asset sync to S3 (env-driven, idempotent, safe defaults)",
    lang: "bash",
    from: "Battleship assets / sync-assets.sh",
    why: "Production-ish scripting: strict mode, env injection, AWS auth check, and quiet output (great for CI).",
    code: `#!/usr/bin/env bash
set -euo pipefail

[ -f .env.local ] && set -a && . ./.env.local && set +a

ASSETS_DIR="\${ASSETS_DIR:-src/assets/ships/sprites}"
BUCKET="\${ASSETS_BUCKET:?ASSETS_BUCKET not set (put it in .env.local)}"
PREFIX="\${ASSETS_PREFIX:-ships/sprites/}"
REGION="\${AWS_REGION:-us-east-1}"
PROFILE="\${AWS_PROFILE:-}"

export AWS_SDK_LOAD_CONFIG=1

ensure_aws_session() {
  aws sts get-caller-identity >/dev/null 2>&1 && return 0
  echo "[sync:assets] ERROR: Not authenticated to AWS." >&2
  return 1
}

ensure_aws_session
aws s3 sync "$ASSETS_DIR" "s3://$BUCKET/$PREFIX" --region "$REGION" \\
  \${PROFILE:+--profile "$PROFILE"} --only-show-errors`,
  },
  {
    title: "Bash: CloudFront invalidation (CDN cache bust after deploy)",
    lang: "bash",
    from: "Battleship CDN / cdn-invalidate.sh",
    why: "Deployment hygiene: invalidate only the required path pattern and keep auth/region behavior explicit.",
    code: `#!/usr/bin/env bash
set -euo pipefail

[ -f .env.local ] && set -a && . ./.env.local && set +a

DISTRIBUTION_ID="\${CDN_DISTRIBUTION_ID:?CDN_DISTRIBUTION_ID not set in .env.local}"
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
  ];

  // -----------------------------
  // Collapsible state
  // -----------------------------
  const [open, setOpen] = React.useState(() => snippets.map(() => false));
  const anchorsRef = React.useRef([]);

  const toggle = (idx) => {
    setOpen((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = anchorsRef.current[idx];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  };

  // -----------------------------
  // CodeBlock
  // - SAME code style for light + dark (vscDarkPlus)
  // - Unified background color
  // - No extra shine, no nested card feel
  // -----------------------------
  function CodeBlock({ code, lang }) {
    return (
      <div className="rounded-2xl overflow-hidden bg-gray-50 dark:bg-[#0f1320]">
        <SyntaxHighlighter
          language={lang}
          style={darkMode ? vscDarkPlus : oneLight} 
          showLineNumbers
          wrapLongLines
          customStyle={{
            margin: 0,
            background: "transparent", // ✅ let wrapper control bg
            padding: "16px",
            fontSize: "14px",
            lineHeight: "1.65",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }

  function SnippetCard({ snippet, idx }) {
    const isOpen = open[idx];
    const { title, code, lang, why, from } = snippet;

    return (
      <article className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-[#1f2230] shadow-lg overflow-hidden">
        {/* Header */}
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
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              From:
            </span>{" "}
            {from}
          </div>

          <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {why}
          </div>
        </div>

        {/* Collapsible body */}
        <div className="relative">
          {!isOpen && (
            <div className="relative">
              <div className="px-4 py-3 max-h-24 overflow-hidden">
                <CodeBlock code={code} lang={lang} />
              </div>

              {/* Fade overlay */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white dark:from-[#1f2230] to-transparent" />

              {/* View control */}
              <div className="absolute inset-x-0 bottom-2 flex justify-center">
                <button
                  ref={(el) => (anchorsRef.current[idx] = el)}
                  type="button"
                  onClick={() => toggle(idx)}
                  className="
                    inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full
                    bg-white/90 dark:bg-white/10
                    border border-gray-200 dark:border-gray-700
                    text-gray-800 dark:text-gray-200
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

          {isOpen && (
            <div className="px-4 py-4">
              <CodeBlock code={code} lang={lang} />

              <div className="mt-4 flex justify-center">
                <button
                  ref={(el) => (anchorsRef.current[idx] = el)}
                  type="button"
                  onClick={() => toggle(idx)}
                  className="
                    inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full
                    bg-white/90 dark:bg-white/10
                    border border-gray-200 dark:border-gray-700
                    text-gray-800 dark:text-gray-200
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
      </article>
    );
  }

  return (
    <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      <div className="px-6 max-w-6xl mx-auto">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
            <FaCode className="text-3xl" />
            Code Lab
          </h2>

          <p className="mt-5 text-gray-600 dark:text-gray-400 max-w-3xl">
            A curated set of small, production-minded snippets that reflect how I build:
            secure access, deterministic ingestion, reusable transforms, and consistent writes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {snippets.map((snip, i) => (
            <SnippetCard key={`${snip.title}-${i}`} snippet={snip} idx={i} />
          ))}
        </div>
      </div>
    </section>
  );
}