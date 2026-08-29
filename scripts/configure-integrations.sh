#!/usr/bin/env bash
set -euo pipefail
# Before running, add versions to these Terraform-created secrets:
#   webpilot-$ENV-slack-client-id       raw Slack client id
#   webpilot-$ENV-slack-client-secret   raw Slack client secret
#   webpilot-$ENV-slack-signing-secret  raw Slack signing secret
#   webpilot-$ENV-slack-state-secret    random >=32-byte state HMAC secret
#   webpilot-$ENV-gmail-oauth           JSON: {"clientId":"...","clientSecret":"...","redirectUri":"...","refreshToken":"...","recipient":"..."}
#   webpilot-$ENV-google-chat-webhook   raw Google Chat webhook URL
: "${PROJECT_ID:?PROJECT_ID required}"
REGION="${REGION:-us-central1}"
ENV="${ENV:-prod}"
GMAIL_SENDER="${GMAIL_SENDER:-}"
API="webpilot-${ENV}-api"
NOTIFIER="webpilot-${ENV}-notifier"
API_URL=$(gcloud run services describe "$API" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')

gcloud run services update "$API" --project "$PROJECT_ID" --region "$REGION" \
  --set-secrets="SLACK_CLIENT_ID=webpilot-${ENV}-slack-client-id:latest,SLACK_CLIENT_SECRET=webpilot-${ENV}-slack-client-secret:latest,SLACK_SIGNING_SECRET=webpilot-${ENV}-slack-signing-secret:latest,SLACK_STATE_SECRET=webpilot-${ENV}-slack-state-secret:latest" \
  --update-env-vars="SLACK_REDIRECT_URI=${API_URL}/api/v1/integrations/slack/callback"

GMAIL_REF="projects/${PROJECT_ID}/secrets/webpilot-${ENV}-gmail-oauth/versions/latest"
gcloud run services update "$NOTIFIER" --project "$PROJECT_ID" --region "$REGION" \
  --set-secrets="GOOGLE_CHAT_WEBHOOK=webpilot-${ENV}-google-chat-webhook:latest" \
  --update-env-vars="GMAIL_OAUTH_SECRET_REF=${GMAIL_REF},GMAIL_SENDER=${GMAIL_SENDER}"

echo "Optional integrations attached. Configure Slack slash-command URL: ${API_URL}/api/v1/integrations/slack/command"
