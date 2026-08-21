#!/usr/bin/env bash
# scripts/cdn-invalidate.sh

set -euo pipefail


# ============================================================
# CDN INVALIDATION
#
# Safe default:
#
#   ASSET_STAGE=dev
#
# PROD mutation requires:
#
#   ASSET_STAGE=prod
#   ASSET_CONFIRMATION=INVALIDATE-PROD
#
# Read-only target validation:
#
#   ASSET_DRY_RUN=1
#
# Distribution IDs are resolved from CloudFormation.
# No CDN identifiers are read from local .env files.
# ============================================================


SCRIPT_NAME="cdn_invalidate"

REPO_ROOT="$(
  git rev-parse --show-toplevel 2>/dev/null ||
    pwd
)"

cd "${REPO_ROOT}"


LOG_DIR="${REPO_ROOT}/logs/${SCRIPT_NAME}"

mkdir -p "${LOG_DIR}"


# ============================================================
# LOG RETENTION
# ============================================================

if compgen -G "${LOG_DIR}/${SCRIPT_NAME}_"*.log >/dev/null; then
  ls -1t "${LOG_DIR}/${SCRIPT_NAME}_"*.log |
    tail -n +31 |
    while read -r file; do
      rm -f "${file}"
    done
fi


RUN_TS="$(
  date +%Y-%m-%d_%H-%M-%S
)"

LOG_FILE="${LOG_DIR}/${SCRIPT_NAME}_${RUN_TS}.log"

LATEST_LOG="${LOG_DIR}/${SCRIPT_NAME}_latest.log"


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


require_cmd() {
  command -v "$1" >/dev/null 2>&1 ||
    die "Missing required command: $1"
}


exec \
  > >(tee -a "${LOG_FILE}" "${LATEST_LOG}") \
  2>&1


trap '
  rc=$?

  if [[ ${rc} -eq 0 ]]; then
    echo "✅ RESULT: SUCCESS"
  else
    echo "❌ RESULT: FAILED (exit=${rc})"
  fi
' EXIT


# ============================================================
# PRECONDITIONS
# ============================================================

require_cmd git
require_cmd aws


git rev-parse \
  --is-inside-work-tree \
  >/dev/null 2>&1 ||
  die "Not inside a Git repository."


# ============================================================
# CONFIGURATION
# ============================================================

ASSET_STAGE="${ASSET_STAGE:-dev}"

ASSET_DRY_RUN="${ASSET_DRY_RUN:-0}"

ASSET_CONFIRMATION="${ASSET_CONFIRMATION:-}"

REGION="${AWS_REGION:-us-east-1}"

PROFILE="${AWS_PROFILE:-}"


case "${ASSET_STAGE}" in

  dev)
    STACK_NAME="AssetsCdnStackDev"
    ;;


  prod)
    STACK_NAME="AssetsCdnStack"
    ;;


  *)
    die "Unsupported ASSET_STAGE '${ASSET_STAGE}'. Use 'dev' or 'prod'."
    ;;

esac


# ============================================================
# PROD SAFETY
#
# Fail before authentication or infrastructure discovery for
# any real PROD mutation.
#
# Read-only dry runs intentionally do not require confirmation.
# ============================================================

if [[ "${ASSET_STAGE}" == "prod" &&
      "${ASSET_DRY_RUN}" != "1" &&
      "${ASSET_CONFIRMATION}" != "INVALIDATE-PROD" ]]; then

  echo ""
  echo "❌ PROD CDN invalidation blocked."
  echo ""
  echo "To explicitly invalidate PROD:"
  echo ""
  echo "  ASSET_STAGE=prod \\"
  echo "  ASSET_CONFIRMATION=INVALIDATE-PROD \\"
  echo "  npm run cdn:invalidate"
  echo ""

  exit 1
fi


INVALIDATE_PATHS=(
  "/ships/sprites/*"
  "/ships/glb/*"
  "/geo/*"
)


# ============================================================
# AWS COMMAND
# ============================================================

AWS_PROFILE_ARGS=()


if [[ -n "${PROFILE}" ]]; then
  AWS_PROFILE_ARGS=(
    --profile
    "${PROFILE}"
  )
fi


aws_cli() {
  aws \
    "${AWS_PROFILE_ARGS[@]}" \
    "$@"
}


# ============================================================
# AWS SESSION
# ============================================================

