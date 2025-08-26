#!/usr/bin/env bash
# Smart matcher for texture .rar archives -> ship directories
# Compatible with macOS Bash 3.2 (no associative arrays / mapfile)

set -euo pipefail

# --- config ---
RAW_DIR="src/assets/ships/raw"   # repo-relative
DRY_ACTION="${1:-dry}"           # "dry" (default) or "apply"

# --- deps check ---
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
need lsar
need unar
need awk
need sed
need tr
need find
need wc
need sort
need comm
need mkdir
need mv
need rmdir
need rm

# --- resolve repo root and absolute paths ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RAW_PATH="$REPO_ROOT/$RAW_DIR"

if [ ! -d "$RAW_PATH" ]; then
  echo "Not found: $RAW_PATH" >&2
  exit 1
fi

# Normalize a filename to a comparable token:
#  - basename, no dir
#  - lowercase, strip extension
#  - drop UDIM-like suffixes (.1001 / _1001)
#  - collapse non-alnum -> single dash
#  - drop common PBR suffixes to improve matching
norm_one() {
  local s="$1"
  s="${s##*/}"                               # basename
  s="${s%.*}"                                # rm extension
  s="$(printf '%s' "$s" | tr '[:upper:]' '[:lower:]')"
  s="$(printf '%s' "$s" | sed -E 's/(\.|\_)?(1[0-9]{3}|[0-9]{4})$//')"
  s="$(printf '%s' "$s" | sed -E 's/(basecolor|base_color|albedo|color|metallic|roughness|normal)$//')"
  s="$(printf '%s' "$s" | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
  printf '%s\n' "$s"
}

# Build a sorted unique normalized list from a file of names
norm_list_file() {
  # stdin: raw names (one per line)
  # stdout: normalized, sorted unique
  awk 'NF>0' \
  | while IFS= read -r line; do norm_one "$line"; done \
  | sort -u
}

# Extract all texture map names from an MTL (basenames)
mtl_expected_list() {
  local mtl="$1"
  awk 'tolower($1) ~ /^map_/ {print $2}' "$mtl" 2>/dev/null \
    | sed -E 's|.*/||' \
    | awk 'NF>0' \
    | sort -u
}

# List files inside a .rar (basenames)
rar_list_files() {
  local rar="$1"
  # only lines that start with "  n." where n is a number; print last field (Name)
  lsar -l "$rar" 2>/dev/null \
    | awk '/^[[:space:]]*[0-9]+\./ {print $NF}' \
    | sed -E 's|.*/||' \
    | sort -u
}

# Count intersection size between 2 sorted unique lists
count_intersection() {
  local a="$1" b="$2"
  comm -12 "$a" "$b" | wc -l | tr -d '[:space:]'
}

# Score a candidate rar for a ship:
#   primary: name overlap (normalized) with MTL expected names
#   bonus: rar in same directory as ship (same_dir=1)
#   bonus: ship name substring appears in rar path (name_hit=1)
#   tiebreak: number of entries in rar
# returns a composite integer score we can compare
score_rar_for_ship() {
  local ship="$1" shipdir="$2" rar="$3" tmpdir="$4" mtl_norm="$5"

  # normalized names from rar
  local rar_raw="$tmpdir/rar_raw.txt"
  local rar_norm="$tmpdir/rar_norm.txt"
  rar_list_files "$rar" > "$rar_raw" || true
  cat "$rar_raw" | norm_list_file > "$rar_norm" || true

  local overlap
  overlap=$(count_intersection "$mtl_norm" "$rar_norm")

  local same_dir=0
  if [ "$(cd "$(dirname "$rar")"; pwd)" = "$shipdir" ]; then same_dir=1; fi

  local name_hit=0
  case "$(printf '%s' "$rar" | tr '[:upper:]' '[:lower:]')" in
    *"$ship"*) name_hit=1 ;;
  esac

  local entries
  entries=$(wc -l < "$rar_raw" | tr -d '[:space:]')
  [ -z "$entries" ] && entries=0

  # composite score (keep simple integers for Bash 3.2)
  # overlap has the most weight
  echo $(( overlap * 10000 + same_dir * 1000 + name_hit * 100 + entries ))
}

