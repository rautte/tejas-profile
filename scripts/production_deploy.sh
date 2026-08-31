#!/usr/bin/env bash
# scripts/production_deploy.sh

set -euo pipefail

# ============================================================
# PRODUCTION DEPLOY ORCHESTRATOR
#
# Preferred shell alias:
#
#   npm_pd
#
# Default behavior:
#
#   1. validates exact checkpoint source
#   2. requires exact CI success
#   3. requires exact automatic DEV deployment success
#   4. captures authoritative PROD control-plane state
#   5. dispatches PROD infrastructure deployment
#   6. proves infra did not mutate formal Platform/Profile state
#   7. dispatches exact-SHA PROD frontend / Platform promotion
#   8. verifies the resulting formal PROD Platform Deployment
#   9. verifies Profile activation state did not change
#  10. prints a compact production release receipt
#
# Important architecture boundary:
#
#   This script DOES NOT publish or activate Profile content.
#   Profile publication/configuration/activation remains an explicit
#   control-plane operation separate from software deployment.
# ============================================================

SCRIPT_NAME="production_deploy"

REPO_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.." &&
    pwd
)"

STATE_ROOT="${XDG_STATE_HOME:-${HOME}/.local/state}/tejas-profile/${SCRIPT_NAME}"
LOG_DIR="${STATE_ROOT}/logs"

mkdir -p "${LOG_DIR}"

RUN_TS="$(date +%Y-%m-%d_%H-%M-%S)"
LOG_FILE="${LOG_DIR}/${SCRIPT_NAME}_${RUN_TS}.log"
LATEST_LOG="${LOG_DIR}/${SCRIPT_NAME}_latest.log"

if compgen -G "${LOG_DIR}/${SCRIPT_NAME}_"'*.log' >/dev/null; then
  OLD_LOGS="$(
    ls -1t "${LOG_DIR}/${SCRIPT_NAME}_"*.log 2>/dev/null |
      grep -vF "${LATEST_LOG}" ||
      true
  )"

  if [[ -n "${OLD_LOGS}" ]]; then
    printf '%s\n' "${OLD_LOGS}" |
      tail -n +31 |
      while IFS= read -r file; do
        [[ -n "${file}" ]] && rm -f "${file}"
      done
  fi
fi

# Keep latest.log truly latest rather than cumulative.
: > "${LATEST_LOG}"

exec > >(tee -a "${LOG_FILE}" "${LATEST_LOG}") 2>&1

# ============================================================
# HELPERS
# ============================================================

die() {
  echo "❌ $*" >&2
  exit 1
}

info() {
  echo "ℹ️  $*"
}

ok() {
  echo "✅ $*"
}

warn() {
  echo "⚠️  $*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 ||
    die "Missing required command: $1"
}

usage() {
  cat <<'USAGE'
Usage:
  npm_pd
  npm_pd --dry-run
  npm_pd --infra-only
  npm_pd --frontend-only
  npm_pd --redeploy --sha <40-char-sha> [--reason <text>]

Options:
  --dry-run         Validate everything but dispatch no PROD workflow.
  --infra-only      Run only the PROD infrastructure workflow.
  --frontend-only   Run only the PROD frontend / Platform promotion workflow.
  --redeploy        Run the explicit owner redeploy workflow. Requires --sha.
  --sha <sha>       Exact 40-character commit SHA. Defaults to current HEAD.
  --reason <text>   Optional redeploy reason.
  -h, --help        Show this help.
USAGE
}

normalize_json_file() {
  local file="$1"

  if [[ ! -s "${file}" ]]; then
    printf '{}\n' > "${file}"
  fi

  jq -e . "${file}" >/dev/null ||
    die "Invalid JSON: ${file}"
}

read_active_pointer() {
  local table="$1"
  local file="$2"

  aws dynamodb get-item \
    --table-name "${table}" \
    --key '{"pk":{"S":"CONTROL"},"sk":{"S":"ACTIVE"}}' \
    --consistent-read \
    --region "${AWS_REGION}" \
    --output json \
    > "${file}"

  normalize_json_file "${file}"
}

json_item_or_null() {
  local file="$1"
  jq -S -c '.Item // null' "${file}"
}

resolve_stack_resource() {
  local stack_file="$1"
  local resource_type="$2"
  local logical_fragment="$3"

  jq -r \
    --arg type "${resource_type}" \
    --arg fragment "${logical_fragment}" \
    '
      .StackResourceSummaries[]
      | select(
          .ResourceType == $type
          and
          (.LogicalResourceId | contains($fragment))
        )
      | .PhysicalResourceId
    ' \
    "${stack_file}" |
    head -n 1
}

