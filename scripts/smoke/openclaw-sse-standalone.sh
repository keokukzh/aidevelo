#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[openclaw-sse-standalone] $*"
}

fail() {
  echo "[openclaw-sse-standalone] ERROR: $*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "missing required command: $cmd"
}

require_cmd curl
require_cmd jq
require_cmd grep

OPENCLAW_URL="${OPENCLAW_URL:-}"
OPENCLAW_METHOD="${OPENCLAW_METHOD:-POST}"
OPENCLAW_AUTH_HEADER="${OPENCLAW_AUTH_HEADER:-}"
OPENCLAW_TIMEOUT_SEC="${OPENCLAW_TIMEOUT_SEC:-180}"
OPENCLAW_MODEL="${OPENCLAW_MODEL:-openclaw}"
OPENCLAW_USER="${OPENCLAW_USER:-aidevelo-smoke}"

AIDEVELO_RUN_ID="${AIDEVELO_RUN_ID:-smoke-run-$(date +%s)}"
AIDEVELO_AGENT_ID="${AIDEVELO_AGENT_ID:-openclaw-smoke-agent}"
AIDEVELO_COMPANY_ID="${AIDEVELO_COMPANY_ID:-openclaw-smoke-company}"
AIDEVELO_API_URL="${AIDEVELO_API_URL:-http://localhost:3100}"
AIDEVELO_TASK_ID="${AIDEVELO_TASK_ID:-openclaw-smoke-task}"
AIDEVELO_WAKE_REASON="${AIDEVELO_WAKE_REASON:-openclaw_smoke_test}"
AIDEVELO_WAKE_COMMENT_ID="${AIDEVELO_WAKE_COMMENT_ID:-}"
AIDEVELO_APPROVAL_ID="${AIDEVELO_APPROVAL_ID:-}"
AIDEVELO_APPROVAL_STATUS="${AIDEVELO_APPROVAL_STATUS:-}"
AIDEVELO_LINKED_ISSUE_IDS="${AIDEVELO_LINKED_ISSUE_IDS:-}"
OPENCLAW_TEXT_PREFIX="${OPENCLAW_TEXT_PREFIX:-Standalone OpenClaw SSE smoke test.}"

[[ -n "$OPENCLAW_URL" ]] || fail "OPENCLAW_URL is required"

read -r -d '' TEXT_BODY <<EOF || true
${OPENCLAW_TEXT_PREFIX}

AIDEVELO_RUN_ID=${AIDEVELO_RUN_ID}
AIDEVELO_AGENT_ID=${AIDEVELO_AGENT_ID}
AIDEVELO_COMPANY_ID=${AIDEVELO_COMPANY_ID}
AIDEVELO_API_URL=${AIDEVELO_API_URL}
AIDEVELO_TASK_ID=${AIDEVELO_TASK_ID}
AIDEVELO_WAKE_REASON=${AIDEVELO_WAKE_REASON}
AIDEVELO_WAKE_COMMENT_ID=${AIDEVELO_WAKE_COMMENT_ID}
AIDEVELO_APPROVAL_ID=${AIDEVELO_APPROVAL_ID}
AIDEVELO_APPROVAL_STATUS=${AIDEVELO_APPROVAL_STATUS}
AIDEVELO_LINKED_ISSUE_IDS=${AIDEVELO_LINKED_ISSUE_IDS}

Run your Aidevelo heartbeat procedure now.
EOF

PAYLOAD="$(jq -nc \
  --arg text "$TEXT_BODY" \
  --arg model "$OPENCLAW_MODEL" \
  --arg user "$OPENCLAW_USER" \
  --arg runId "$AIDEVELO_RUN_ID" \
  --arg agentId "$AIDEVELO_AGENT_ID" \
  --arg companyId "$AIDEVELO_COMPANY_ID" \
  --arg apiUrl "$AIDEVELO_API_URL" \
  --arg taskId "$AIDEVELO_TASK_ID" \
  --arg wakeReason "$AIDEVELO_WAKE_REASON" \
  --arg wakeCommentId "$AIDEVELO_WAKE_COMMENT_ID" \
  --arg approvalId "$AIDEVELO_APPROVAL_ID" \
  --arg approvalStatus "$AIDEVELO_APPROVAL_STATUS" \
  --arg linkedIssueIds "$AIDEVELO_LINKED_ISSUE_IDS" \
  '{
    model: $model,
    user: $user,
    input: $text,
    stream: true,
    metadata: {
      AIDEVELO_RUN_ID: $runId,
      AIDEVELO_AGENT_ID: $agentId,
      AIDEVELO_COMPANY_ID: $companyId,
      AIDEVELO_API_URL: $apiUrl,
      AIDEVELO_TASK_ID: $taskId,
      AIDEVELO_WAKE_REASON: $wakeReason,
      AIDEVELO_WAKE_COMMENT_ID: $wakeCommentId,
      AIDEVELO_APPROVAL_ID: $approvalId,
      AIDEVELO_APPROVAL_STATUS: $approvalStatus,
      AIDEVELO_LINKED_ISSUE_IDS: $linkedIssueIds,
      aidevelo_session_key: ("aidevelo:run:" + $runId)
    }
  }')"

headers_file="$(mktemp)"
body_file="$(mktemp)"
cleanup() {
  rm -f "$headers_file" "$body_file"
}
trap cleanup EXIT

args=(
  -sS
  -N
  --max-time "$OPENCLAW_TIMEOUT_SEC"
  -X "$OPENCLAW_METHOD"
  -H "content-type: application/json"
  -H "accept: text/event-stream"
  -H "x-openclaw-session-key: aidevelo:run:${AIDEVELO_RUN_ID}"
  -D "$headers_file"
  -o "$body_file"
  --data "$PAYLOAD"
  "$OPENCLAW_URL"
)

if [[ -n "$OPENCLAW_AUTH_HEADER" ]]; then
  args=(-H "Authorization: $OPENCLAW_AUTH_HEADER" "${args[@]}")
fi

log "posting SSE wake payload to ${OPENCLAW_URL}"
http_code="$(curl "${args[@]}" -w "%{http_code}")"
log "http status: ${http_code}"

if [[ ! "$http_code" =~ ^2 ]]; then
  tail -n 80 "$body_file" >&2 || true
  fail "non-success HTTP status: ${http_code}"
fi

if ! grep -Eqi '^content-type:.*text/event-stream' "$headers_file"; then
  tail -n 40 "$body_file" >&2 || true
  fail "response content-type was not text/event-stream"
fi

if grep -Eqi 'event:\s*(error|failed|cancel)|"status":"(failed|cancelled|error)"|"type":"[^"]*(failed|cancelled|error)"' "$body_file"; then
  tail -n 120 "$body_file" >&2 || true
  fail "stream reported a failure event"
fi

if ! grep -Eqi 'event:\s*(done|completed|response\.completed)|\[DONE\]|"status":"(completed|succeeded|done)"|"type":"response\.completed"' "$body_file"; then
  tail -n 120 "$body_file" >&2 || true
  fail "stream ended without a terminal completion marker"
fi

event_count="$(grep -Ec '^event:' "$body_file" || true)"
log "stream completed successfully (events=${event_count})"
echo
tail -n 40 "$body_file"
