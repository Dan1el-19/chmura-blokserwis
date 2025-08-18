/* eslint-disable @typescript-eslint/no-explicit-any */
import { uploadSessionDB, generateFileFingerprint, UploadSession } from './indexedDB';
import { UploadQueueManager, QueueStats } from './uploadQueue';
import { UploadOptimizer, UploadMetrics, PartSizeStrategy } from './uploadOptimizer';

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
	// Nowe pola dla dynamicznego algorytmu
	uploadMetrics?: UploadMetrics;
	partStrategy?: PartSizeStrategy;
	uploadHistory?: Array<{
		fileSize: number;
		success: boolean;
		duration: number;
		partsCount: number;
		avgPartSize: number;
		timestamp: number;
	}>;
	// Nowe pola dla płynnego progress bar
	smoothProgress?: number; // 0-100, interpolowany
	lastPartUpdateTime?: number;
	partUploadSpeed?: number; // bytes per second
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
	private readonly getAuthHeader: () => Promise<string | null>;
	private activeTasks: Map<string, UploadTaskState> = new Map();
	private abortControllers: Map<string, AbortController> = new Map();
	private lastSample: Map<string, { time: number; uploadedBytes: number }> = new Map();
	private inflightPartProgress: Map<string, Map<number, number>> = new Map();
	private maxRetries: number = 3;
	private queueManager: UploadQueueManager;
	private networkSpeedHistory: Map<string, number[]> = new Map(); // Historia prędkości sieci
	private readonly maxSpeedHistory = 10; // Maksymalna liczba próbek historii
	private uploadHistory: Map<string, UploadTaskState['uploadHistory']> = new Map(); // Historia uploadów
	private smoothProgressTimers: Map<string, NodeJS.Timeout> = new Map(); // Timery dla płynnego progress
	// Throttling: map taskId -> lastEmit timestamp to reduce excessive updates
	private lastEmitAt: Map<string, number> = new Map();
	// Cache presigned URL dla części: key = `${uploadId}:${partNumber}`
	private presignedUrlCache: Map<string, { url: string; expiresAt: number }> = new Map();

	constructor(options: { concurrentParts?: number; partSizeBytes?: number; events?: UploadManagerEvents; getAuthHeader: () => Promise<string | null>; maxConcurrentUploads?: number }) {
		this.concurrentParts = options.concurrentParts ?? 4;
		this.partSize = options.partSizeBytes ?? 8 * 1024 * 1024; // 8MB
		this.events = options.events ?? {};
		this.getAuthHeader = options.getAuthHeader;
		this.queueManager = new UploadQueueManager(options.maxConcurrentUploads ?? 2);
	}

	/**
	 * Oblicza płynny progress na podstawie czasu i prędkości uploadu
	 */
	private calculateSmoothProgress(task: UploadTaskState): number {
		// Dla ukończonych uploadów, zwróć 100%
		if (task.status === 'completed') {
			return 100;
		}

		// Dla uploadów w trakcie, użyj rzeczywistego postępu
		if (task.status === 'uploading') {
			// Oblicz podstawowy progress na podstawie uploadedBytes
			const baseProgress = (task.uploadedBytes / task.size) * 100;
			
			// Jeśli mamy informacje o prędkości uploadu, dodaj interpolację
			if (task.lastPartUpdateTime && task.partUploadSpeed) {
				const now = Date.now();
				const timeSinceLastUpdate = (now - task.lastPartUpdateTime) / 1000; // sekundy
				const estimatedBytesSinceLastUpdate = task.partUploadSpeed * timeSinceLastUpdate;
				const estimatedTotalBytes = task.uploadedBytes + estimatedBytesSinceLastUpdate;
				
				// Nie przekraczaj 100%
				const maxBytes = Math.min(estimatedTotalBytes, task.size);
				return (maxBytes / task.size) * 100;
			}
			
			return baseProgress;
		}

		// Dla innych statusów, zwróć podstawowy progress
		return (task.uploadedBytes / task.size) * 100;
	}

	/**
	 * Uruchamia timer dla płynnego progress
	 */
	private startSmoothProgressTimer(taskId: string): void {
		// Zatrzymaj istniejący timer
		this.stopSmoothProgressTimer(taskId);

		const timer = setInterval(() => {
			const task = this.activeTasks.get(taskId);
			if (!task) {
				this.stopSmoothProgressTimer(taskId);
				return;
			}

			// Kontynuuj tylko dla aktywnych uploadów
			if (task.status === 'uploading' || task.status === 'completed') {
				const smoothProgress = this.calculateSmoothProgress(task);
				task.smoothProgress = smoothProgress;
				this.emitUpdate(task);
			} else if (task.status === 'error' || task.status === 'canceled') {
				// Zatrzymaj timer dla błędów i anulowanych
				this.stopSmoothProgressTimer(taskId);
			}
		}, 300); // Aktualizuj co 300ms by zmniejszyć ilość emitów

		this.smoothProgressTimers.set(taskId, timer);
	}

	/**
	 * Zatrzymuje timer dla płynnego progress
	 */
	private stopSmoothProgressTimer(taskId: string): void {
		const timer = this.smoothProgressTimers.get(taskId);
		if (timer) {
			clearInterval(timer);
			this.smoothProgressTimers.delete(taskId);
		}
	}

	/**
	 * Aktualizuje prędkość uploadu części
	 */
	private updatePartUploadSpeed(task: UploadTaskState, partSize: number, uploadTime: number): void {
		const speed = partSize / (uploadTime / 1000); // bytes per second
		task.partUploadSpeed = speed;
		task.lastPartUpdateTime = Date.now();
	}

	/**
	 * Pobiera historię uploadów dla użytkownika
	 */
	private async getUploadHistory(userId: string): Promise<UploadTaskState['uploadHistory']> {
		if (this.uploadHistory.has(userId)) {
			return this.uploadHistory.get(userId) || [];
		}

		// W przyszłości można pobierać z localStorage lub backend
		const history: UploadTaskState['uploadHistory'] = [];
		this.uploadHistory.set(userId, history);
		return history;
	}

	/**
	 * Oblicza wskaźnik sukcesu na podstawie historii
	 */
	private calculateHistoricalSuccess(history: UploadTaskState['uploadHistory']): number {
		if (!history || history.length === 0) return 0.8; // Domyślna wartość

		const recentHistory = history.slice(-10); // Ostatnie 10 uploadów
		const successful = recentHistory.filter(h => h.success).length;
		return successful / recentHistory.length;
	}

	/**
	 * Zbiera metryki dla uploadu
	 */
	private async collectUploadMetrics(task: UploadTaskState): Promise<UploadMetrics> {
		const systemMetrics = await UploadOptimizer.getSystemMetrics();
		const networkSpeed = await UploadOptimizer.getNetworkSpeed();
		
		// Pobierz userId z tokenu
		let userId: string | undefined;
		try {
			const authHeader = await this.getAuthHeader();
			const token = authHeader?.replace('Bearer ', '');
			const payload = JSON.parse(atob(token?.split('.')[1] || ''));
			userId = payload.user_id || payload.sub;
		} catch (error) {
			console.warn('Nie udało się pobrać userId:', error);
		}

		const history = userId ? await this.getUploadHistory(userId) : [];
		const historicalSuccess = this.calculateHistoricalSuccess(history);

		const metrics: UploadMetrics = {
			fileSize: task.size,
			networkSpeed,
			systemPerformance: systemMetrics.systemPerformance || 0.5,
			historicalSuccess,
			concurrentUploads: this.activeTasks.size,
			fileType: task.file?.type || 'application/octet-stream',
			userAgent: systemMetrics.userAgent
		};

		return metrics;
	}

	/**
	 * Zapisuje historię uploadu
	 */
	private async recordUploadHistory(task: UploadTaskState, success: boolean, duration: number): Promise<void> {
		if (!task.uploadMetrics || !task.partStrategy) return;

		// Pobierz userId z tokenu
		let userId: string | undefined;
		try {
			const authHeader = await this.getAuthHeader();
			const token = authHeader?.replace('Bearer ', '');
			const payload = JSON.parse(atob(token?.split('.')[1] || ''));
			userId = payload.user_id || payload.sub;
		} catch (error) {
			console.warn('Nie udało się pobrać userId dla historii:', error);
			return;
		}

		if (!userId) return;

		const history = await this.getUploadHistory(userId);
		if (!history) return;

		const historyEntry = {
			fileSize: task.size,
			success,
			duration,
			partsCount: task.partStrategy.targetParts,
			avgPartSize: task.partStrategy.partSize,
			timestamp: Date.now()
		};

		history.push(historyEntry);
		
		// Zachowaj tylko ostatnie 50 wpisów
		if (history.length > 50) {
			history.splice(0, history.length - 50);
		}

		this.uploadHistory.set(userId, history);
		console.log('📊 Upload history recorded:', historyEntry);
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

		// Spróbuj zapisać FileSystemHandle dla automatycznego wznowienia (jeśli dostępny i użytkownik zezwoli)
		try {
			// @ts-expect-error navigator.storage jest eksperymentalne
			if (typeof window !== 'undefined' && window?.showOpenFilePicker) {
				// brak bezpośredniego dostępu do handle z File, ale można poprosić o zgodę i podmienić, jeśli plik ten sam
				// to tylko best-effort: użytkownik wskaże plik, który będzie powiązany z fingerprintem
				// pomijamy tu, zostawiamy jako manualny krok w UI (UploadProgressBadge już wspiera wybór pliku)
			}
		} catch {}

		// Pobierz userId z tokenu
		let userId: string | undefined;
		try {
			const authHeader = await this.getAuthHeader();
			const token = authHeader?.replace('Bearer ', '');
			// Dekoduj token JWT aby pobrać userId (uproszczone)
			const payload = JSON.parse(atob(token?.split('.')[1] || ''));
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
						headers: { 'Content-Type': 'application/json', Authorization: auth || '' },
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
		
		// Jeśli upload ma status 'error' i uploadId, spróbuj abort na serwerze
		if (task.status === 'error' && task.uploadId && task.key) {
			void (async () => {
				try {
					const auth = await this.getAuthHeader();
					if (auth) {
						await fetch('/api/files/multipart/abort', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json', Authorization: auth },
							body: JSON.stringify({ key: task.key, uploadId: task.uploadId })
						});
					}
				} catch (error) {
					console.log('Błąd podczas abortowania starych uploadów:', error);
				}
			})();
		}
		
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

	private async cleanupOldErrorSessions(): Promise<void> {
		try {
			// Wyczyść stare sesje z IndexedDB
			const sessions = await uploadSessionDB.getAllSessions();
			const now = Date.now();
			const maxAge = 24 * 60 * 60 * 1000; // 24 godziny
			
			for (const session of sessions) {
				// Usuń sesje starsze niż 24h
				if (now - session.lastActivity > maxAge) {
					console.log(`Usuwam starą sesję: ${session.id}, wiek: ${Math.round((now - session.lastActivity) / (1000 * 60 * 60))}h`);
					await uploadSessionDB.deleteSession(session.id);
					
					// Jeśli sesja ma uploadId, spróbuj abort na serwerze
					if (session.uploadId && session.key) {
						try {
							const auth = await this.getAuthHeader();
							if (auth) {
								await fetch('/api/files/multipart/abort', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json', Authorization: auth },
									body: JSON.stringify({ key: session.key, uploadId: session.uploadId })
								});
							}
						} catch (error) {
							console.log('Błąd podczas abortowania starej sesji:', error);
						}
					}
				}
			}
			
			// Wyczyść stare uploady z localStorage
			try {
				const keys = Object.keys(localStorage);
				const uploadKeys = keys.filter(key => key.startsWith('upload_task_'));
				
				for (const key of uploadKeys) {
					try {
						const taskData = localStorage.getItem(key);
						if (taskData) {
							const task = JSON.parse(taskData);
							const taskAge = now - (task.lastActivity || task.createdAt || 0);
							
							// Usuń stare lub błędne uploady
							if (taskAge > maxAge || task.status === 'error' || task.status === 'canceled') {
								console.log(`Usuwam stary upload z localStorage: ${key}, status: ${task.status}`);
								localStorage.removeItem(key);
							}
						}
						} catch (e) {
							// Jeśli nie można sparsować, usuń klucz
							console.log(`Usuwam nieprawidłowy klucz localStorage: ${key}`, e);
							localStorage.removeItem(key);
						}
				}
			} catch (error) {
					console.log('Błąd podczas czyszczenia localStorage:', error);
			}
		} catch (error) {
			console.log('Błąd podczas czyszczenia starych sesji:', error);
		}
	}

	public async resumeAllSessions(): Promise<void> {
		try {
			// Najpierw wyczyść stare błędne sesje
			await this.cleanupOldErrorSessions();
			
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
						let auth = await this.getAuthHeader();
						// Spróbuj ponownie krótko jeśli auth jeszcze nie jest dostępny
						if (!auth) {
							for (let i = 0; i < 3 && !auth; i++) {
								await new Promise(r => setTimeout(r, 200));
								auth = await this.getAuthHeader();
							}
						}
						// Sprawdź czy użytkownik jest zalogowany
						if (auth) {
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
						} else {
							console.log('Użytkownik nie jest zalogowany, pomijam odzyskiwanie części z serwera');
						}
					}
				} catch (error) {
					console.warn('Nie udało się odzyskać części z serwera, używam lokalnych:', error);
					// Użyj lokalnych części jako fallback
					serverParts = session.parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag }));
				}
				
				// Utwórz task z sesji (bez pliku - użytkownik musi ponownie wybrać)
				// Oblicz uploadedBytes dokładniej na podstawie rozmiarów zapisanych części w IndexedDB
				const sessionParts = session.parts || [];
				const uploadedBytesFromSession = sessionParts.reduce((sum, p) => {
					const partSize = p.size ?? Math.min(this.partSize, session.size - (p.partNumber - 1) * this.partSize);
					return sum + partSize;
				}, 0);
				const uploadedBytes = Math.min(uploadedBytesFromSession, session.size);
				const partsDone = serverParts.length || sessionParts.length;
				const task: UploadTaskState = {
					id: session.id,
					file: null as any, // Plik nie jest dostępny po odświeżeniu (spróbujemy auto-reattach)
					fileName: session.fileName,
					folder: session.folder,
					size: session.size,
					uploadedBytes: uploadedBytes, // Dokładniejsze
					partsDone,
					partsTotal: Math.max(1, Math.ceil(session.size / Math.max(this.partSize, UploadOptimizer.getMinPartSize()))),
					speedMbps: 0,
					etaSec: null,
					status: 'paused', // Docelowo przełączymy na 'uploading' jeśli auto-reattach się powiedzie
					uploadId: session.uploadId,
					key: session.key,
					partsEtags: serverParts,
					errorMessage: 'Plik nie jest dostępny po odświeżeniu. Wybierz ponownie.',
					fileFingerprint: session.fileFingerprint
				};
				
				this.activeTasks.set(session.id, task);
				this.emitUpdate(task);

				// Spróbuj automatycznie podpiąć plik przez FileSystemHandle (jeśli użytkownik wcześniej zezwolił)
				try {
					if (typeof window !== 'undefined') {
						// dynamic import to avoid SSR issues
						const mod = await import('./indexedDB');
						const handle: any = await mod.uploadSessionDB.getFileHandle(session.fileFingerprint);
						if (handle && typeof handle.getFile === 'function') {
							const fileFromHandle: File = await handle.getFile();
							// Podmień plik i rusz upload
							task.file = fileFromHandle as any;
							task.status = 'uploading';
							task.errorMessage = undefined;
							this.emitUpdate(task);
							void this.startUpload(task);
						}
					}
				} catch {
					// cicho ignoruj; fallback zostaje w UI
				}
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
		// Throttle updates to at most one per 250ms per task to avoid HMR/React spam
		const now = Date.now();
		const last = this.lastEmitAt.get(task.id) || 0;
		if (now - last < 250) return;
		this.lastEmitAt.set(task.id, now);
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
		// Use XHR for small-file uploads so we can emit progress and speed updates.
		return await new Promise<void>(async (resolve, reject) => {
			if (!task.file) return reject(new Error('Plik niedostępny'));
			task.status = 'uploading';
			this.startSmoothProgressTimer(task.id);
			this.emitUpdate(task);

			const authHeader = await this.getAuthHeader();
			const xhr = new XMLHttpRequest();
			xhr.open('POST', '/api/files/upload');
			if (authHeader) xhr.setRequestHeader('Authorization', authHeader);

			xhr.upload.onprogress = (ev) => {
				if (ev.lengthComputable) {
					task.uploadedBytes = ev.loaded;
					task.smoothProgress = (ev.loaded / task.size) * 100;
					// sampleSpeed will compute speedMbps based on previous sample stored in lastSample
					this.sampleSpeed(task);
					this.emitUpdate(task);
				}
			};

			xhr.onload = async () => {
				try {
					if (xhr.status >= 200 && xhr.status < 300) {
						const result = JSON.parse(xhr.responseText || '{}');
						task.status = 'completed';
						task.uploadedBytes = task.size;
						task.etaSec = 0;
						task.key = result.key;
						this.stopSmoothProgressTimer(task.id);
						this.emitUpdate(task);
						await this.persistTask(task);
						// Notify completion handlers
						this.emitComplete(task);
						resolve();
					} else {
						const errorData = (() => { try { return JSON.parse(xhr.responseText || '{}'); } catch { return {}; } })();
						task.status = 'error';
						task.errorMessage = errorData.error || `Błąd uploadu: ${xhr.status}`;
						this.stopSmoothProgressTimer(task.id);
						this.emitUpdate(task);
						this.persistTask(task).catch(() => {});
						reject(new Error(task.errorMessage));
					}
				} catch (err) {
					this.stopSmoothProgressTimer(task.id);
					reject(err);
				}
			};

			xhr.onerror = () => {
				task.status = 'error';
				task.errorMessage = 'Błąd sieci podczas uploadu';
				this.stopSmoothProgressTimer(task.id);
				this.emitUpdate(task);
				this.persistTask(task).catch(() => {});
				reject(new Error(task.errorMessage));
			};

			// Prepare form data
			const form = new FormData();
			form.append('file', task.file);
			form.append('folder', task.folder);

			xhr.send(form);
		});
	}

	private async uploadViaPresignedUrls(task: UploadTaskState) {
		// Duże pliki: multipart upload z presigned URLs (bezpośrednio do R2)
		const startTime = Date.now();
		
		try {
			console.log('Starting multipart upload for file:', task.fileName, 'size:', task.size);
			
			// 1. Zbierz metryki i oblicz optymalną strategię
			const metrics = await this.collectUploadMetrics(task);
			const strategy = UploadOptimizer.calculateOptimalPartSize(metrics);
			
			// Zapisz metryki i strategię w task
			task.uploadMetrics = metrics;
			task.partStrategy = strategy;
			
			// Loguj metryki dla analizy
			UploadOptimizer.logMetrics(metrics, strategy);
			
			// Uruchom płynny progress timer
			this.startSmoothProgressTimer(task.id);
			
			// Inicjalizuj smoothProgress
			task.smoothProgress = 0;
			this.emitUpdate(task);
			
			// Ensure file is available (after restore user must re-select file)
			if (!task.file) {
				throw new Error('Plik nie jest dostępny. Wybierz plik ponownie, aby wznowić upload.');
			}

			// 1) Inicjacja multipart uploadu (z retry)
			let initiateResponse: Response | null = null;
			for (let attempt = 1; attempt <= 3; attempt++) {
				initiateResponse = await fetch('/api/files/multipart/initiate', {
				method: 'POST',
				headers: {
					'Authorization': await this.getAuthHeader() || '',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					fileName: task.fileName,
					fileSize: task.size,
					contentType: task.file.type || 'application/octet-stream',
					folder: task.folder
				})
			});
				if (initiateResponse.ok) break;
				await new Promise(r => setTimeout(r, 400 * attempt));
			}

			if (!initiateResponse || !initiateResponse.ok) {
				const errorData = await initiateResponse?.json().catch(() => ({}));
				throw new Error((errorData as any)?.error || 'Błąd inicjowania uploadu');
			}

			const { uploadId, key } = await initiateResponse.json();
			task.uploadId = uploadId;
			task.key = key;
			
			console.log('Multipart upload initiated:', { uploadId, key });

			// Przygotuj rozmiary części
			const PART_SIZE = Math.max(strategy.partSize, UploadOptimizer.getMinPartSize());
			const totalParts = Math.ceil(task.size / PART_SIZE);
			const parts: Array<{ PartNumber: number; ETag: string }> = [];
			
			console.log(`Uploading ${totalParts} parts of ${(PART_SIZE / (1024 * 1024)).toFixed(1)} MB each (confidence: ${(strategy.confidence * 100).toFixed(1)}%)`);

			// Utwórz wspólny AbortController dla pauzy/anulowania
			if (!this.abortControllers.get(task.id)) {
				this.abortControllers.set(task.id, new AbortController());
			}
			const abortController = this.abortControllers.get(task.id)!;

			// Pomocnicza funkcja do pobierania URL i wysyłki jednej części
			const uploadSinglePart = async (partNumber: number) => {
				if (!task.file) throw new Error('Plik niedostępny');
				const start = (partNumber - 1) * PART_SIZE;
				const end = Math.min(start + PART_SIZE, task.size);
				const chunk = task.file.slice(start, end);
				
				let retryCount = 0;
				const maxRetries = 3;
				const partStartTime = Date.now();
				
				while (retryCount < maxRetries) {
					if (task.status === 'canceled' || task.status === 'paused') return Promise.reject(new Error('Upload przerwany'));

					try {
						// a) Pobierz presigned URL dla części z cache lub API
						const cacheKey = `${uploadId}:${partNumber}`;
						const cached = this.presignedUrlCache.get(cacheKey);
						let presignedUrl: string | undefined = undefined;
						if (cached && cached.expiresAt > Date.now()) {
							presignedUrl = cached.url;
						} else {
							const presignResp = await fetch('/api/files/multipart/part-url', {
							method: 'POST',
							headers: {
									'Authorization': await this.getAuthHeader() || '',
									'Content-Type': 'application/json'
								},
								body: JSON.stringify({ uploadId, partNumber, key })
							});

							if (!presignResp.ok) {
								const data = await presignResp.json().catch(() => ({}));
								throw new Error(data.error || `Nie udało się wygenerować URL dla części ${partNumber}`);
							}

							const { presignedUrl: newUrl } = await presignResp.json();
							presignedUrl = newUrl;
							this.presignedUrlCache.set(cacheKey, { url: newUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
						}

						// b) Wyślij część bezpośrednio do R2 przez XHR z onprogress
								const putResp = await new Promise<{ status: number; etag?: string; statusText?: string }>((resolve, reject) => {
									const xhr = new XMLHttpRequest();
									xhr.open('PUT', presignedUrl!);
									xhr.responseType = 'text';
									xhr.setRequestHeader('Content-Type', 'application/octet-stream');
									// capture base uploaded bytes at part start to report in-flight progress
									const baseUploadedForPart = task.uploadedBytes || 0;
									// Postęp wysyłki pojedynczej części
									xhr.upload.onprogress = (ev) => {
										if (ev.lengthComputable) {
											const elapsed = Math.max(1, Date.now() - partStartTime);
											const speed = ev.loaded / (elapsed / 1000); // bytes/sec
											// update part-level speed and timestamps
											task.partUploadSpeed = speed;
											task.lastPartUpdateTime = Date.now();
											// update global uploadedBytes to reflect in-flight progress for UI
											const inFlightUploaded = Math.min(task.size, baseUploadedForPart + ev.loaded);
											task.uploadedBytes = inFlightUploaded;
											task.smoothProgress = (task.uploadedBytes / task.size) * 100;
											// sample speed for higher-level metrics (Mbps) and emit update
											this.sampleSpeed(task);
											this.emitUpdate(task);
										}
									};
							// Obsługa abort z zewnątrz
							const onAbort = () => {
								try { xhr.abort(); } catch {}
								reject(new Error('Upload przerwany'));
							};
							abortController.signal.addEventListener('abort', onAbort, { once: true });
							xhr.onload = () => {
								const etagHeader = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag') || undefined;
								resolve({ status: xhr.status, etag: etagHeader ?? undefined, statusText: xhr.statusText });
								abortController.signal.removeEventListener('abort', onAbort as any);
							};
							xhr.onerror = () => {
								reject(new Error(`Błąd PUT części ${partNumber}: ${xhr.status} ${xhr.statusText}`));
								abortController.signal.removeEventListener('abort', onAbort as any);
							};
							xhr.send(chunk);
						});

						if (putResp.status < 200 || putResp.status >= 300) {
							throw new Error(`Błąd PUT części ${partNumber}: ${putResp.status} ${putResp.statusText || ''}`);
						}

						// c) Pobierz ETag z odpowiedzi. Jeśli brak, użyj fallback list-parts
						let cleanEtag = putResp.etag ? putResp.etag.replace(/"/g, '') : undefined;
						if (!cleanEtag) {
							try {
								const listResp = await fetch('/api/files/multipart/list-parts', {
									method: 'POST',
									headers: {
										'Authorization': await this.getAuthHeader() || '',
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({ key, uploadId })
								});
								if (listResp.ok) {
									const { parts: listed } = await listResp.json();
									const found = Array.isArray(listed) ? listed.find((p: any) => p.PartNumber === partNumber) : null;
									if (found?.ETag) {
										cleanEtag = String(found.ETag).replace(/"/g, '');
									}
								}
							} catch {}
						}
						if (!cleanEtag) {
							throw new Error('Brak ETag w odpowiedzi oraz w list-parts. Skonfiguruj CORS ExposeHeaders: ETag.');
						}

						// Aktualizuj metryki części
						const partEnd = Date.now();
						this.updatePartUploadSpeed(task, chunk.size, partEnd - partStartTime);

						// Zwróć wynik części
						return { PartNumber: partNumber, ETag: cleanEtag, bytes: chunk.size, endOffset: end } as const;
					} catch (err) {
						retryCount++;
						if (retryCount >= maxRetries) throw err instanceof Error ? err : new Error('Nieznany błąd uploadu części');
						await new Promise(r => setTimeout(r, 1000 * retryCount));
					}
				}

				throw new Error(`Nie udało się wysłać części ${partNumber}`);
			};

			// 2) Równoległa wysyłka części z pulą połączeń (adaptacyjnie w trakcie)
			let targetConcurrency = Math.max(1, this.calculateAdaptiveConcurrency(task.id, metrics.networkSpeed));
			let nextPart = 1;
			let completed = 0;
			// liczba aktywnych workerów nieużywana bezpośrednio, ale pozostaje na wypadek przyszłej telemetrii
			const runWorker = async (): Promise<void> => {
				try {
					while (nextPart <= totalParts) {
						const myPart = nextPart++;
						if (task.status === 'canceled' || task.status === 'paused') break;
						const res = await uploadSinglePart(myPart);
						parts.push({ PartNumber: res.PartNumber, ETag: res.ETag });
						// Utrwal lokalnie ETag części do wznowień
						task.partsEtags.push({ PartNumber: res.PartNumber, ETag: res.ETag });
						// Aktualizuj progress
						task.uploadedBytes = Math.max(task.uploadedBytes, res.endOffset);
						task.partsDone = ++completed;
						task.smoothProgress = (task.uploadedBytes / task.size) * 100;
				this.sampleSpeed(task);
						if (res.PartNumber % 3 === 0) {
					this.persistTask(task).catch(() => {});
				}
				this.emitUpdate(task);
			}
				} finally {
					// no-op
				}
			};

			// Uruchom początkowy zestaw workerów
			const workers: Array<Promise<void>> = [];
			for (let i = 0; i < targetConcurrency; i++) {
				workers.push(runWorker());
			}

			// Co pewien czas dostrajaj liczbę workerów (co 2 sekundy)
			const tuner = setInterval(() => {
				if (task.status !== 'uploading') return;
				const desired = this.calculateAdaptiveConcurrency(task.id, task.speedMbps || metrics.networkSpeed);
				if (desired > targetConcurrency) {
					const toAdd = Math.min(2, desired - targetConcurrency);
					for (let i = 0; i < toAdd; i++) {
						workers.push(runWorker());
					}
					targetConcurrency += toAdd;
				}
				// Redukcja następuje naturalnie po zakończeniu workerów (nie tworzymy nowych)
			}, 2000);

			await Promise.all(workers);
			clearInterval(tuner);

			// Zatrzymaj płynny progress timer i ustaw na 100%
			this.stopSmoothProgressTimer(task.id);
			task.smoothProgress = 100;
			this.emitUpdate(task);

			// 3) Finalizacja multipart uploadu (z retry)
			let completeResponse: Response | null = null;
			for (let attempt = 1; attempt <= 3; attempt++) {
				completeResponse = await fetch('/api/files/multipart/complete', {
				method: 'POST',
				headers: {
					'Authorization': await this.getAuthHeader() || '',
					'Content-Type': 'application/json'
				},
					body: JSON.stringify({ uploadId, parts })
				});
				if (completeResponse.ok) break;
				await new Promise(r => setTimeout(r, 400 * attempt));
			}

			if (!completeResponse || !completeResponse.ok) {
				const errorData = await completeResponse?.json().catch(() => ({}));
				throw new Error((errorData as any)?.error || 'Błąd finalizacji uploadu');
			}

			// Upload zakończony sukcesem
			task.status = 'completed';
			task.uploadedBytes = task.size;
			task.etaSec = 0;
			// finalize timers/state and notify
			this.stopSmoothProgressTimer(task.id);
			this.emitUpdate(task);
			await this.persistTask(task);
			this.emitComplete(task);

		} catch (error) {
			// W przypadku błędu, spróbuj anulować upload
			try {
					if (task.uploadId && task.key) {
						await fetch('/api/files/multipart/abort', {
							method: 'POST',
							headers: {
								'Authorization': await this.getAuthHeader() || '',
								'Content-Type': 'application/json'
							},
						body: JSON.stringify({ uploadId: task.uploadId, key: task.key })
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
		} finally {
			const endTime = Date.now();
			const duration = endTime - startTime;
			this.recordUploadHistory(task, task.status === 'completed', duration);
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
