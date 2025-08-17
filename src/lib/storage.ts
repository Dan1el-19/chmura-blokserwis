import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client: S3Client | null = null;

function requiredEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const k of keys) {
    const v = process.env[k];
    if (v) return v;
  }
  throw new Error(`Missing required env: ${name}${fallbacks.length ? ` (or one of: ${fallbacks.join(', ')})` : ''}`);
}

// Inicjalizacja klienta S3 dla Cloudflare R2 (lazy)
export function initializeS3Client(): S3Client {
  if (s3Client) return s3Client;

  const endpoint = requiredEnv('CLOUDFLARE_R2_ENDPOINT', ['CLOUDFLARE_ENDPOINT']);
  const accessKeyId = requiredEnv('CLOUDFLARE_R2_ACCESS_KEY_ID', ['CLOUDFLARE_ACCESS_KEY_ID']);
  const secretAccessKey = requiredEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY', ['CLOUDFLARE_SECRET_ACCESS_KEY']);

  s3Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return s3Client;
}

export function getBucketName(): string {
  return requiredEnv('CLOUDFLARE_R2_BUCKET_NAME', ['CLOUDFLARE_BUCKET_NAME']);
}

// Helpery operacji:
export async function generatePresignedUrl(key: string, op: 'get' | 'put', expiresIn = 3600) {
  const client = initializeS3Client();
  const bucket = getBucketName();
  const command = op === 'get'
    ? new GetObjectCommand({ Bucket: bucket, Key: key })
    : new PutObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
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

// Multipart helpers
export async function createMultipartUpload(key: string, contentType?: string): Promise<{ uploadId: string }> {
  const client = initializeS3Client();
  const bucket = getBucketName();
  const res = await client.send(new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType || 'application/octet-stream'
  }));
  if (!res.UploadId) {
    throw new Error('Failed to initiate multipart upload');
  }
  return { uploadId: res.UploadId };
}

export async function getPresignedPartUrl(key: string, uploadId: string, partNumber: number, expiresIn = 3600) {
  const client = initializeS3Client();
  const bucket = getBucketName();
  const cmd = new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function completeMultipartUpload(key: string, uploadId: string, parts: Array<{ ETag: string; PartNumber: number }>) {
  const client = initializeS3Client();
  const bucket = getBucketName();
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) }
  }));
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  const client = initializeS3Client();
  const bucket = getBucketName();
  await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
}

export async function listUploadedParts(key: string, uploadId: string) {
  const client = initializeS3Client();
  const bucket = getBucketName();
  const res = await client.send(new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
  return res.Parts || [];
}

// Alias dla kompatybilności z nowym endpointem
export async function listMultipartUploadParts(key: string, uploadId: string) {
  return listUploadedParts(key, uploadId);
}

export async function headObjectSize(key: string): Promise<number | null> {
  const client = initializeS3Client();
  const bucket = getBucketName();
  const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return typeof res.ContentLength === 'number' ? res.ContentLength : null;
}


