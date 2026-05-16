export function isR2Url(url: string): boolean {
	return url.includes('.r2.cloudflarestorage.com') || url.includes('X-Amz-Signature');
}

export function triggerDownload(downloadUrl: string, filename: string): void {
	if (isR2Url(downloadUrl)) {
		window.location.href = downloadUrl;
	} else {
		window.location.href = `/api/proxy-download?url=${encodeURIComponent(downloadUrl)}&name=${encodeURIComponent(filename)}`;
	}
}