latest_exact_run_json() {
  local workflow_name="$1"
  local event="$2"
  local sha="$3"

  gh run list \
    --limit 100 \
    --json databaseId,workflowName,event,headSha,status,conclusion,createdAt \
    --jq \
      "[.[] |
        select(
          .workflowName == \"${workflow_name}\"
          and
          .event == \"${event}\"
          and
          .headSha == \"${sha}\"
        )][0] // empty"
}

require_latest_exact_success() {
  local label="$1"
  local workflow="$2"
  local event="$3"
  local sha="$4"

  local run_json
  run_json="$(latest_exact_run_json "${workflow}" "${event}" "${sha}")"

  [[ -n "${run_json}" ]] ||
    die "No ${label} run found for exact SHA ${sha}."

  local run_id
  local status
  local conclusion

  run_id="$(jq -r '.databaseId' <<< "${run_json}")"
  status="$(jq -r '.status' <<< "${run_json}")"
  conclusion="$(jq -r '.conclusion // empty' <<< "${run_json}")"

  echo "${label}_RUN_ID=${run_id}"
  echo "${label}_STATUS=${status}"
  echo "${label}_CONCLUSION=${conclusion}"

  [[ "${status}" == "completed" ]] ||
    die "Latest exact ${label} run is not completed."

  [[ "${conclusion}" == "success" ]] ||
    die "Latest exact ${label} run is not successful."

  ok "${label} is GREEN for exact SHA."
}

capture_workflow_ids() {
  local workflow="$1"
  local file="$2"

  gh run list \
    --workflow "${workflow}" \
    --limit 100 \
    --json databaseId \
    --jq '.[].databaseId' \
    > "${file}"
}

LAST_RUN_ID=""

dispatch_and_watch() {
  local workflow="$1"
  local expected_head_sha="$2"
  shift 2

  local before_file
  before_file="$(mktemp)"

  capture_workflow_ids \
    "${workflow}" \
    "${before_file}"

  gh workflow run \
    "${workflow}" \
    --ref main \
    "$@"

  local run_id=""

  for _ in $(seq 1 90); do
    while IFS= read -r id; do
      [[ -n "${id}" ]] || continue

      if ! grep -Fx "${id}" "${before_file}" >/dev/null 2>&1; then
        run_id="${id}"
        break
      fi
    done < <(
      gh run list \
        --workflow "${workflow}" \
        --limit 50 \
        --json databaseId,event,headSha,createdAt \
        --jq \
          ".[] |
           select(
             .event == \"workflow_dispatch\"
             and
             .headSha == \"${expected_head_sha}\"
           ) |
           .databaseId"
    )

    [[ -n "${run_id}" ]] && break

    sleep 2
  done

  rm -f "${before_file}"

  [[ -n "${run_id}" ]] ||
    die "Unable to resolve newly dispatched ${workflow} run."

  LAST_RUN_ID="${run_id}"

  echo "WORKFLOW=${workflow}"
  echo "RUN_ID=${run_id}"

  gh run view \
    "${run_id}" \
    --json databaseId,workflowName,event,headSha,status,conclusion

  if ! gh run watch "${run_id}" --exit-status; then
    echo ""
    echo "===== FAILED WORKFLOW EVIDENCE ====="

    gh run view \
      "${run_id}" \
      --log-failed ||
      true

    die "${workflow} failed. Do not blindly rerun; inspect live PROD state first."
  fi

  local conclusion
  conclusion="$(
    gh run view \
      "${run_id}" \
      --json conclusion \
      --jq '.conclusion'
  )"

  [[ "${conclusion}" == "success" ]] ||
    die "${workflow} conclusion=${conclusion}"

  ok "${workflow} completed successfully."
}

resolve_remote_checkpoint_tag() {
  local sha="$1"
  local tag=""

  tag="$(
    git tag \
      --points-at "${sha}" \
      --list 'checkpoint-*' \
      --sort=-creatordate |
      head -n 1
  )"

  [[ -n "${tag}" ]] ||
    die "No immutable checkpoint tag points to ${sha}."

  local remote_peeled
  local remote_direct

  remote_peeled="$(
    git ls-remote \
      origin \
      "refs/tags/${tag}^{}" |
      awk '{print $1}' |
      head -n 1
  )"

  remote_direct="$(
    git ls-remote \
      origin \
      "refs/tags/${tag}" |
      awk '{print $1}' |
      head -n 1
  )"

  if [[ "${remote_peeled}" == "${sha}" ||
        "${remote_direct}" == "${sha}" ]]; then
    printf '%s\n' "${tag}"
    return 0
  fi

  die "Checkpoint tag ${tag} is not published remotely for exact SHA ${sha}."
}

