#!/bin/bash
# Usage: ./gcp-create-secret.sh PROJECT_ID SECRET_NAME
# Expects environment variable JSON key file path in GOOGLE_APPLICATION_CREDENTIALS

PROJECT_ID=${1:-your-project}
SECRET_NAME=${2:-r2-credentials}

if [ "$PROJECT_ID" = "your-project" ]; then
  echo "Usage: $0 <GCP_PROJECT_ID> [SECRET_NAME]"
  exit 1
fi

# Store access key and secret as individual secrets or as a single JSON string
# Example stores a JSON string in Secret Manager that contains both keys

gcloud secrets create $SECRET_NAME --project=$PROJECT_ID --replication-policy="automatic" || true

echo -n "{\"accessKeyId\": \"$R2_ACCESS_KEY_ID\", \"secretAccessKey\": \"$R2_SECRET_ACCESS_KEY\"}" > /tmp/r2.json

gcloud secrets versions add $SECRET_NAME --project=$PROJECT_ID --data-file=/tmp/r2.json

rm /tmp/r2.json

echo "Secret $SECRET_NAME updated in project $PROJECT_ID"
