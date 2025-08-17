/* eslint-disable @typescript-eslint/no-explicit-any */
import { uploadSessionDB, generateFileFingerprint, UploadSession } from './indexedDB';
import { UploadQueueManager, QueueStats } from './uploadQueue';

export type UploadStatus = 'queued' | 'uploading' | 'paused' | 'completed' | 'error' | 'canceled';

export interface UploadTaskState {
	id: string;
	file: File;
	fileName: string;
	folder: 'personal' | 'main';
	size: number;
	uploadedBytes: number;
	partsDone: number;
	partsTotal: number;
	speedMbps: number;
	etaSec: number | null;
	status: UploadStatus;
	uploadId?: string;
	key?: string;
	partsEtags: Array<{ PartNumber: number; ETag: string }>;
	errorMessage?: string;
	fileFingerprint?: string;
	queuePosition?: number;
	estimatedWaitTime?: number;
	adaptiveConcurrency?: number; // Nowe pole dla adaptacyjnej równoległości
	networkQuality?: 'slow' | 'medium' | 'fast'; // Jakość sieci
}

export interface UploadManagerEvents {
	onTaskUpdate?: (task: UploadTaskState) => void;
	onTaskComplete?: (task: UploadTaskState) => void;
	onQueueUpdate?: (stats: QueueStats) => void;
}



export class ResumableUploadManager {
	private readonly concurrentParts: number;
	private readonly partSize: number;
	private readonly events: UploadManagerEvents;
	private readonly getAuthHeader: () => Promise<string>;
	private activeTasks: Map<string, UploadTaskState> = new Map();
	private abortControllers: Map<string, AbortController> = new Map();
	private lastSample: Map<string, { time: number; uploadedBytes: number }> = new Map();
	private inflightPartProgress: Map<string, Map<number, number>> = new Map();
	private maxRetries: number = 3;
	private queueManager: UploadQueueManager;
	private networkSpeedHistory: Map<string, number[]> = new Map(); // Historia prędkości sieci
	private readonly maxSpeedHistory = 10; // Maksymalna liczba próbek historii

	constructor(options: { concurrentParts?: number; partSizeBytes?: number; events?: UploadManagerEvents; getAuthHeader: () => Promise<string>; maxConcurrentUploads?: number }) {
		this.concurrentParts = options.concurrentParts ?? 4;
		this.partSize = options.partSizeBytes ?? 8 * 1024 * 1024; // 8MB
		this.events = options.events ?? {};
		this.getAuthHeader = options.getAuthHeader;
		this.queueManager = new UploadQueueManager(options.maxConcurrentUploads ?? 2);
	}

	public getTasks(): UploadTaskState[] {
		return Array.from(this.activeTasks.values());
	}

	public getQueueStats() {
		return this.queueManager.getQueueStats();
	}