confirm_mutation() {
  local required="$1"

  if [[ "${DRY_RUN}" == "true" ]]; then
    return 0
  fi

  [[ -t 0 ]] ||
    die "Interactive confirmation required. Re-run from an interactive terminal."

  echo ""
  echo "Production mutation is ready."
  echo "Type exactly: ${required}"
  echo ""

  local answer=""
  read -r -p "> " answer

  [[ "${answer}" == "${required}" ]] ||
    die "Production confirmation did not match."
}

trap '
  rc=$?
  echo ""
  if [[ ${rc} -eq 0 ]]; then
    echo "✅ RESULT: SUCCESS"
  else
    echo "❌ RESULT: FAILED (exit=${rc})"
  fi
  echo "ℹ️  Log: ${LOG_FILE}"
' EXIT

# ============================================================
# ARGUMENTS
# ============================================================

MODE="full"
DRY_RUN="false"
TARGET_SHA=""
TARGET_SHA_EXPLICIT="false"
REASON="owner redeploy"
MODE_SET="false"

set_mode() {
  local requested="$1"

  if [[ "${MODE_SET}" == "true" && "${MODE}" != "${requested}" ]]; then
    die "Choose only one deployment mode."
  fi

  MODE="${requested}"
  MODE_SET="true"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN="true"
      shift
      ;;

    --infra-only)
      set_mode "infra-only"
      shift
      ;;

    --frontend-only)
      set_mode "frontend-only"
      shift
      ;;

    --redeploy)
      set_mode "redeploy"
      shift
      ;;

    --sha)
      [[ $# -ge 2 ]] || die "--sha requires a value."
      TARGET_SHA="$2"
      TARGET_SHA_EXPLICIT="true"
      shift 2
      ;;

    --reason)
      [[ $# -ge 2 ]] || die "--reason requires a value."
      REASON="$2"
      shift 2
      ;;

    -h|--help)
      usage
      exit 0
      ;;

    *)
      die "Unknown argument: $1"
      ;;
  esac
done

# ============================================================
# CONTEXT + PRECONDITIONS
# ============================================================

cd "${REPO_ROOT}"

require_cmd git
require_cmd gh
require_cmd jq
require_cmd aws
require_cmd curl

AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
EXPECTED_AWS_ACCOUNT="978416150779"
PROD_STACK="TejasProfileSnapshotsStackProd"
INFRA_WORKFLOW="infra-deploy.yml"
PROMOTE_WORKFLOW="deploy.yml"
REDEPLOY_WORKFLOW="redeploy.yml"
CI_WORKFLOW_NAME="CI Quality Gate"
DEV_WORKFLOW_NAME="Deploy Infra (CDK)"

info "Log file: ${LOG_FILE}"
info "Repo: ${REPO_ROOT}"
info "Mode: ${MODE}"
info "Dry run: ${DRY_RUN}"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  die "Not inside a Git repository."

CURRENT_BRANCH="$(git branch --show-current)"
[[ "${CURRENT_BRANCH}" == "main" ]] ||
  die "Current branch must be main."

DIRTY="$(git status --porcelain --untracked-files=all)"
[[ -z "${DIRTY}" ]] || {
  echo "${DIRTY}"
  die "Working tree must be completely clean before PROD promotion."
}

git remote get-url origin >/dev/null 2>&1 ||
  die "Remote origin is missing."

info "Refreshing origin/main and checkpoint tags..."

git fetch \
  origin \
  main:refs/remotes/origin/main \
  --tags \
  --force

HEAD_SHA="$(git rev-parse HEAD)"
ORIGIN_MAIN_SHA="$(git rev-parse origin/main)"

if [[ -z "${TARGET_SHA}" ]]; then
  TARGET_SHA="${HEAD_SHA}"
fi

[[ "${TARGET_SHA}" =~ ^[0-9a-fA-F]{40}$ ]] ||
  die "Target SHA must be an exact 40-character commit SHA."

TARGET_SHA="$(git rev-parse "${TARGET_SHA}^{commit}")"

git merge-base --is-ancestor "${TARGET_SHA}" origin/main ||
  die "Target SHA is not contained in origin/main."

[[ "${HEAD_SHA}" == "${ORIGIN_MAIN_SHA}" ]] ||
  die "Local main must equal origin/main before any PROD operation."

if [[ "${MODE}" != "redeploy" ]]; then
  [[ "${TARGET_SHA}" == "${HEAD_SHA}" ]] ||
    die "For normal PROD promotion, target SHA must equal current HEAD. Use --redeploy for an older release."
else
  [[ "${TARGET_SHA_EXPLICIT}" == "true" ]] ||
    die "--redeploy requires an explicit --sha <40-char-sha>."
fi

CHECKPOINT_TAG="$(resolve_remote_checkpoint_tag "${TARGET_SHA}")"

ok "Exact source validated."
echo "TARGET_SHA=${TARGET_SHA}"
echo "CHECKPOINT_TAG=${CHECKPOINT_TAG}"

# ============================================================
# AWS + GITHUB IDENTITY
# ============================================================

info "Validating GitHub and AWS access..."

gh auth status >/dev/null 2>&1 ||
  die "GitHub CLI authentication is unavailable."

AWS_ACCOUNT="$(
  aws sts get-caller-identity \
    --query Account \
    --output text
)"

