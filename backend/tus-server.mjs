import { config as dotenvConfig } from 'dotenv';
// load .env.local if present
dotenvConfig({ path: '.env.local', override: false });

import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { S3Store } from '@tus/s3-store';
import { Server } from '@tus/server';
import http from 'node:http';

const port = process.env.TUS_PORT || 1080;
const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT || 'https://0435db96c4078cd58f12162e0b83cee0.r2.cloudflarestorage.com';

// CORS configuration: comma-separated origins in ALLOWED_ORIGINS, defaults to localhost:3000
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean);

if (!bucket) {
	console.error('R2 bucket name not set (R2_BUCKET or R2_BUCKET_NAME)');
	process.exit(1);
}

// Build a plain config object for the S3 client and the S3 store.
const s3ClientConfig = {
	endpoint,
	region: 'auto',
	credentials: { accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID, secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY },
};
const s3Client = new S3Client(s3ClientConfig);
// Pass a plain config (not s3Client.config which may include runtime-only objects)
const store = new S3Store({ s3ClientConfig: { ...s3ClientConfig, bucket } });
// Do NOT use the client-provided metadata.key as the TUS id (it may contain slashes and break routing).
// Instead generate a URL-safe id (Server will do this by default) and, after a successful upload,
// copy the completed object into the desired `metadata.key` location.
const tus = new Server({
	path: '/files',
	datastore: store,
	// onUploadFinish is called when an upload completes (creation-with-upload or final PATCH)
	onUploadFinish: async (req, upload) => {
		const desiredKey = upload.metadata && upload.metadata.key ? String(upload.metadata.key) : null;
		if (!desiredKey) {
			console.log('onUploadFinish: no metadata.key provided; skipping copy/move');
			return {};
		}

		const sourceKey = upload.id;
		const destKey = desiredKey;

		console.log('onUploadFinish: moving upload', sourceKey, '->', destKey);

		try {
			// Copy the completed object to the desired key. Use encoded CopySource to be safe.
			const copySource = encodeURIComponent(`${bucket}/${sourceKey}`);
			await s3Client.send(new CopyObjectCommand({ Bucket: bucket, CopySource: copySource, Key: destKey }));

			// Delete the temporary source object and its metadata info file (.info)
			await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }));
			await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: `${sourceKey}.info` }));

			console.log('onUploadFinish: move complete', sourceKey, '->', destKey);
			return {};
		}
		catch (err) {
			console.error('onUploadFinish: error copying/moving object', err && err.stack ? err.stack : err);
			// Throw to surface the error to the client; PostHandler will log and fail the request.
			throw err;
		}
	}
});

const server = http.createServer((req, res) => {
	const origin = req.headers['origin'];
	// Allow explicit allowedOrigins or common dev origins (localhost, 127.*, local LAN 192.168.* and 10.*)
	const allowed = Boolean(origin) && (
		allowedOrigins.includes(origin) ||
		origin.startsWith('http://localhost') ||
		origin.startsWith('http://127.') ||
		origin.startsWith('http://192.168.') ||
		origin.startsWith('http://10.')
	);

	// Log incoming request for debugging
	console.log('Incoming request', { method: req.method, url: req.url, origin: req.headers['origin'], 'acr-headers': req.headers['access-control-request-headers'] });

	// Health check
	if (req.url === '/health') {
		if (allowed) {
			res.setHeader('Access-Control-Allow-Origin', origin);
			res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,HEAD,PATCH');
			res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Upload-Length,Upload-Offset, tus-resumable, Authorization, X-Requested-With');
		}
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ ok: true }));
		return;
	}

	// Preflight
	if (req.method === 'OPTIONS') {
		console.log('Preflight headers:', req.headers);
		if (allowed) {
			res.setHeader('Access-Control-Allow-Origin', origin);
			res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,HEAD,PATCH');
			const requestHeaders = req.headers['access-control-request-headers'];
			if (requestHeaders) res.setHeader('Access-Control-Allow-Headers', requestHeaders);
			// Allow browser to read Location and Upload-Offset from responses
			res.setHeader('Access-Control-Expose-Headers', 'Location, Upload-Offset');
			res.setHeader('Access-Control-Max-Age', '3600');
		}
		console.log('Preflight response allowed=', allowed, 'origin=', origin);
		res.writeHead(204);
		res.end();
		return;
	}

	// Let tus server handle everything under /files
	if (req.url && req.url.startsWith('/files')) {
		// Ensure CORS expose headers are always present so browser can read Location/Upload-Offset
		if (allowed) {
			res.setHeader('Access-Control-Allow-Origin', origin);
			res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,HEAD,PATCH');
			res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Upload-Length,Upload-Offset, tus-resumable, Authorization, X-Requested-With');
			// Expose Location to browser so Uppy can read upload URL
			res.setHeader('Access-Control-Expose-Headers', 'Location, Upload-Offset');
		}

		// Wrap res.end to log final status and headers for debugging (will not change behavior)
		const originalEnd = res.end.bind(res);
		res.end = function (...args) {
			try {
				console.log('Response finalizing', { statusCode: res.statusCode, headers: res.getHeaders() });
			} catch (e) {
				console.error('Error logging response headers', e);
			}
			return originalEnd(...args);
		};

		try {
			// Log before handing to tus
			console.log('Handling TUS request', { method: req.method, url: req.url });
			tus.handle(req, res).catch(err => {
				console.error('TUS async error', err && err.stack ? err.stack : err);
				try { res.statusCode = 500; if (allowed) res.setHeader('Access-Control-Allow-Origin', origin); res.end('TUS server error'); } catch(e) { console.error('Error sending 500 response', e); }
			});
		} catch (err) {
			console.error('TUS sync error', err && err.stack ? err.stack : err);
			res.statusCode = 500;
			if (allowed) res.setHeader('Access-Control-Allow-Origin', origin);
			res.end('TUS server error');
		}
		return;
	}

	res.writeHead(404);
	res.end('Not Found');
});

server.listen(port, () => console.log(`TUS server listening on http://localhost:${port}/files`));

// Graceful shutdown for production
const shutdown = async (signal) => {
	try {
		console.log(`Received ${signal}, shutting down TUS server...`);
		server.close(() => console.log('HTTP server closed'));
		try { await s3Client.destroy(); } catch (e) { /* ignore */ }
		process.exit(0);
	} catch (err) {
		console.error('Error during shutdown', err);
		process.exit(1);
	}
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
