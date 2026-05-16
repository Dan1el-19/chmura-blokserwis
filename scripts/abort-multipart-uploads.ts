import 'dotenv/config';
import {
  S3Client,
  ListMultipartUploadsCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('Missing required R2 environment variables.');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function main() {
  console.log(`Checking for active multipart uploads in bucket "${R2_BUCKET_NAME}"...`);

  const { Uploads } = await client.send(
    new ListMultipartUploadsCommand({ Bucket: R2_BUCKET_NAME }),
  );

  if (!Uploads || Uploads.length === 0) {
    console.log('No active multipart uploads found.');
    return;
  }

  console.log(`Found ${Uploads.length} active multipart upload(s):`);
  for (const u of Uploads) {
    console.log(`  - ${u.Key} (uploadId: ${u.UploadId}, initiated: ${u.Initiated})`);
  }

  console.log('\nAborting...');
  let aborted = 0;
  let failed = 0;

  for (const u of Uploads) {
    try {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: R2_BUCKET_NAME,
          Key: u.Key,
          UploadId: u.UploadId,
        }),
      );
      console.log(`  ✓ ${u.Key}`);
      aborted++;
    } catch (err: any) {
      console.error(`  ✗ ${u.Key}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${aborted} aborted, ${failed} failed.`);
}

main();
