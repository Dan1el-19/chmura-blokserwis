const R2_HOST_SUFFIX = '.r2.cloudflarestorage.com';

function getUrl(value: string, label: string): URL {
	try {
		return new URL(value);
	} catch {
		throw new Error(`${label} must be a valid URL`);
	}
}

export function assertR2Endpoint(endpoint: string): void {
	const url = getUrl(endpoint, 'R2_ENDPOINT');
	const labels = url.hostname.split('.');
	const r2Index = labels.indexOf('r2');

	if (url.hostname.endsWith(R2_HOST_SUFFIX) && r2Index !== 1) {
		throw new Error(
			'R2_ENDPOINT must be the account-level R2 endpoint, for example https://<account_id>.r2.cloudflarestorage.com'
		);
	}
}

export function assertPresignedUrlMatchesR2Config(
	presignedUrl: string,
	endpoint: string,
	bucket: string
): void {
	assertR2Endpoint(endpoint);

	const endpointUrl = getUrl(endpoint, 'R2_ENDPOINT');
	const signedUrl = getUrl(presignedUrl, 'R2 presigned URL');
	const expectedHosts = new Set([endpointUrl.hostname, `${bucket}.${endpointUrl.hostname}`]);

	if (!expectedHosts.has(signedUrl.hostname)) {
		throw new Error(
			`R2 presigned URL host "${signedUrl.hostname}" does not match configured R2 bucket "${bucket}" and endpoint "${endpointUrl.hostname}"`
		);
	}
}