[[ "${AWS_ACCOUNT}" == "${EXPECTED_AWS_ACCOUNT}" ]] ||
  die "AWS account mismatch. Expected ${EXPECTED_AWS_ACCOUNT}, got ${AWS_ACCOUNT}."

ok "GitHub and AWS identities validated."

# ============================================================
# PROMOTION ELIGIBILITY
# ============================================================

info "Verifying exact CI gate..."
require_latest_exact_success \
  "CI" \
  "${CI_WORKFLOW_NAME}" \
  "push" \
  "${TARGET_SHA}"

info "Verifying exact automatic DEV deployment..."
require_latest_exact_success \
  "DEV_DEPLOY" \
  "${DEV_WORKFLOW_NAME}" \
  "workflow_run" \
  "${TARGET_SHA}"

# ============================================================
# PROD RESOURCE DISCOVERY
# ============================================================

STACK_FILE="$(mktemp)"

aws cloudformation list-stack-resources \
  --stack-name "${PROD_STACK}" \
  --region "${AWS_REGION}" \
  --output json \
  > "${STACK_FILE}"

PLATFORM_TABLE="$(
  resolve_stack_resource \
    "${STACK_FILE}" \
    "AWS::DynamoDB::Table" \
    "PlatformDeploymentTable"
)"

PROFILE_TABLE="$(
  resolve_stack_resource \
    "${STACK_FILE}" \
    "AWS::DynamoDB::Table" \
    "ProfileActivationTable"
)"

USAGE_TABLE="$(
  resolve_stack_resource \
    "${STACK_FILE}" \
    "AWS::DynamoDB::Table" \
    "UsageEpochsTable"
)"

rm -f "${STACK_FILE}"

[[ -n "${PLATFORM_TABLE}" ]] || die "Unable to resolve PROD Platform table."
[[ -n "${PROFILE_TABLE}" ]] || die "Unable to resolve PROD Profile table."
[[ -n "${USAGE_TABLE}" ]] || die "Unable to resolve PROD Usage Epoch table."

PROD_API="$(
  aws cloudformation describe-stacks \
    --stack-name "${PROD_STACK}" \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='ActiveProfileApiUrl'].OutputValue | [0]" \
    --output text
)"

[[ -n "${PROD_API}" && "${PROD_API}" != "None" ]] ||
  die "Unable to resolve PROD Active Profile API URL."

# ============================================================
# PROD PRE-STATE
# ============================================================

PRE_PLATFORM="$(mktemp)"
PRE_PROFILE="$(mktemp)"
PRE_USAGE="$(mktemp)"
PRE_PUBLIC="$(mktemp)"

read_active_pointer "${PLATFORM_TABLE}" "${PRE_PLATFORM}"
read_active_pointer "${PROFILE_TABLE}" "${PRE_PROFILE}"
read_active_pointer "${USAGE_TABLE}" "${PRE_USAGE}"

PRE_PLATFORM_CANON="$(json_item_or_null "${PRE_PLATFORM}")"
PRE_PROFILE_CANON="$(json_item_or_null "${PRE_PROFILE}")"
PRE_USAGE_CANON="$(json_item_or_null "${PRE_USAGE}")"

PRE_PLATFORM_REVISION="$(jq -r '.Item.revision.N // "0"' "${PRE_PLATFORM}")"
PRE_PLATFORM_RELEASE_ID="$(jq -r '.Item.platformReleaseId.S // empty' "${PRE_PLATFORM}")"
PRE_PLATFORM_DEPLOYMENT_ID="$(jq -r '.Item.deploymentId.S // empty' "${PRE_PLATFORM}")"

