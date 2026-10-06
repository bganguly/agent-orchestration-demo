#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.gcp"
BACKEND_SVC="agent-backend"
FRONTEND_SVC="agent-frontend"
GKE_CLUSTER="agent-demo-cluster"

TARGET=""

# ── Preflight / menu ──────────────────────────────────────────────────────────

_run_preflight() {
  local _local_running=0 _gcp_deployed=0
  lsof -ti:8002 >/dev/null 2>&1 && _local_running=1 || true
  [[ -f "$ENV_FILE" ]] && _gcp_deployed=1 || true

  printf '\n=== agent-orchestration-demo teardown ===\n\n'
  printf '  [1] Local  — kill uvicorn + npm dev'
  (( _local_running )) && printf ' [running]' || printf ' [not detected]'
  printf '\n'
  printf '  [2] Cloud  — delete Cloud Run services + optional GKE cluster'
  (( _gcp_deployed )) && printf ' [deployed]' || printf ' [no .env.gcp found]'
  printf '\n'
  printf '\nChoice [1/2, default 2]: '
  read -r _MODE
  _MODE="${_MODE:-2}"
  case "$_MODE" in
    2) TARGET="cloud" ;;
    *) TARGET="local" ;;
  esac
}

# ── Local teardown ────────────────────────────────────────────────────────────

_teardown_local() {
  printf '\nStopping local processes...\n'
  local _pids
  _pids=$(lsof -ti:8002 2>/dev/null || true)
  if [[ -n "$_pids" ]]; then
    kill "$_pids" 2>/dev/null || true
    printf '  Killed PID(s) on :8002 (uvicorn)\n'
  else
    printf '  No process found on :8002\n'
  fi

  _pids=$(lsof -ti:3011 2>/dev/null || true)
  if [[ -n "$_pids" ]]; then
    kill "$_pids" 2>/dev/null || true
    printf '  Killed PID(s) on :3011 (frontend dev server)\n'
  else
    printf '  No process found on :3011\n'
  fi
  printf '\nLocal teardown complete.\n'
}

# ── GCP teardown ──────────────────────────────────────────────────────────────

_teardown_gcp() {
  [[ -f "$ENV_FILE" ]] || { printf '\nNo .env.gcp found — nothing to tear down.\n'; exit 0; }
  source "$ENV_FILE"
  [[ -n "${GCP_PROJECT:-}" ]] || { printf '\nGCP_PROJECT not set in .env.gcp\n' >&2; exit 1; }
  [[ -n "${GCP_REGION:-}" ]] || { GCP_REGION="us-central1"; }

  printf '\n  Project: %s\n  Region:  %s\n' "$GCP_PROJECT" "$GCP_REGION"

  printf '\nDeleting Cloud Run services...\n'
  if gcloud run services describe "$FRONTEND_SVC" \
       --region="$GCP_REGION" --project="$GCP_PROJECT" &>/dev/null; then
    gcloud run services delete "$FRONTEND_SVC" \
      --region="$GCP_REGION" --project="$GCP_PROJECT" --quiet
    printf '  Deleted: %s\n' "$FRONTEND_SVC"
  else
    printf '  Not found: %s (skipped)\n' "$FRONTEND_SVC"
  fi

  if gcloud run services describe "$BACKEND_SVC" \
       --region="$GCP_REGION" --project="$GCP_PROJECT" &>/dev/null; then
    gcloud run services delete "$BACKEND_SVC" \
      --region="$GCP_REGION" --project="$GCP_PROJECT" --quiet
    printf '  Deleted: %s\n' "$BACKEND_SVC"
  else
    printf '  Not found: %s (skipped)\n' "$BACKEND_SVC"
  fi

  local _GKE_ZONE="${GCP_REGION}-a"
  if gcloud container clusters describe "$GKE_CLUSTER" \
       --zone "$_GKE_ZONE" --project "$GCP_PROJECT" &>/dev/null; then
    printf '\nGKE cluster %s found.\n' "$GKE_CLUSTER"
    printf 'Delete GKE cluster? This destroys the cluster entirely. [y/N]: '
    read -r _CONFIRM
    if [[ "${_CONFIRM:-N}" =~ ^[Yy] ]]; then
      gcloud container clusters delete "$GKE_CLUSTER" \
        --zone "$_GKE_ZONE" --project "$GCP_PROJECT" --quiet
      printf '  Deleted: %s\n' "$GKE_CLUSTER"
    else
      printf '  Skipped GKE cluster deletion.\n'
    fi
  fi

  rm -f "$ENV_FILE"
  printf '\nRemoved %s\n' "$ENV_FILE"
  printf 'GCP teardown complete.\n'
}

# ── Main ──────────────────────────────────────────────────────────────────────

_run_preflight
if [[ "$TARGET" == "local" ]]; then
  _teardown_local
else
  _teardown_gcp
fi
