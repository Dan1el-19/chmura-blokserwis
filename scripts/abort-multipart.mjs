#!/usr/bin/env node
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: false });

import {
  S3Client,
  ListMultipartUploadsCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";

// Simple CLI arguments parser
const argv = process.argv.slice(2);
const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    if (a.includes("=")) {
      const [key, value] = a.substring(2).split("=", 2);
      opts[key] = value;
    } else {
      const key = a.replace(/^--/, "");
      const val =
        argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      opts[key] = val;
    }
  }
}

// Robust bucket detection: prefer explicit option, then common env names.
const BUCKET =
  opts.bucket ||
  process.env.R2_BUCKET ||
  process.env.R2_BUCKET_NAME ||
  process.env.CLOUDFLARE_R2_BUCKET_NAME ||
  process.env.CLOUDFLARE_BUCKET_NAME ||
  "";
const ENDPOINT =
  opts.endpoint ||
  process.env.R2_ENDPOINT ||
  process.env.CLOUDFLARE_R2_ENDPOINT;
const ACCESS_KEY_ID =
  opts.accessKeyId ||
  process.env.ACCESS_KEY_ID ||
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY =
  opts.secretAccessKey ||
  process.env.SECRET_ACCESS_KEY ||
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const PREFIX = opts.prefix || "";
const DRY_RUN =
  String(opts["dry-run"] ?? opts.dry ?? "true").toLowerCase() !== "false";
const OLDER_THAN_DAYS = Number(opts["older-than"] || opts.days || 7);
const MAX_TO_PROCESS = Number(opts.limit || 1000);

if (!BUCKET || !ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error(
    "Missing R2 configuration. Set R2_BUCKET (or R2_BUCKET_NAME / CLOUDFLARE_R2_BUCKET_NAME), R2_ENDPOINT, ACCESS_KEY_ID and SECRET_ACCESS_KEY in .env.local or provide via CLI args."
  );
  process.exit(2);
}

const s3Client = new S3Client({
  endpoint: ENDPOINT,
  region: "auto",
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

async function listAllMultipartUploads(bucket, prefix) {
  const uploads = [];
  let keyMarker;
  let uploadIdMarker;
  while (true) {
    const input = {
      Bucket: bucket,
      Prefix: prefix || undefined,
      KeyMarker: keyMarker,
      UploadIdMarker: uploadIdMarker,
      MaxUploads: 1000,
    };
    const cmd = new ListMultipartUploadsCommand(input);
    const resp = await s3Client.send(cmd);
    if (resp.Uploads) uploads.push(...resp.Uploads);
    if (!resp.IsTruncated) break;
    keyMarker = resp.NextKeyMarker;
    uploadIdMarker = resp.NextUploadIdMarker;
    // safety cap
    if (uploads.length >= MAX_TO_PROCESS) break;
  }
  return uploads;
}

function olderThan(initiated, days) {
  const cut = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(initiated).getTime() < cut;
}

async function abortUpload(bucket, key, uploadId) {
  const cmd = new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
  });
  return s3Client.send(cmd);
}

(async () => {
  console.log(`Using bucket=${BUCKET} endpoint=${ENDPOINT}`);
  console.log(
    `Options: prefix='${PREFIX}', older-than-days=${OLDER_THAN_DAYS}, dry-run=${DRY_RUN}, limit=${MAX_TO_PROCESS}`
  );
  try {
    const uploads = await listAllMultipartUploads(BUCKET, PREFIX);
    console.log(
      `Found ${uploads.length} multipart upload(s)${PREFIX ? ` with prefix '${PREFIX}'` : ""}.`
    );

    const candidates = uploads.filter((u) =>
      olderThan(u.Initiated, OLDER_THAN_DAYS)
    );
    console.log(
      `${candidates.length} upload(s) older than ${OLDER_THAN_DAYS} day(s).`
    );

    if (candidates.length === 0) process.exit(0);

    let aborted = 0;
    for (const u of candidates) {
      const key = u.Key;
      const uploadId = u.UploadId;
      console.log(`- ${key} (UploadId=${uploadId}) initiated=${u.Initiated}`);
      if (DRY_RUN) continue;
      try {
        await abortUpload(BUCKET, key, uploadId);
        console.log(`  Aborted ${uploadId} for ${key}`);
        aborted++;
      } catch (err) {
        console.error(`  Failed to abort ${uploadId} for ${key}:`, err);
      }
    }

    console.log(`Done. Aborted ${aborted} upload(s).`);
  } catch (err) {
    console.error("Error listing or aborting multipart uploads:", err);
    process.exit(1);
  }
})();