ensure_aws_session() {

  if aws_cli \
    sts \
    get-caller-identity \
    >/dev/null 2>&1; then

    return 0
  fi


  if [[ -n "${PROFILE}" ]]; then

    info "AWS session unavailable. Attempting SSO login for '${PROFILE}'..."

    aws \
      sso \
      login \
      --profile "${PROFILE}"


    aws_cli \
      sts \
      get-caller-identity \
      >/dev/null 2>&1 ||
      die "Unable to authenticate to AWS after SSO login."


    return 0
  fi


  die "AWS authentication unavailable. Set AWS_PROFILE or authenticate using the default credential chain."
}


# ============================================================
# CONTEXT
# ============================================================

echo ""

info "Log file: ${LOG_FILE}"
info "Asset stage: ${ASSET_STAGE}"
info "Stack: ${STACK_NAME}"
info "Region: ${REGION}"
info "AWS profile: ${PROFILE:-<default>}"

echo ""


ensure_aws_session


# ============================================================
# RESOLVE STACK OUTPUTS
# ============================================================

info "Resolving CloudFront infrastructure from CloudFormation..."


RESOLVED_STAGE="$(
  aws_cli \
    cloudformation \
    describe-stacks \
    --region "${REGION}" \
    --stack-name "${STACK_NAME}" \
    --query "Stacks[0].Outputs[?OutputKey=='Stage'].OutputValue | [0]" \
    --output text
)"


DISTRIBUTION_ID="$(
  aws_cli \
    cloudformation \
    describe-stacks \
    --region "${REGION}" \
    --stack-name "${STACK_NAME}" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue | [0]" \
    --output text
)"


CDN_URL="$(
  aws_cli \
    cloudformation \
    describe-stacks \
    --region "${REGION}" \
    --stack-name "${STACK_NAME}" \
    --query "Stacks[0].Outputs[?OutputKey=='CdnUrl'].OutputValue | [0]" \
    --output text
)"


# ============================================================
# STAGE VALIDATION
#
# AssetsCdnStack is the pre-P4 existing PROD stack. Until the
# P4 infrastructure migration is deployed, it does not yet
# contain the new Stage output.
#
# Missing Stage is therefore accepted ONLY for the exact legacy
# PROD stack. DEV must always expose Stage=dev.
# ============================================================

if [[ -z "${RESOLVED_STAGE}" ||
      "${RESOLVED_STAGE}" == "None" ]]; then

  if [[ "${ASSET_STAGE}" == "prod" &&
        "${STACK_NAME}" == "AssetsCdnStack" ]]; then

    RESOLVED_STAGE="prod"

    info "Stage output is not present on the existing PROD stack yet."
    info "Treating AssetsCdnStack as legacy PROD during the P4 migration."

  else

    die "Stage output was not found in ${STACK_NAME}."

  fi
fi


if [[ "${RESOLVED_STAGE}" != "${ASSET_STAGE}" ]]; then

  die "Stage mismatch: requested '${ASSET_STAGE}', stack reported '${RESOLVED_STAGE}'."

fi


if [[ -z "${DISTRIBUTION_ID}" ||
      "${DISTRIBUTION_ID}" == "None" ]]; then

  die "DistributionId output was not found in ${STACK_NAME}."
fi


if [[ -z "${CDN_URL}" ||
      "${CDN_URL}" == "None" ]]; then

  die "CdnUrl output was not found in ${STACK_NAME}."
fi


ok "Resolved ${ASSET_STAGE} CloudFront distribution."

echo ""
echo "Target:"
echo "  Stage:        ${RESOLVED_STAGE}"
echo "  Stack:        ${STACK_NAME}"
echo "  Distribution: ${DISTRIBUTION_ID}"
echo "  CDN:          ${CDN_URL}"
echo ""


# ============================================================
# READ-ONLY DRY RUN
# ============================================================

if [[ "${ASSET_DRY_RUN}" == "1" ]]; then

  ok "Dry run complete. No CloudFront invalidation was created."

  exit 0
fi


# ============================================================
# INVALIDATE
# ============================================================

echo ""

info "Creating CloudFront invalidation..."


aws_cli \
  cloudfront \
  create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "${INVALIDATE_PATHS[@]}" \
  --region "${REGION}" \
  >/dev/null


echo ""

ok "CDN invalidation submitted."

echo ""
echo "Stage:        ${ASSET_STAGE}"
echo "Distribution: ${DISTRIBUTION_ID}"
echo ""