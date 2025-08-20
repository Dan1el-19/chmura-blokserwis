import { S3Store } from '@tus/s3-store';
import { Server } from '@tus/server';
import { R2Bucket, ExecutionContext } from '@cloudflare/workers-types';

export interface Env {
	R2_BUCKET: R2Bucket;
	R2_ENDPOINT: string;
	ACCOUNT_ID: string;
	ACCESS_KEY_ID: string;
	SECRET_ACCESS_KEY: string;
}

// Lista dozwolonych źródeł (domen)
const allowedOrigins = [
	'http://localhost:3000',
	'http://192.168.1.136:3000',
	'https://chmura.blokserwis.pl',
];

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const requestOrigin = request.headers.get('Origin');
		const allowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : null;

		// Obsługa żądań preflight (OPTIONS) dla CORS - echo requested headers when allowed
		if (request.method === 'OPTIONS') {
			if (!allowedOrigin) {
				return new Response('CORS Preflight Check Failed', { status: 403 });
			}
			const reqHeaders = request.headers.get('Access-Control-Request-Headers') || '';
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': allowedOrigin,
					'Access-Control-Allow-Methods': 'POST, GET, HEAD, PATCH, DELETE, OPTIONS',
					'Access-Control-Expose-Headers': 'Upload-Offset, Location, Upload-Length, Tus-Version, Tus-Resumable, Tus-Max-Size, Tus-Extension, Upload-Metadata, Upload-Defer-Length, Upload-Concat',
					'Access-Control-Allow-Headers': reqHeaders || 'Upload-Length, Upload-Metadata, Tus-Resumable, Content-Type, Origin, X-Requested-With',
					'Access-Control-Max-Age': '86400',
				},
			});
		}

		const s3ClientConfig = {
			endpoint: env.R2_ENDPOINT,
			region: 'auto',
			credentials: {
				accessKeyId: env.ACCESS_KEY_ID,
				secretAccessKey: env.SECRET_ACCESS_KEY,
			},
		};

		// Initialize S3-backed store (using Cloudflare R2 via S3-compatible client)
		// Derive bucket name robustly from the Worker binding or environment.
		let bucketName = '';
		if (typeof (env as any).R2_BUCKET === 'string' && (env as any).R2_BUCKET) {
			bucketName = (env as any).R2_BUCKET;
		} else if ((env as any).R2_BUCKET && (env as any).R2_BUCKET.name) {
			bucketName = (env as any).R2_BUCKET.name;
		} else if ((env as any).R2_BUCKET_NAME) {
			bucketName = (env as any).R2_BUCKET_NAME;
		} else if ((env as any).CLOUDFLARE_R2_BUCKET_NAME) {
			bucketName = (env as any).CLOUDFLARE_R2_BUCKET_NAME;
		} else if (typeof process !== 'undefined' && process.env) {
			bucketName = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.CLOUDFLARE_BUCKET_NAME || '';
		}

		if (!bucketName) {
			// Throw a clear error so the catch block returns a helpful message.
			throw new Error('Missing R2 bucket name. Provide one of: Worker binding `R2_BUCKET`, binding `R2_BUCKET_NAME`, or env var `CLOUDFLARE_R2_BUCKET_NAME`/`R2_BUCKET`.');
		}

		const store = new S3Store({
			s3ClientConfig: Object.assign({}, s3ClientConfig, { bucket: bucketName }),
		});

		const tusServer = new Server({ path: '/files', datastore: store, allowedOrigins });

		try {
			// `tus-server` accepts a standard Request-like object; forward the Cloudflare Request
			const resFromServer = await tusServer.handleWeb(request as any);

			// Merge/override CORS headers when origin is allowed
			const headers = new Headers((resFromServer as any).headers || {});
			if (allowedOrigin) {
				headers.set('Access-Control-Allow-Origin', allowedOrigin);
				headers.set('Access-Control-Allow-Methods', 'POST, GET, HEAD, PATCH, DELETE, OPTIONS');
				headers.set('Access-Control-Allow-Headers', request.headers.get('Access-Control-Request-Headers') || 'Upload-Length, Upload-Metadata, Tus-Resumable, Content-Type, Origin, X-Requested-With');
			}

			return new Response((resFromServer as any).body || null, {
				status: (resFromServer as any).status || 200,
				headers,
			});
		} catch (err: any) {
			const msg = String(err?.message || err || 'Unknown error');
			const safeMsg = msg.length > 200 ? msg.slice(0, 197) + '...' : msg;
			const headers = new Headers({ 'Content-Type': 'application/json' });
			if (allowedOrigin) {
				headers.set('Access-Control-Allow-Origin', allowedOrigin);
				headers.set('Access-Control-Allow-Methods', 'POST, GET, HEAD, PATCH, DELETE, OPTIONS');
			}
			headers.set('X-Server-Error', safeMsg);
			return new Response(JSON.stringify({ error: safeMsg }), {
				status: 500,
				headers,
			});
		}
	},
};