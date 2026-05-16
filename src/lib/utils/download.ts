export function isR2Url(url: string): boolean {
	return url.includes('.r2.cloudflarestorage.com') || url.includes('X-Amz-Signature');
}

export function isAppwriteDownloadUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return (
			parsed.protocol === 'https:' &&
			parsed.hostname.endsWith('.cloud.appwrite.io') &&
			parsed.pathname.includes('/storage/buckets/') &&
			parsed.pathname.includes('/download')
		);
	} catch {
		return false;
	}
}

export function triggerDownload(downloadUrl: string, filename: string): void {
	if (isR2Url(downloadUrl) || isAppwriteDownloadUrl(downloadUrl)) {
		window.location.href = downloadUrl;
	} else {
		window.location.href = `/api/proxy-download?url=${encodeURIComponent(downloadUrl)}&name=${encodeURIComponent(filename)}`;
	}
}
