export function triggerDownload(downloadUrl: string, filename: string): void {
	const anchor = document.createElement('a');
	anchor.href = downloadUrl;
	anchor.download = filename;
	anchor.rel = 'noopener';
	anchor.style.display = 'none';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}
