"use client";
import React, { createContext, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { ResumableUploadManager, UploadTaskState } from '@/lib/resumableUpload';
import { QueueStats } from '@/lib/uploadQueue';
import { notificationManager } from '@/lib/notifications';
import { auth } from '@/lib/firebase';

interface UploadContextValue {
	uploads: UploadTaskState[];
	queueStats: QueueStats;
	enqueue: (file: File, folder: 'personal' | 'main') => Promise<void>;
	pause: (id: string) => void;
	resume: (id: string) => void;
	cancel: (id: string) => void;
	remove: (id: string) => void;
	pauseAll: () => void;
	resumeAll: () => void;
	cancelAll: () => void;
	changePriority: (id: string, priority: number) => void;
	exportSessions: () => Promise<string>;
	importSessions: (exportData: string) => Promise<{ imported: number; errors: string[] }>;
	cleanupOldSessions: (maxAgeHours?: number) => Promise<number>;
	onUploadComplete?: () => void;
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

export function UploadProvider({ children, onUploadComplete }: { children: React.ReactNode; onUploadComplete?: () => void }) {
	const [uploads, setUploads] = useState<UploadTaskState[]>([]);
	const [queueStats, setQueueStats] = useState<QueueStats>({
		totalInQueue: 0,
		activeUploads: 0,
		averageWaitTime: 0,
		estimatedThroughput: 0
	});
	const managerRef = useRef<ResumableUploadManager | null>(null);



	const value = useMemo<UploadContextValue>(() => {
		if (!managerRef.current) {
			managerRef.current = new ResumableUploadManager({
				getAuthHeader: async () => {
					const user = auth.currentUser;
					if (!user) {
						return null; // Użytkownik nie jest zalogowany
					}
					try {
						const token = await user.getIdToken();
						return `Bearer ${token}`;
					} catch (error) {
						console.error('Błąd podczas pobierania tokenu:', error);
						return null;
					}
				},
				maxConcurrentUploads: 2,
				events: {
					onTaskUpdate: (task) => {
						setUploads((prev) => {
							const map = new Map(prev.map(u => [u.id, u]));
							map.set(task.id, task);
							return Array.from(map.values());
						});
						
						// Wysyłaj notification o postępie
						if (task.status === 'completed') {
							void notificationManager.notifyUploadComplete(task.fileName);
							// Automatycznie usuń ukończony upload po 3 sekundach
							setTimeout(() => {
								setUploads((prev) => prev.filter(upload => upload.id !== task.id));
							}, 3000);
							// Odśwież listę plików
							onUploadComplete?.();
						} else if (task.status === 'error') {
							void notificationManager.notifyUploadError(task.fileName, task.errorMessage || 'Nieznany błąd');
						}
					},
					onTaskComplete: (task) => {
						setUploads((prev) => prev.map(u => (u.id === task.id ? task : u)));
						
						// Wysyłaj notification o zakończeniu
						void notificationManager.notifyUploadComplete(task.fileName);
						
						// Automatycznie usuń ukończony upload po 3 sekundach
						setTimeout(() => {
							setUploads((prev) => prev.filter(upload => upload.id !== task.id));
						}, 3000);
						
						// Odśwież listę plików
						onUploadComplete?.();
					},
					onQueueUpdate: (stats: QueueStats) => {
						setQueueStats(stats);
					}
				}
			});
		}
		return {
			uploads,
			queueStats,
			enqueue: async (file, folder) => {
				await managerRef.current!.enqueue(file, folder);
			},
			pause: (id) => managerRef.current!.pause(id),
			resume: (id) => managerRef.current!.resume(id),
			cancel: (id) => managerRef.current!.cancel(id),
			remove: (id) => {
				// Usuń z managera
				managerRef.current!.remove(id);
				// Usuń ze stanu lokalnego
				setUploads((prev) => prev.filter(upload => upload.id !== id));
			},
			pauseAll: () => managerRef.current!.pauseAll(),
			resumeAll: () => managerRef.current!.resumeAll(),
			cancelAll: () => managerRef.current!.cancelAll(),
			changePriority: (id, priority) => managerRef.current!.changePriority(id, priority),
			exportSessions: () => managerRef.current!.exportSessions(),
			importSessions: (exportData) => managerRef.current!.importSessions(exportData),
			cleanupOldSessions: (maxAgeHours) => managerRef.current!.cleanupOldSessions(maxAgeHours)
		};
	}, [uploads, queueStats, onUploadComplete]);

	// Auto-wznawianie sesji po załadowaniu strony
	useEffect(() => {
		if (managerRef.current) {
			void managerRef.current.resumeAllSessions();
		}
	}, []);

	// Czyszczenie starych uploadów przy starcie
	useEffect(() => {
		if (managerRef.current) {
			// Usuń stare błędne uploady ze stanu lokalnego
			setUploads((prev) => {
				const now = Date.now();
				const maxAge = 24 * 60 * 60 * 1000; // 24 godziny
				
				return prev.filter(upload => {
					const uploadAge = now - (upload.lastPartUpdateTime || 0);
					const shouldKeep = uploadAge <= maxAge && upload.status !== 'error' && upload.status !== 'canceled';
					
					if (!shouldKeep) {
						console.log(`Usuwam stary upload ze stanu: ${upload.fileName}, status: ${upload.status}`);
					}
					
					return shouldKeep;
				});
			});
		}
	}, []);

	return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUpload() {
	const ctx = useContext(UploadContext);
	if (!ctx) throw new Error('useUpload must be used within UploadProvider');
	return ctx;
}