	public async enqueue(file: File, folder: 'personal' | 'main'): Promise<UploadTaskState> {
		const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
		const fileFingerprint = await generateFileFingerprint(file);
		
		// Sprawdź czy istnieje sesja dla tego pliku
		const existingSessions = await uploadSessionDB.getSessionsByFingerprint(fileFingerprint);
		const existingSession = existingSessions.find(s => s.folder === folder);
		
		const initial: UploadTaskState = {
			id,
			file,
			fileName: file.name,
			folder,
			size: file.size,
			uploadedBytes: 0,
			partsDone: 0,
			partsTotal: Math.max(1, Math.ceil(file.size / this.partSize)),
			speedMbps: 0,
			etaSec: null,
			status: 'queued',
			partsEtags: [],
			fileFingerprint
		};

		// Jeśli istnieje sesja, wznów upload
		if (existingSession) {
			initial.uploadId = existingSession.uploadId;
			initial.key = existingSession.key;
			initial.partsEtags = existingSession.parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag }));
			initial.partsDone = existingSession.parts.length;
			initial.uploadedBytes = existingSession.parts.reduce((sum, p) => sum + p.size, 0);
			initial.status = 'uploading';
		}

		this.activeTasks.set(id, initial);
		this.persistTask(initial);
		this.emitUpdate(initial);

		// Pobierz userId z tokenu
		let userId: string | undefined;
		try {
			const authHeader = await this.getAuthHeader();
			const token = authHeader.replace('Bearer ', '');
			// Dekoduj token JWT aby pobrać userId (uproszczone)
			const payload = JSON.parse(atob(token.split('.')[1]));
			userId = payload.user_id || payload.sub;
		} catch (error) {
			console.warn('Nie udało się pobrać userId:', error);
		}

		// Dodaj do kolejki z metadanymi
		this.queueManager.addToQueue(id, 0, userId, file.name);
		this.updateQueueInfo(initial);
		
		// Sprawdź czy można uruchomić
		if (this.queueManager.canStartUpload(id)) {
			void this.startUpload(initial);
		}

		return initial;
	}

	public pause(id: string) {
		const task = this.activeTasks.get(id);
		if (!task) return;
		task.status = 'paused';
		this.abortControllers.get(id)?.abort();
		this.emitUpdate(task);
		this.persistTask(task);
	}

	public resume(id: string) {
		const task = this.activeTasks.get(id);
		if (!task || task.status !== 'paused') return;
		task.status = 'uploading';
		this.emitUpdate(task);
		this.persistTask(task);
		void this.startUpload(task);
	}

	public cancel(id: string) {
		const task = this.activeTasks.get(id);
		if (!task) return;
		task.status = 'canceled';
		this.abortControllers.get(id)?.abort();
		// Spróbuj zgłosić abort backendowi
		void (async () => {
			try {
				if (task.uploadId && task.key) {
					const auth = await this.getAuthHeader();
					await fetch('/api/files/multipart/abort', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', Authorization: auth },
						body: JSON.stringify({ key: task.key, uploadId: task.uploadId })
					});
				}
			} catch {}
		})();
		this.emitUpdate(task);
		this.persistTask(task);
		// Usuń z kolejki i sesji
		this.queueManager.removeFromQueue(id);
		void uploadSessionDB.deleteSession(id);
	}

	public remove(id: string) {
		const task = this.activeTasks.get(id);
		if (!task) return;
		
		// Usuń z aktywnych zadań
		this.activeTasks.delete(id);
		this.abortControllers.delete(id);
		
		// Usuń z kolejki
		this.queueManager.removeFromQueue(id);
		
		// Usuń z sesji
		void uploadSessionDB.deleteSession(id);
		
		// Usuń z localStorage
		try {
			localStorage.removeItem(`upload_task_${id}`);
		} catch {}
		
		// Nie emituj zdarzenia - UploadContext sam zaktualizuje stan
	}

	public pauseAll() {
		const activeIds = this.queueManager.pauseAll();
		activeIds.forEach(id => this.pause(id));
	}

	public resumeAll() {
		this.queueManager.resumeAll();
		const pausedTasks = Array.from(this.activeTasks.values()).filter(task => task.status === 'paused');
		pausedTasks.forEach(task => this.resume(task.id));
	}

	public cancelAll() {
		const allIds = this.queueManager.cancelAll();
		allIds.forEach(id => this.cancel(id));
	}

	public changePriority(id: string, priority: number) {
		if (this.queueManager.changePriority(id, priority)) {
			const task = this.activeTasks.get(id);
			if (task) {
				this.updateQueueInfo(task);
				this.emitUpdate(task);
			}
		}
	}

	private updateQueueInfo(task: UploadTaskState) {
		task.queuePosition = this.queueManager.getQueuePosition(task.id);
		task.estimatedWaitTime = this.queueManager.getEstimatedWaitTime(task.id);
	}

	public async resumeAllSessions(): Promise<void> {
		try {
			const sessions = await uploadSessionDB.getAllSessions();
			for (const session of sessions) {
				// Sprawdź czy sesja nie jest zbyt stara (24h)
				if (Date.now() - session.lastActivity > 24 * 60 * 60 * 1000) {
					await uploadSessionDB.deleteSession(session.id);
					continue;
				}
				
				// Spróbuj odzyskać aktualne ETagi z serwera
				let serverParts: Array<{ PartNumber: number; ETag: string }> = [];
				try {
					if (session.uploadId && session.key) {
						const auth = await this.getAuthHeader();
						const response = await fetch('/api/files/multipart/list-parts', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json', Authorization: auth },
							body: JSON.stringify({ key: session.key, uploadId: session.uploadId })
						});
						
						if (response.ok) {
							const { parts } = await response.json();
							serverParts = parts.map((p: any) => ({ 
								PartNumber: p.PartNumber, 
								ETag: p.ETag 
							}));
							console.log(`Odzyskano ${serverParts.length} części z serwera dla sesji ${session.id}`);
						}
					}
				} catch (error) {
					console.warn('Nie udało się odzyskać części z serwera, używam lokalnych:', error);
					// Użyj lokalnych części jako fallback
					serverParts = session.parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag }));
				}
				
				// Utwórz task z sesji (bez pliku - użytkownik musi ponownie wybrać)
				const task: UploadTaskState = {
					id: session.id,
					file: null as any, // Plik nie jest dostępny po odświeżeniu
					fileName: session.fileName,
					folder: session.folder,
					size: session.size,
					uploadedBytes: serverParts.length * this.partSize, // Przybliżone
					partsDone: serverParts.length,
					partsTotal: Math.max(1, Math.ceil(session.size / this.partSize)),
					speedMbps: 0,
					etaSec: null,
					status: 'error',
					uploadId: session.uploadId,
					key: session.key,
					partsEtags: serverParts,
					errorMessage: 'Plik nie jest dostępny po odświeżeniu. Wybierz ponownie.',
					fileFingerprint: session.fileFingerprint
				};
				
				this.activeTasks.set(session.id, task);
				this.emitUpdate(task);
			}
		} catch (error) {
			console.error('Błąd podczas wznawiania sesji:', error);
		}
	}

	private async persistTask(task: UploadTaskState) {
		try {
			// Zapisz do localStorage (dla kompatybilności)
			const key = `upload_task_${task.id}`;
			const serialized = JSON.stringify({ ...task, file: undefined });
			localStorage.setItem(key, serialized);
			
			// Zapisz do IndexedDB jeśli mamy uploadId i key
			if (task.uploadId && task.key && task.fileFingerprint) {
				const session: UploadSession = {
					id: task.id,
					fileFingerprint: task.fileFingerprint,
					fileName: task.fileName,
					folder: task.folder,
					size: task.size,
					key: task.key,
					uploadId: task.uploadId,
					parts: task.partsEtags.map(p => ({
						partNumber: p.PartNumber,
						etag: p.ETag,
						size: Math.min(this.partSize, task.size - (p.PartNumber - 1) * this.partSize),
						uploadedAt: Date.now()
					})),
					createdAt: Date.now(),
					lastActivity: Date.now()
				};
				await uploadSessionDB.saveSession(session);
			}
		} catch (error) {
			console.error('Błąd podczas zapisywania sesji:', error);
		}
	}

	private emitUpdate(task: UploadTaskState) {
		this.events.onTaskUpdate?.(task);
		this.events.onQueueUpdate?.(this.queueManager.getQueueStats());
	}

	private emitComplete(task: UploadTaskState) {
		this.events.onTaskComplete?.(task);
	}

	private sampleSpeed(task: UploadTaskState) {
		const now = Date.now();
		const last = this.lastSample.get(task.id);
		this.lastSample.set(task.id, { time: now, uploadedBytes: task.uploadedBytes });
		if (last) {
			const dtSec = (now - last.time) / 1000;
			if (dtSec > 0) {
				const dBytes = task.uploadedBytes - last.uploadedBytes;
				const mbps = (dBytes * 8) / (dtSec * 1024 * 1024);
				task.speedMbps = Math.max(0, mbps);
				
				// Aktualizuj adaptacyjną równoległość na podstawie prędkości sieci
				task.adaptiveConcurrency = this.calculateAdaptiveConcurrency(task.id, task.speedMbps);
				task.networkQuality = this.getNetworkQuality(task.speedMbps);
				
				const remaining = task.size - task.uploadedBytes;
				task.etaSec = task.speedMbps > 0 ? Math.round((remaining * 8) / (task.speedMbps * 1024 * 1024)) : null;
			}
		}
	}

	private async startUpload(task: UploadTaskState) {
		try {
			// Sprawdź czy można uruchomić upload
			if (!this.queueManager.canStartUpload(task.id)) {
				this.queueManager.addToQueue(task.id);
				this.updateQueueInfo(task);
				this.emitUpdate(task);
				return;
			}

			// Uruchom upload
			if (!this.queueManager.startUpload(task.id)) {
				return;
			}

			task.status = 'uploading';
			this.updateQueueInfo(task);
			this.emitUpdate(task);

			// Hybrydowe podejście: małe pliki przez backend, duże przez presigned URLs
			const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB
			
			if (task.size < LARGE_FILE_THRESHOLD) {
				// Małe pliki: upload przez backend (bezpieczny)
				await this.uploadViaBackend(task);
			} else {
				// Duże pliki: presigned URLs (szybki)
				await this.uploadViaPresignedUrls(task);
			}
		} catch (error) {
			task.status = 'error';
			task.errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
			this.emitUpdate(task);
			this.persistTask(task);
			throw error;
		}
	}

	private async uploadViaBackend(task: UploadTaskState) {
		// Użyj prostego uploadu przez backend API
		const formData = new FormData();
		formData.append('file', task.file);
		formData.append('folder', task.folder);

		const authHeader = await this.getAuthHeader();
		const response = await fetch('/api/files/upload', {
			method: 'POST',
			headers: { Authorization: authHeader },
			body: formData
		});

		if (response.ok) {
			const result = await response.json();
			task.status = 'completed';
			task.uploadedBytes = task.size;
			task.etaSec = 0;
			task.key = result.key;
			this.emitUpdate(task);
			this.persistTask(task);
		} else {
			const errorData = await response.json().catch(() => ({}));
			task.status = 'error';
			task.errorMessage = errorData.error || 'Błąd uploadu';
			this.emitUpdate(task);
			this.persistTask(task);
			throw new Error(task.errorMessage);
		}
	}

	private async uploadViaPresignedUrls(task: UploadTaskState) {
		// Duże pliki: multipart upload z presigned URLs
		try {
			// 1. Inicjuj multipart upload
			const initiateResponse = await fetch('/api/files/multipart/initiate', {
				method: 'POST',
				headers: {
					'Authorization': await this.getAuthHeader(),
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					fileName: task.fileName,
					fileSize: task.size,
					contentType: task.file.type || 'application/octet-stream',
					folder: task.folder
				})
			});

			if (!initiateResponse.ok) {
				const errorData = await initiateResponse.json().catch(() => ({}));
				throw new Error(errorData.error || 'Błąd inicjowania uploadu');
			}

			const { uploadId, key } = await initiateResponse.json();
			task.key = key;

			// 2. Podziel plik na części (5MB każda)
			const PART_SIZE = 5 * 1024 * 1024; // 5MB
			const parts: Array<{ PartNumber: number; ETag: string }> = [];
			const totalParts = Math.ceil(task.size / PART_SIZE);

			for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
				const start = (partNumber - 1) * PART_SIZE;
				const end = Math.min(start + PART_SIZE, task.size);
				const chunk = task.file.slice(start, end);

				// Pobierz presigned URL dla części
				const partUrlResponse = await fetch('/api/files/multipart/part-url', {
					method: 'POST',
					headers: {
						'Authorization': await this.getAuthHeader(),
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						uploadId,
						partNumber,
						key
					})
				});

				if (!partUrlResponse.ok) {
					throw new Error('Błąd pobierania URL dla części');
				}

				const { presignedUrl } = await partUrlResponse.json();

				// Upload części
				const uploadResponse = await fetch(presignedUrl, {
					method: 'PUT',
					body: chunk,
					headers: {
						'Content-Type': task.file.type || 'application/octet-stream'
					}
				});

				if (!uploadResponse.ok) {
					throw new Error(`Błąd uploadu części ${partNumber}`);
				}

				const etag = uploadResponse.headers.get('ETag');
				if (!etag) {
					throw new Error(`Brak ETag dla części ${partNumber}`);
				}

				parts.push({
					PartNumber: partNumber,
					ETag: etag.replace(/"/g, '') // Usuń cudzysłowy
				});

				// Aktualizuj progress
				task.uploadedBytes = end;
				this.emitUpdate(task);
			}

			// 3. Finalizuj upload
			const completeResponse = await fetch('/api/files/multipart/complete', {
				method: 'POST',
				headers: {
					'Authorization': await this.getAuthHeader(),
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					uploadId,
					parts
				})
			});

			if (!completeResponse.ok) {
				const errorData = await completeResponse.json().catch(() => ({}));
				throw new Error(errorData.error || 'Błąd finalizacji uploadu');
			}

			// Upload zakończony sukcesem
			task.status = 'completed';
			task.uploadedBytes = task.size;
			task.etaSec = 0;
			this.emitUpdate(task);
			this.persistTask(task);

		} catch (error) {
			// W przypadku błędu, spróbuj anulować upload
			try {
				if (task.key) {
					await fetch('/api/files/multipart/abort', {
						method: 'POST',
						headers: {
							'Authorization': await this.getAuthHeader(),
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							uploadId: task.key
						})
					});
				}
			} catch (abortError) {
				console.error('Error aborting upload:', abortError);
			}

			task.status = 'error';
			task.errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
			this.emitUpdate(task);
			this.persistTask(task);
			throw error;
		}
	}

	// Nowa metoda do obliczania adaptacyjnej równoległości
	private calculateAdaptiveConcurrency(taskId: string, currentSpeed: number): number {
		const history = this.networkSpeedHistory.get(taskId) || [];
		const avgSpeed = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : currentSpeed;
		
		// Klasyfikacja jakości sieci
		let networkQuality: 'slow' | 'medium' | 'fast';
		if (avgSpeed < 5) { // < 5 Mbps
			networkQuality = 'slow';
		} else if (avgSpeed < 20) { // 5-20 Mbps
			networkQuality = 'medium';
		} else { // > 20 Mbps
			networkQuality = 'fast';
		}

		// Dostosowanie równoległości na podstawie jakości sieci
		let adaptiveConcurrency: number;
		switch (networkQuality) {
			case 'slow':
				adaptiveConcurrency = Math.max(1, Math.min(2, this.concurrentParts / 2));
				break;
			case 'medium':
				adaptiveConcurrency = Math.max(2, Math.min(4, this.concurrentParts));
				break;
			case 'fast':
				adaptiveConcurrency = Math.max(4, Math.min(8, this.concurrentParts * 1.5));
				break;
			default:
				adaptiveConcurrency = this.concurrentParts;
		}

		// Aktualizuj historię prędkości
		history.push(currentSpeed);
		if (history.length > this.maxSpeedHistory) {
			history.shift();
		}
		this.networkSpeedHistory.set(taskId, history);

		return Math.round(adaptiveConcurrency);
	}

	// Nowa metoda do oceny jakości sieci
	private getNetworkQuality(speedMbps: number): 'slow' | 'medium' | 'fast' {
		if (speedMbps < 5) return 'slow';
		if (speedMbps < 20) return 'medium';
		return 'fast';
	}

	// Nowa metoda do eksportu sesji uploadu
	public async exportSessions(): Promise<string> {
		try {
			const sessions = await uploadSessionDB.getAllSessions();
			const exportData = {
				version: '1.0',
				exportedAt: new Date().toISOString(),
				sessions: sessions.map(session => ({
					...session,
					// Usuń wrażliwe dane
					uploadId: undefined,
					key: undefined
				}))
			};
			return JSON.stringify(exportData, null, 2);
		} catch (error) {
			console.error('Błąd podczas eksportu sesji:', error);
			throw new Error('Nie udało się wyeksportować sesji');
		}
	}

	// Nowa metoda do importu sesji uploadu
	public async importSessions(exportData: string): Promise<{ imported: number; errors: string[] }> {
		try {
			const data = JSON.parse(exportData);
			if (!data.version || !data.sessions) {
				throw new Error('Nieprawidłowy format danych eksportu');
			}

			const errors: string[] = [];
			let imported = 0;

			for (const sessionData of data.sessions) {
				try {
					// Sprawdź czy sesja nie jest zbyt stara (7 dni)
					const sessionAge = Date.now() - sessionData.createdAt;
					if (sessionAge > 7 * 24 * 60 * 60 * 1000) {
						errors.push(`Sesja ${sessionData.fileName} jest zbyt stara (${Math.round(sessionAge / (24 * 60 * 60 * 1000))} dni)`);
						continue;
					}

					// Sprawdź czy sesja już istnieje
					const existingSessions = await uploadSessionDB.getSessionsByFingerprint(sessionData.fileFingerprint);
					const existingSession = existingSessions.find(s => s.folder === sessionData.folder);
					
					if (existingSession) {
						errors.push(`Sesja dla pliku ${sessionData.fileName} już istnieje`);
						continue;
					}

					// Utwórz nową sesję z nowym ID
					const newSession: UploadSession = {
						...sessionData,
						id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
						createdAt: Date.now(),
						lastActivity: Date.now(),
						// Resetuj części - użytkownik będzie musiał ponownie wybrać plik
						parts: [],
						uploadId: undefined,
						key: undefined
					};

					await uploadSessionDB.saveSession(newSession);
					imported++;

					// Dodaj do aktywnych zadań jako "error" status
					const task: UploadTaskState = {
						id: newSession.id,
						file: null as any,
						fileName: newSession.fileName,
						folder: newSession.folder,
						size: newSession.size,
						uploadedBytes: 0,
						partsDone: 0,
						partsTotal: Math.max(1, Math.ceil(newSession.size / this.partSize)),
						speedMbps: 0,
						etaSec: null,
						status: 'error',
						partsEtags: [],
						errorMessage: 'Sesja zaimportowana. Wybierz ponownie plik aby wznowić upload.',
						fileFingerprint: newSession.fileFingerprint
					};

					this.activeTasks.set(task.id, task);
					this.emitUpdate(task);

				} catch (sessionError) {
					errors.push(`Błąd importu sesji ${sessionData.fileName}: ${sessionError}`);
				}
			}

			return { imported, errors };
		} catch (error) {
			console.error('Błąd podczas importu sesji:', error);
			throw new Error('Nie udało się zaimportować sesji');
		}
	}

	// Nowa metoda do czyszczenia starych sesji
	public async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
		try {
			const sessions = await uploadSessionDB.getAllSessions();
			const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
			let cleaned = 0;

			for (const session of sessions) {
				if (session.lastActivity < cutoff) {
					await uploadSessionDB.deleteSession(session.id);
					this.activeTasks.delete(session.id);
					cleaned++;
				}
			}

			return cleaned;
		} catch (error) {
			console.error('Błąd podczas czyszczenia sesji:', error);
			return 0;
		}
	}
}