PRE_PROFILE_REVISION="$(jq -r '.Item.revision.N // "0"' "${PRE_PROFILE}")"
PRE_PROFILE_VARIANT_ID="$(jq -r '.Item.profileVariantId.S // empty' "${PRE_PROFILE}")"
PRE_PROFILE_ACTIVATION_ID="$(jq -r '.Item.activationId.S // empty' "${PRE_PROFILE}")"

PRE_USAGE_REVISION="$(jq -r '.Item.revision.N // "0"' "${PRE_USAGE}")"
PRE_USAGE_EPOCH_ID="$(jq -r '.Item.usageEpochId.S // empty' "${PRE_USAGE}")"

PRE_HTTP="$(
  curl \
    --silent \
    --show-error \
    --output "${PRE_PUBLIC}" \
    --write-out '%{http_code}' \
    "${PROD_API}"
)"

[[ "${PRE_HTTP}" == "200" ]] ||
  die "PROD Active Profile API is unhealthy before deployment (HTTP ${PRE_HTTP})."

jq -e '.ok == true' "${PRE_PUBLIC}" >/dev/null ||
  die "PROD Active Profile API did not return ok=true."

PUBLIC_PRE_PROFILE_VARIANT_ID="$(jq -r '.active.profileVariantId // empty' "${PRE_PUBLIC}")"
PUBLIC_PRE_PLATFORM_RELEASE_ID="$(jq -r '.deployment.platformReleaseId // empty' "${PRE_PUBLIC}")"

[[ "${PUBLIC_PRE_PROFILE_VARIANT_ID}" == "${PRE_PROFILE_VARIANT_ID}" ]] ||
  die "Public PROD Profile identity does not match authoritative Profile pointer."

if [[ -n "${PRE_PROFILE_VARIANT_ID}" ]]; then
  [[ "${PUBLIC_PRE_PLATFORM_RELEASE_ID}" == "${PRE_PLATFORM_RELEASE_ID}" ]] ||
    die "Public PROD Platform identity does not match authoritative Platform pointer."
fi

ok "Authoritative PROD pre-state captured."
echo "PRE_PLATFORM_REVISION=${PRE_PLATFORM_REVISION}"
echo "PRE_PLATFORM_RELEASE_ID=${PRE_PLATFORM_RELEASE_ID:-<absent>}"
echo "PRE_PROFILE_REVISION=${PRE_PROFILE_REVISION}"
echo "PRE_PROFILE_VARIANT_ID=${PRE_PROFILE_VARIANT_ID:-<absent>}"
echo "PRE_USAGE_REVISION=${PRE_USAGE_REVISION}"
echo "PRE_USAGE_EPOCH_ID=${PRE_USAGE_EPOCH_ID:-<absent>}"

# ============================================================
# DRY RUN
# ============================================================

if [[ "${DRY_RUN}" == "true" ]]; then
  echo ""
  echo "============================================================"
  echo "PROD DRY RUN — GREEN"
  echo "============================================================"
  echo "Target SHA:       ${TARGET_SHA}"
  echo "Checkpoint:       ${CHECKPOINT_TAG}"
  echo "Mode:             ${MODE}"
  echo "CI:               GREEN"
  echo "DEV deploy:       GREEN"
  echo "PROD Platform:    ${PRE_PLATFORM_RELEASE_ID:-ABSENT}"
  echo "PROD Profile:     ${PRE_PROFILE_VARIANT_ID:-ABSENT}"
  echo ""

  case "${MODE}" in
    full)
      echo "Would dispatch: ${INFRA_WORKFLOW}"
      echo "Then dispatch:  ${PROMOTE_WORKFLOW}"
      ;;

    infra-only)
      echo "Would dispatch: ${INFRA_WORKFLOW}"
      ;;

    frontend-only)
      echo "Would dispatch: ${PROMOTE_WORKFLOW}"
      ;;

    redeploy)
      echo "Would dispatch: ${REDEPLOY_WORKFLOW}"
      ;;
  esac

  echo ""
  echo "NO PROD MUTATION PERFORMED"
  echo "============================================================"
  exit 0
fi

# ============================================================
# EXPLICIT CONFIRMATION
# ============================================================

case "${MODE}" in
  full|frontend-only)
    confirm_mutation "PROMOTE-PROD"
    ;;

  infra-only)
    confirm_mutation "DEPLOY-PROD-INFRA"
    ;;

  redeploy)
    confirm_mutation "REDEPLOY-PROD"
    ;;
esac

# ============================================================
# PROD INFRA
# ============================================================

INFRA_RUN_ID=""

