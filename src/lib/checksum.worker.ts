import { calculateMd5InChunks } from './checksum.js';

self.onmessage = async (event: MessageEvent<Blob>) => {
	try {
		const digest = await calculateMd5InChunks(event.data, {
			onProgress: (progress) => self.postMessage({ progress })
		});
		self.postMessage({ digest });
	} catch {
		self.postMessage({ error: 'Nie udało się odczytać pliku do przesłania.' });
	}
};
