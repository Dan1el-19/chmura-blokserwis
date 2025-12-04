import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3Client: S3Client | null = null;

function requiredEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const k of keys) {
    const v = process.env[k];
    if (v) return v;
  }
  throw new Error(
    `Missing required env: ${name}${fallbacks.length ? ` (or one of: ${fallbacks.join(", ")})` : ""}`
  );
}

// Inicjalizacja klienta S3 dla Cloudflare R2 (lazy)
export function initializeS3Client(): S3Client {
  if (s3Client) return s3Client;

  const endpoint = requiredEnv("CLOUDFLARE_R2_ENDPOINT", [
    "CLOUDFLARE_ENDPOINT",
  ]);
  const accessKeyId = requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID", [
    "CLOUDFLARE_ACCESS_KEY_ID",
  ]);
  const secretAccessKey = requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", [
    "CLOUDFLARE_SECRET_ACCESS_KEY",
  ]);

  s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return s3Client;
}

export function getBucketName(): string {
  return requiredEnv("CLOUDFLARE_R2_BUCKET_NAME", ["CLOUDFLARE_BUCKET_NAME"]);
}

// Helpery operacji:
export async function generatePresignedUrl(
  key: string,
  op: "get" | "put",
  expiresIn = 3600,
  responseParams?: Record<string, string>
) {
  const client = initializeS3Client();
  const bucket = getBucketName();

  // For large file uploads, extend expiration time
  const keyLower = key.toLowerCase();
  const isLikelyLargeFile = keyLower.includes("large") || expiresIn > 3600;
  let actualExpiration = isLikelyLargeFile
    ? Math.max(expiresIn, 7200)
    : expiresIn; // min 2 hours for large files

  // For GET (preview) enforce at least PREVIEW_URL_MIN_SECONDS (default 300s)
  if (op === "get") {
    const previewMin = parseInt(
      process.env.PREVIEW_URL_MIN_SECONDS || "300",
      10
    );
    if (!isNaN(previewMin)) {
      actualExpiration = Math.max(actualExpiration, previewMin);
    }
  }

  if (op === "put") {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      // Add metadata to help with debugging
      Metadata: {
        "upload-time": new Date().toISOString(),
        "expires-in": actualExpiration.toString(),
      },
    });
    return getSignedUrl(client, command, { expiresIn: actualExpiration });
  } else {
    const commandParams = {
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition:
        responseParams?.["response-content-disposition"],
    };
    const command = new GetObjectCommand(commandParams);
    return getSignedUrl(client, command, { expiresIn: actualExpiration });
  }
}

export async function listFiles(prefix: string) {
  const client = initializeS3Client();
  const bucket = getBucketName();
  const cmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix });
  const res = await client.send(cmd);
  return res.Contents || [];
}

export async function deleteFile(key: string) {
  const client = initializeS3Client();
  const bucket = getBucketName();
  const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  return client.send(cmd);
}

export async function headObjectSize(key: string): Promise<number | null> {
  const client = initializeS3Client();
  const bucket = getBucketName();
  const res = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  );
  return typeof res.ContentLength === "number" ? res.ContentLength : null;
}

export async function headObjectMeta(
  key: string
): Promise<{ size: number | null; contentType: string | null }> {
  const client = initializeS3Client();
  const bucket = getBucketName();
  const res = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  );
  return {
    size: typeof res.ContentLength === "number" ? res.ContentLength : null,
    contentType: res.ContentType || null,
  };
}