if [[ "${MODE}" == "full" || "${MODE}" == "infra-only" ]]; then
  echo ""
  echo "============================================================"
  echo "PROD INFRASTRUCTURE"
  echo "============================================================"

  dispatch_and_watch \
    "${INFRA_WORKFLOW}" \
    "${HEAD_SHA}" \
    -f target=prod \
    -f confirm=DEPLOY-PROD-INFRA

  INFRA_RUN_ID="${LAST_RUN_ID}"

  POST_INFRA_PLATFORM="$(mktemp)"
  POST_INFRA_PROFILE="$(mktemp)"
  POST_INFRA_PUBLIC="$(mktemp)"

  read_active_pointer "${PLATFORM_TABLE}" "${POST_INFRA_PLATFORM}"
  read_active_pointer "${PROFILE_TABLE}" "${POST_INFRA_PROFILE}"

  POST_INFRA_PLATFORM_CANON="$(json_item_or_null "${POST_INFRA_PLATFORM}")"
  POST_INFRA_PROFILE_CANON="$(json_item_or_null "${POST_INFRA_PROFILE}")"

  [[ "${POST_INFRA_PLATFORM_CANON}" == "${PRE_PLATFORM_CANON}" ]] ||
    die "PROD infra deployment unexpectedly changed formal Platform ACTIVE state."

  [[ "${POST_INFRA_PROFILE_CANON}" == "${PRE_PROFILE_CANON}" ]] ||
    die "PROD infra deployment unexpectedly changed formal Profile ACTIVE state."

  POST_INFRA_HTTP="$(
    curl \
      --silent \
      --show-error \
      --output "${POST_INFRA_PUBLIC}" \
      --write-out '%{http_code}' \
      "${PROD_API}"
  )"

  [[ "${POST_INFRA_HTTP}" == "200" ]] ||
    die "PROD Active Profile API unhealthy after infra deployment."

  jq -e '.ok == true' "${POST_INFRA_PUBLIC}" >/dev/null ||
    die "PROD Active Profile API invalid after infra deployment."

  POST_INFRA_PROFILE_VARIANT_ID="$(jq -r '.active.profileVariantId // empty' "${POST_INFRA_PUBLIC}")"

  [[ "${POST_INFRA_PROFILE_VARIANT_ID}" == "${PRE_PROFILE_VARIANT_ID}" ]] ||
    die "PROD infra deployment changed effective Profile identity."

  ok "PROD infra workflow GREEN and formal state unchanged."

  if [[ "${MODE}" == "infra-only" ]]; then
    echo ""
    echo "============================================================"
    echo "PROD INFRA-ONLY — GREEN"
    echo "============================================================"
    echo "Target SHA:    ${TARGET_SHA}"
    echo "Checkpoint:    ${CHECKPOINT_TAG}"
    echo "Infra run:     ${INFRA_RUN_ID}"
    echo "Platform:      unchanged"
    echo "Profile:       unchanged"
    echo "Public API:    HTTP 200"
    echo "============================================================"
    exit 0
  fi
fi

# ============================================================
# PROD FRONTEND / PLATFORM PROMOTION OR REDEPLOY
# ============================================================

PROMOTION_RUN_ID=""

if [[ "${MODE}" == "full" || "${MODE}" == "frontend-only" ]]; then
  echo ""
  echo "============================================================"
  echo "PROD FRONTEND / FORMAL PLATFORM PROMOTION"
  echo "============================================================"

  dispatch_and_watch \
    "${PROMOTE_WORKFLOW}" \
    "${HEAD_SHA}" \
    -f gitSha="${TARGET_SHA}" \
    -f confirm=PROMOTE-PROD

  PROMOTION_RUN_ID="${LAST_RUN_ID}"
fi

if [[ "${MODE}" == "redeploy" ]]; then
  echo ""
  echo "============================================================"
  echo "PROD OWNER REDEPLOY"
  echo "============================================================"

  dispatch_and_watch \
    "${REDEPLOY_WORKFLOW}" \
    "${HEAD_SHA}" \
    -f gitSha="${TARGET_SHA}" \
    -f confirm=REDEPLOY-PROD \
    -f checkpointTag="${CHECKPOINT_TAG}" \
    -f reason="${REASON}"

  PROMOTION_RUN_ID="${LAST_RUN_ID}"
fi

[[ -n "${PROMOTION_RUN_ID}" ]] ||
  die "No PROD promotion run was recorded."

EXPECTED_PLATFORM_RELEASE_ID="plr_gha_${PROMOTION_RUN_ID}_1"
EXPECTED_PLATFORM_DEPLOYMENT_ID="pdep_gha_${PROMOTION_RUN_ID}_1"

