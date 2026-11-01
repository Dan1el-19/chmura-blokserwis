import SparkMD5 from 'spark-md5';

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

self.onmessage = async (event: MessageEvent<Blob>) => {
	const md5 = new SparkMD5.ArrayBuffer();
	try {
		const bytes = await event.data.arrayBuffer();
		md5.append(bytes);
		const sha256 = await crypto.subtle.digest('SHA-256', bytes);
		self.postMessage({
			sha256Hex: bytesToHex(new Uint8Array(sha256)),
			md5Base64: btoa(md5.end(true))
		});
	} catch {
		self.postMessage({ error: 'Nie udało się odczytać części pliku.' });
	} finally {
		md5.destroy();
	}
};