# Extract + flatten textures to <shipdir>/textures
extract_textures() {
  local rar="$1" shipdir="$2"
  local out="$shipdir/textures"
  mkdir -p "$out"
  unar -o "$out" "$rar" >/dev/null

  # If we got textures/textures nesting, flatten
  if [ -d "$out/textures" ]; then
    mv "$out/textures/"* "$out/" 2>/dev/null || true
    rmdir "$out/textures" 2>/dev/null || true
  fi

  # If we got a single top-level folder, flatten it
  # (common when archives wrap everything in one folder)
  if [ "$(find "$out" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" = "1" ]; then
    local onlydir
    onlydir="$(find "$out" -mindepth 1 -maxdepth 1 -type d | head -n1)"
    if [ -n "$onlydir" ]; then
      mv "$onlydir/"* "$out/" 2>/dev/null || true
      rmdir "$onlydir" 2>/dev/null || true
    fi
  fi
}

echo "Mode: ${DRY_ACTION} (use 'apply' to actually extract & rename)"
echo "Scanning ships under: $RAW_PATH"
echo

# Precompute global rar list
TMP_GLOBAL="$(mktemp -d)"
trap 'rm -rf "$TMP_GLOBAL"' EXIT

find "$RAW_PATH" -type f \( -iname "*textures*.rar" -o -iname "*.rar" \) | sort > "$TMP_GLOBAL/all_rars.txt"

if [ ! -s "$TMP_GLOBAL/all_rars.txt" ]; then
  echo "No .rar files found under $RAW_PATH" >&2
  exit 1
fi

# Process each ship folder
find "$RAW_PATH" -mindepth 1 -maxdepth 1 -type d | sort | while IFS= read -r SHIPDIR; do
  SHIP="$(basename "$SHIPDIR" | tr '[:upper:]' '[:lower:]')"

  MTL="$(ls "$SHIPDIR"/*.mtl 2>/dev/null | head -n1 || true)"
  if [ -z "$MTL" ]; then
    echo "⏭  $SHIP: no .mtl found — skipping scoring (will prefer local rar if any)."
  fi

  # Build normalized expected list from MTL (even if empty)
  TMP_SHIP="$(mktemp -d)"
  MTL_RAW="$TMP_SHIP/mtl_raw.txt"
  MTL_NORM="$TMP_SHIP/mtl_norm.txt"
  if [ -n "$MTL" ]; then
    mtl_expected_list "$MTL" > "$MTL_RAW" || true
  else
    : > "$MTL_RAW"
  fi
  cat "$MTL_RAW" | norm_list_file > "$MTL_NORM" || true

  BEST_RAR=""
  BEST_SCORE=-1

  while IFS= read -r RAR; do
    # Quick filter: keep ones with "texture" in name OR in same ship folder
    case "$(basename "$RAR" | tr '[:upper:]' '[:lower:]')" in
      *texture*|*textures*) : ;;
      *) if [ "$(cd "$(dirname "$RAR")"; pwd)" != "$SHIPDIR" ]; then continue; fi ;;
    esac

    S=$(score_rar_for_ship "$SHIP" "$SHIPDIR" "$RAR" "$TMP_SHIP" "$MTL_NORM")
    if [ "$S" -gt "$BEST_SCORE" ]; then
      BEST_SCORE="$S"
      BEST_RAR="$RAR"
    fi
  done < "$TMP_GLOBAL/all_rars.txt"

  if [ -z "$BEST_RAR" ]; then
    echo "⚠️  $SHIP: no candidate .rar found."
    rm -rf "$TMP_SHIP"
    continue
  fi

  if [ "$DRY_ACTION" != "apply" ]; then
    echo "→ $SHIP  would use: $(basename "$BEST_RAR")"
  else
    echo "✔ $SHIP  using: $(basename "$BEST_RAR")"
    extract_textures "$BEST_RAR" "$SHIPDIR"
    # rename archive to remember mapping
    NEWNAME="$SHIPDIR/${SHIP}-textures.rar"
    if [ "$(cd "$(dirname "$BEST_RAR")"; pwd)" != "$SHIPDIR" ]; then
      mv "$BEST_RAR" "$NEWNAME"
    else
      mv "$BEST_RAR" "$NEWNAME" 2>/dev/null || true
    fi
  fi

  rm -rf "$TMP_SHIP"
done

echo
[ "$DRY_ACTION" != "apply" ] && echo "Dry-run finished. Re-run with:  ./scripts/ship-texture-match.sh apply"