# ============================================================
# FORMAL PROD VERIFICATION
# ============================================================

POST_PLATFORM="$(mktemp)"
POST_PROFILE="$(mktemp)"
POST_USAGE="$(mktemp)"
POST_PUBLIC="$(mktemp)"

read_active_pointer "${PLATFORM_TABLE}" "${POST_PLATFORM}"
read_active_pointer "${PROFILE_TABLE}" "${POST_PROFILE}"
read_active_pointer "${USAGE_TABLE}" "${POST_USAGE}"

POST_PLATFORM_REVISION="$(jq -r '.Item.revision.N // "0"' "${POST_PLATFORM}")"
POST_PLATFORM_RELEASE_ID="$(jq -r '.Item.platformReleaseId.S // empty' "${POST_PLATFORM}")"
POST_PLATFORM_DEPLOYMENT_ID="$(jq -r '.Item.deploymentId.S // empty' "${POST_PLATFORM}")"

POST_PROFILE_REVISION="$(jq -r '.Item.revision.N // "0"' "${POST_PROFILE}")"
POST_PROFILE_VARIANT_ID="$(jq -r '.Item.profileVariantId.S // empty' "${POST_PROFILE}")"
POST_PROFILE_ACTIVATION_ID="$(jq -r '.Item.activationId.S // empty' "${POST_PROFILE}")"

POST_USAGE_REVISION="$(jq -r '.Item.revision.N // "0"' "${POST_USAGE}")"
POST_USAGE_EPOCH_ID="$(jq -r '.Item.usageEpochId.S // empty' "${POST_USAGE}")"
POST_USAGE_PLATFORM_RELEASE_ID="$(jq -r '.Item.platformReleaseId.S // empty' "${POST_USAGE}")"
POST_USAGE_PROFILE_VARIANT_ID="$(jq -r '.Item.profileVariantId.S // empty' "${POST_USAGE}")"
POST_USAGE_CONFIG_ID="$(jq -r '.Item.deploymentConfigurationId.S // empty' "${POST_USAGE}")"

[[ "${POST_PLATFORM_RELEASE_ID}" == "${EXPECTED_PLATFORM_RELEASE_ID}" ]] ||
  die "Formal PROD Platform Release mismatch. Expected ${EXPECTED_PLATFORM_RELEASE_ID}, got ${POST_PLATFORM_RELEASE_ID}."

[[ "${POST_PLATFORM_DEPLOYMENT_ID}" == "${EXPECTED_PLATFORM_DEPLOYMENT_ID}" ]] ||
  die "Formal PROD Platform Deployment mismatch. Expected ${EXPECTED_PLATFORM_DEPLOYMENT_ID}, got ${POST_PLATFORM_DEPLOYMENT_ID}."

EXPECTED_PLATFORM_REVISION="$((PRE_PLATFORM_REVISION + 1))"

[[ "${POST_PLATFORM_REVISION}" == "${EXPECTED_PLATFORM_REVISION}" ]] ||
  die "PROD Platform revision mismatch. Expected ${EXPECTED_PLATFORM_REVISION}, got ${POST_PLATFORM_REVISION}."

[[ "${POST_PROFILE_REVISION}" == "${PRE_PROFILE_REVISION}" ]] ||
  die "Software deployment unexpectedly changed Profile ACTIVE revision."

[[ "${POST_PROFILE_VARIANT_ID}" == "${PRE_PROFILE_VARIANT_ID}" ]] ||
  die "Software deployment unexpectedly changed Profile ACTIVE identity."

[[ "${POST_PROFILE_ACTIVATION_ID}" == "${PRE_PROFILE_ACTIVATION_ID}" ]] ||
  die "Software deployment unexpectedly changed Profile activation occurrence."

POST_HTTP="$(
  curl \
    --silent \
    --show-error \
    --output "${POST_PUBLIC}" \
    --write-out '%{http_code}' \
    "${PROD_API}"
)"

[[ "${POST_HTTP}" == "200" ]] ||
  die "PROD Active Profile API unhealthy after promotion (HTTP ${POST_HTTP})."

jq -e '.ok == true' "${POST_PUBLIC}" >/dev/null ||
  die "PROD Active Profile API did not return ok=true after promotion."

PUBLIC_POST_PROFILE_VARIANT_ID="$(jq -r '.active.profileVariantId // empty' "${POST_PUBLIC}")"
PUBLIC_POST_PLATFORM_RELEASE_ID="$(jq -r '.deployment.platformReleaseId // empty' "${POST_PUBLIC}")"
PUBLIC_POST_CONFIG_ID="$(jq -r '.deployment.deploymentConfigurationId // empty' "${POST_PUBLIC}")"

