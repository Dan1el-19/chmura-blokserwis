export interface UploadSession {
	id: string;
	fileFingerprint: string;
	fileName: string;
	folder: 'personal' | 'main';
	subPath?: string; // nested relative path inside folder space (e.g. "docs/reports")
	size: number;
	key: string;
	uploadId: string;
	parts: Array<{
		partNumber: number;
		etag: string;
		size: number;
		uploadedAt: number;
	}>;
	createdAt: number;
	lastActivity: number;
}

class UploadSessionDB {
	private dbName = 'uploadSessions';
	private version = 3; // bump for subPath field (no new indexes required)
	private db: IDBDatabase | null = null;

	async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.version);
			
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};
			
			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains('sessions')) {
					const store = db.createObjectStore('sessions', { keyPath: 'id' });
					store.createIndex('fileFingerprint', 'fileFingerprint', { unique: false });
					store.createIndex('uploadId', 'uploadId', { unique: false });
				}
				// Nowy store do przechowywania uchwytów plików (opcjonalne autowznawianie)
				if (!db.objectStoreNames.contains('handles')) {
					db.createObjectStore('handles', { keyPath: 'fingerprint' });
				}
			};
		});
	}

	async saveSession(session: UploadSession): Promise<void> {
		if (!this.db) await this.init();
		
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['sessions'], 'readwrite');
			const store = transaction.objectStore('sessions');
			const request = store.put(session);
			
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async getSession(id: string): Promise<UploadSession | null> {
		if (!this.db) await this.init();
		
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['sessions'], 'readonly');
			const store = transaction.objectStore('sessions');
			const request = store.get(id);
			
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result || null);
		});
	}

	async getSessionsByFingerprint(fingerprint: string): Promise<UploadSession[]> {
		if (!this.db) await this.init();
		
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['sessions'], 'readonly');
			const store = transaction.objectStore('sessions');
			const index = store.index('fileFingerprint');
			const request = index.getAll(fingerprint);
			
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result || []);
		});
	}

	async getAllSessions(): Promise<UploadSession[]> {
		if (!this.db) await this.init();
		
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['sessions'], 'readonly');
			const store = transaction.objectStore('sessions');
			const request = store.getAll();
			
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result || []);
		});
	}

	async deleteSession(id: string): Promise<void> {
		if (!this.db) await this.init();
		
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(['sessions'], 'readwrite');
			const store = transaction.objectStore('sessions');
			const request = store.delete(id);
			
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	// Zapis/odczyt FileSystemHandle powiązanego z fingerprintem pliku
	async saveFileHandle(fingerprint: string, handle: unknown): Promise<void> {
		if (!this.db) await this.init();
		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(['handles'], 'readwrite');
			const store = tx.objectStore('handles');
			const req = store.put({ fingerprint, handle });
			req.onsuccess = () => resolve();
			req.onerror = () => reject(req.error);
		});
	}

	async getFileHandle(fingerprint: string): Promise<unknown | null> {
		if (!this.db) await this.init();
		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(['handles'], 'readonly');
			const store = tx.objectStore('handles');
			const req = store.get(fingerprint);
			req.onsuccess = () => resolve(req.result?.handle || null);
			req.onerror = () => reject(req.error);
		});
	}

	async deleteFileHandle(fingerprint: string): Promise<void> {
		if (!this.db) await this.init();
		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(['handles'], 'readwrite');
			const store = tx.objectStore('handles');
			const req = store.delete(fingerprint);
			req.onsuccess = () => resolve();
			req.onerror = () => reject(req.error);
		});
	}

	async cleanupOldSessions(maxAgeHours: number = 24): Promise<void> {
		const sessions = await this.getAllSessions();
		const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
		
		for (const session of sessions) {
			if (session.lastActivity < cutoff) {
				await this.deleteSession(session.id);
			}
		}
	}
}

export const uploadSessionDB = new UploadSessionDB();

// Helper do generowania fingerprint pliku
export async function generateFileFingerprint(file: File): Promise<string> {
	// Sprawdź czy crypto.subtle jest dostępne (wymaga HTTPS)
	if (typeof crypto !== 'undefined' && crypto.subtle) {
		try {
			const buffer = await file.arrayBuffer();
			const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
			return `${file.name}_${file.size}_${hashHex.slice(0, 16)}`;
		} catch (error) {
			console.warn('Crypto.subtle failed, using fallback fingerprint:', error);
		}
	}
	
	// Fallback dla środowisk HTTP lub gdy crypto.subtle nie działa
	const timestamp = Date.now();
	const randomId = Math.random().toString(36).substring(2, 15);
	return `${file.name}_${file.size}_${timestamp}_${randomId}`;
}
