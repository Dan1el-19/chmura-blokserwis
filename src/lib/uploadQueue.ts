export interface QueueItem {
	id: string;
	priority: number; // Niższa liczba = wyższy priorytet
	addedAt: number;
	estimatedTime?: number; // Szacowany czas w sekundach
}

export interface QueueStats {
	totalInQueue: number;
	activeUploads: number;
	averageWaitTime: number; // Średni czas oczekiwania w sekundach
	estimatedThroughput: number; // MB/s
}

// Helper do logowania akcji kolejki
async function logQueueAction(action: string, taskId: string, userId?: string, fileName?: string, additionalData?: Record<string, unknown>) {
	try {
		const response = await fetch('/api/files/queue-log', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action,
				taskId,
				userId,
				fileName,
				additionalData
			})
		});
		if (!response.ok) {
			console.warn('Nie udało się zalogować akcji kolejki:', action);
		}
	} catch (error) {
		console.warn('Błąd podczas logowania akcji kolejki:', error);
	}
}

export class UploadQueueManager {
	private readonly maxConcurrent: number;
	private queue: QueueItem[] = [];
	private activeUploads: Set<string> = new Set();
	private uploadHistory: Array<{ id: string; startTime: number; endTime: number; size: number }> = [];
	private readonly maxHistorySize = 100;
	private taskMetadata: Map<string, { userId?: string; fileName?: string }> = new Map();

	constructor(maxConcurrent: number = 2) {
		this.maxConcurrent = maxConcurrent;
	}

	public addToQueue(taskId: string, priority: number = 0, userId?: string, fileName?: string): void {
		// Usuń jeśli już w kolejce
		this.queue = this.queue.filter(item => item.id !== taskId);
		
		// Dodaj na odpowiednią pozycję według priorytetu
		const newItem: QueueItem = {
			id: taskId,
			priority,
			addedAt: Date.now()
		};

		const insertIndex = this.queue.findIndex(item => item.priority > priority);
		if (insertIndex === -1) {
			this.queue.push(newItem);
		} else {
			this.queue.splice(insertIndex, 0, newItem);
		}

		// Zapisz metadane
		this.taskMetadata.set(taskId, { userId, fileName });

		// Loguj akcję
		void logQueueAction('queue_added', taskId, userId, fileName, {
			priority,
			queuePosition: this.getQueuePosition(taskId),
			totalInQueue: this.queue.length
		});
	}

	public removeFromQueue(taskId: string): void {
		this.queue = this.queue.filter(item => item.id !== taskId);
		this.activeUploads.delete(taskId);
		this.taskMetadata.delete(taskId);
		void logQueueAction('queue_removed', taskId);
	}

	public canStartUpload(taskId: string): boolean {
		return this.activeUploads.size < this.maxConcurrent || this.activeUploads.has(taskId);
	}

	public startUpload(taskId: string): boolean {
		if (this.canStartUpload(taskId)) {
			this.activeUploads.add(taskId);
			this.removeFromQueue(taskId);
			const metadata = this.taskMetadata.get(taskId);
			void logQueueAction('queue_started', taskId, metadata?.userId, metadata?.fileName, {
				activeUploads: this.activeUploads.size,
				remainingInQueue: this.queue.length
			});
			return true;
		}
		return false;
	}

	public finishUpload(taskId: string, size: number): void {
		this.activeUploads.delete(taskId);
		
		// Dodaj do historii
		const now = Date.now();
		this.uploadHistory.push({
			id: taskId,
			startTime: now - 60000, // Przybliżony czas startu (1 min temu)
			endTime: now,
			size
		});

		// Ogranicz rozmiar historii
		if (this.uploadHistory.length > this.maxHistorySize) {
			this.uploadHistory = this.uploadHistory.slice(-this.maxHistorySize);
		}

		// Sprawdź czy można uruchomić kolejny upload
		this.processQueue();
		
		const metadata = this.taskMetadata.get(taskId);
		void logQueueAction('queue_completed', taskId, metadata?.userId, metadata?.fileName, {
			size,
			duration: 60000, // Przybliżony czas
			activeUploads: this.activeUploads.size
		});
		this.taskMetadata.delete(taskId);
	}

	public getQueuePosition(taskId: string): number {
		return this.queue.findIndex(item => item.id === taskId) + 1;
	}

	public getQueueStats(): QueueStats {
		const now = Date.now();
		const recentUploads = this.uploadHistory.filter(
			upload => now - upload.endTime < 5 * 60 * 1000 // Ostatnie 5 minut
		);

		let totalSize = 0;
		let totalTime = 0;
		recentUploads.forEach(upload => {
			totalSize += upload.size;
			totalTime += (upload.endTime - upload.startTime) / 1000;
		});

		const averageWaitTime = this.queue.length > 0 
			? this.queue.reduce((sum, item) => sum + (now - item.addedAt) / 1000, 0) / this.queue.length
			: 0;

		return {
			totalInQueue: this.queue.length,
			activeUploads: this.activeUploads.size,
			averageWaitTime,
			estimatedThroughput: totalTime > 0 ? totalSize / (1024 * 1024) / totalTime : 0
		};
	}

	public getEstimatedWaitTime(taskId: string): number {
		const position = this.getQueuePosition(taskId);
		if (position === 0) return 0; // Aktywny upload

		const stats = this.getQueueStats();
		const throughput = stats.estimatedThroughput;
		
		if (throughput === 0) return position * 60; // Szacowanie 1 min na plik

		// Szacowany czas = pozycja w kolejce * średni czas uploadu
		return position * (stats.averageWaitTime || 60);
	}

	public changePriority(taskId: string, newPriority: number): boolean {
		const itemIndex = this.queue.findIndex(item => item.id === taskId);
		if (itemIndex === -1) return false;

		const item = this.queue[itemIndex];
		item.priority = newPriority;

		// Przesortuj kolejkę
		this.queue.splice(itemIndex, 1);
		const insertIndex = this.queue.findIndex(qItem => qItem.priority > newPriority);
		if (insertIndex === -1) {
			this.queue.push(item);
		} else {
			this.queue.splice(insertIndex, 0, item);
		}

		return true;
	}

	public pauseAll(): string[] {
		const activeIds = Array.from(this.activeUploads);
		void logQueueAction('queue_pause_all', 'bulk', undefined, undefined, {
			activeUploads: activeIds.length,
			queueSize: this.queue.length
		});
		return activeIds;
	}

	public resumeAll(): void {
		void logQueueAction('queue_resume_all', 'bulk', undefined, undefined, {
			activeUploads: this.activeUploads.size,
			queueSize: this.queue.length
		});
		this.processQueue();
	}

	public cancelAll(): string[] {
		  const allIds = Array.from(this.activeUploads).concat(this.queue.map(item => item.id));
		void logQueueAction('queue_cancel_all', 'bulk', undefined, undefined, {
			activeUploads: this.activeUploads.size,
			queueSize: this.queue.length,
			totalCanceled: allIds.length
		});
		this.queue = [];
		this.activeUploads.clear();
		this.taskMetadata.clear();
		return allIds;
	}

	private processQueue(): void {
		// Uruchom uploady z kolejki jeśli jest miejsce
		while (this.activeUploads.size < this.maxConcurrent && this.queue.length > 0) {
			const nextItem = this.queue.shift();
			if (nextItem) {
				this.activeUploads.add(nextItem.id);
			}
		}
	}

	public getQueueItems(): QueueItem[] {
		return [...this.queue];
	}

	public getActiveUploads(): string[] {
		return Array.from(this.activeUploads);
	}
}