[[ "${PUBLIC_POST_PROFILE_VARIANT_ID}" == "${PRE_PROFILE_VARIANT_ID}" ]] ||
  die "Public PROD Profile identity changed during software deployment."

if [[ -n "${PRE_PROFILE_VARIANT_ID}" ]]; then
  [[ "${PUBLIC_POST_PLATFORM_RELEASE_ID}" == "${EXPECTED_PLATFORM_RELEASE_ID}" ]] ||
    die "Public PROD Platform Release does not match newly committed Platform."

  [[ -n "${POST_USAGE_EPOCH_ID}" ]] ||
    die "Active Profile exists but no active Usage Epoch exists after Platform transition."

  [[ "${POST_USAGE_PLATFORM_RELEASE_ID}" == "${EXPECTED_PLATFORM_RELEASE_ID}" ]] ||
    die "Active Usage Epoch Platform identity mismatch."

  [[ "${POST_USAGE_PROFILE_VARIANT_ID}" == "${PRE_PROFILE_VARIANT_ID}" ]] ||
    die "Active Usage Epoch Profile identity mismatch."

  [[ -n "${POST_USAGE_CONFIG_ID}" ]] ||
    die "Active Usage Epoch is missing Deployment Configuration identity."

  [[ "${PUBLIC_POST_CONFIG_ID}" == "${POST_USAGE_CONFIG_ID}" ]] ||
    die "Public Deployment Configuration does not match active Usage Epoch."
else
  [[ -z "${PUBLIC_POST_PLATFORM_RELEASE_ID}" ]] ||
    die "Public deployment should remain null while no Profile is active."

  [[ -z "${POST_USAGE_EPOCH_ID}" ]] ||
    die "Usage Epoch should remain absent while no Profile is active."
fi

ok "Formal PROD Platform promotion verified."
ok "Profile activation boundary preserved."
ok "Public PROD runtime verified."

# ============================================================
# FINAL SOURCE INVARIANT
# ============================================================

git fetch origin main --quiet

if [[ "${MODE}" != "redeploy" ]]; then
  [[ "$(git rev-parse HEAD)" == "${TARGET_SHA}" ]] ||
    die "Local HEAD changed during PROD promotion."

  [[ "$(git rev-parse origin/main)" == "${TARGET_SHA}" ]] ||
    die "origin/main changed during PROD promotion."
fi

DIRTY="$(git status --porcelain --untracked-files=all)"
[[ -z "${DIRTY}" ]] || {
  echo "${DIRTY}"
  die "Working tree changed during PROD promotion."
}

# ============================================================
# RELEASE RECEIPT
# ============================================================

echo ""
echo "============================================================"
echo "PROD PROMOTION — GREEN"
echo "============================================================"
echo ""
echo "Checkpoint:"
echo "  ${CHECKPOINT_TAG}"
echo ""
echo "Source:"
echo "  ${TARGET_SHA}"
echo ""
echo "CI:"
echo "  GREEN"
echo ""
echo "DEV deployment:"
echo "  GREEN"
echo ""
echo "PROD infra:"
if [[ -n "${INFRA_RUN_ID}" ]]; then
  echo "  GREEN — run ${INFRA_RUN_ID}"
else
  echo "  SKIPPED BY MODE"
fi
echo ""
echo "PROD Platform Release:"
echo "  ${POST_PLATFORM_RELEASE_ID}"
echo ""
echo "PROD Platform Deployment:"
echo "  ${POST_PLATFORM_DEPLOYMENT_ID}"
echo ""
echo "Platform revision:"
echo "  ${POST_PLATFORM_REVISION}"
echo ""
echo "Profile Variant:"
echo "  ${POST_PROFILE_VARIANT_ID:-ABSENT}"
echo ""
echo "Profile revision:"
echo "  ${POST_PROFILE_REVISION}"
echo ""
echo "Profile activation:"
echo "  ${POST_PROFILE_ACTIVATION_ID:-ABSENT}"
echo ""
echo "Deployment Configuration:"
echo "  ${POST_USAGE_CONFIG_ID:-ABSENT}"
echo ""
echo "Usage Epoch:"
echo "  ${POST_USAGE_EPOCH_ID:-ABSENT}"
echo ""
echo "Public runtime:"
echo "  HTTP ${POST_HTTP}"
echo ""
echo "Profile publication/activation:"
echo "  NOT PERFORMED BY npm_pd"
echo ""
echo "============================================================"

exit 0
