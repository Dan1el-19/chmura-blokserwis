"use client";
import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { SimpleUploadManager, UploadTaskState } from '@/lib/simpleUpload';
import { QueueStats } from '@/lib/uploadQueue';
import { notificationManager } from '@/lib/notifications';
import { auth } from '@/lib/firebase';
import { MultipartUploadState } from '@/types/multipart';
import { MultipartUploadManager } from '@/lib/multipartUpload';

export interface UploadContextValue {
	uploads: UploadTaskState[];
	multipartUploads: MultipartUploadState[];
	queueStats: QueueStats;
	enqueue: (file: File, folder: 'personal' | 'main', subPath?: string) => Promise<void>;
	enqueueMultipart: (file: File, folder: 'personal' | 'main', subPath?: string) => Promise<void>;
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
	const [multipartUploads, setMultipartUploads] = useState<MultipartUploadState[]>([]);
	const [queueStats, setQueueStats] = useState<QueueStats>({
		totalInQueue: 0,
		activeUploads: 0,
		averageWaitTime: 0,
		estimatedThroughput: 0
	});
	const managerRef = useRef<SimpleUploadManager | null>(null);
	const multipartManagerRef = useRef<MultipartUploadManager | null>(null);



	const value = useMemo<UploadContextValue>(() => {
		if (!managerRef.current) {
			managerRef.current = new SimpleUploadManager({
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

		// Inicjalizuj MultipartUploadManager jeśli nie istnieje
		if (!multipartManagerRef.current) {
			multipartManagerRef.current = new MultipartUploadManager();
		}

		return {
			uploads,
			multipartUploads,
			queueStats,
			enqueue: async (file, folder, subPath) => {
				await managerRef.current!.enqueue(file, folder, subPath);
			},
			enqueueMultipart: async (file, folder, subPath) => {
				try {
					const handle = await multipartManagerRef.current!.createUpload(file, folder, subPath);
					
					// Dodaj do stanu
					const uploadState: MultipartUploadState = {
						id: handle.id,
						uploadId: handle.uploadId,
						key: handle.key,
						fileName: handle.fileName,
						fileSize: handle.fileSize,
						folder: handle.folder,
						subPath: handle.subPath,
						status: handle.status,
						parts: handle.parts || [],
						createdAt: new Date(),
						updatedAt: new Date(),
						progress: handle.progress,
						bytesUploaded: handle.bytesUploaded,
						speed: handle.speed,
						etaSec: handle.etaSec,
						errorMessage: handle.errorMessage
					};
					
					setMultipartUploads(prev => {
						const newState = [...prev, uploadState];
						return newState;
					});
					
					// Ustaw callbacki dla handle
					handle.onProgress = (progress, bytesUploaded, speed) => {
						setMultipartUploads(prev => prev.map(upload => 
							upload.id === handle.id 
								? { ...upload, progress, bytesUploaded, speed, updatedAt: new Date() }
								: upload
						));
					};
					
					handle.onStatusChange = (status) => {
						setMultipartUploads(prev => prev.map(upload => 
							upload.id === handle.id 
								? { ...upload, status, updatedAt: new Date() }
								: upload
						));
					};
					
					handle.onError = (errorMessage) => {
						setMultipartUploads(prev => prev.map(upload => 
							upload.id === handle.id 
								? { ...upload, status: 'error', errorMessage, updatedAt: new Date() }
								: upload
						));
						void notificationManager.notifyUploadError(handle.fileName, errorMessage);
					};
					
					handle.onComplete = () => {
						setMultipartUploads(prev => prev.map(upload => 
							upload.id === handle.id 
								? { ...upload, status: 'completed', progress: 100, updatedAt: new Date() }
								: upload
						));
						void notificationManager.notifyUploadComplete(handle.fileName);
						onUploadComplete?.();
						
						// Automatycznie usuń ukończony upload po 3 sekundach
						setTimeout(() => {
							setMultipartUploads(prev => prev.filter(upload => upload.id !== handle.id));
						}, 3000);
					};
					
				} catch (error) {
					console.error('Error creating multipart upload:', error);
					void notificationManager.notifyUploadError(file.name, error instanceof Error ? error.message : 'Unknown error');
				}
			},
			pause: (id) => {
				// Sprawdź czy to multipart upload
				const multipartUpload = multipartUploads.find(u => u.id === id);
				if (multipartUpload) {
					// TODO: Implement multipart pause
					console.log('Pausing multipart upload:', id);
					multipartManagerRef.current?.pauseUpload?.(id);
				} else {
					// Simple upload
					managerRef.current!.pause(id);
				}
			},
			resume: (id) => {
				// Sprawdź czy to multipart upload
				const multipartUpload = multipartUploads.find(u => u.id === id);
				if (multipartUpload) {
					// TODO: Implement multipart resume
					console.log('Resuming multipart upload:', id);
					multipartManagerRef.current?.resumeUpload?.(id);
				} else {
					// Simple upload
					managerRef.current!.resume(id);
				}
			},
			cancel: (id) => {
				// Sprawdź czy to multipart upload
				const multipartUpload = multipartUploads.find(u => u.id === id);
				if (multipartUpload) {
					console.log('Cancelling multipart upload:', id);
					multipartManagerRef.current?.abortUpload(id);
					// Usuń ze stanu
					setMultipartUploads(prev => prev.filter(upload => upload.id !== id));
				} else {
					// Simple upload
					managerRef.current!.cancel(id);
				}
			},
			remove: (id) => {
				// Sprawdź czy to multipart upload
				const multipartUpload = multipartUploads.find(u => u.id === id);
				if (multipartUpload) {
					console.log('Removing multipart upload:', id);
					multipartManagerRef.current?.removeUpload(id);
					// Usuń ze stanu
					setMultipartUploads(prev => prev.filter(upload => upload.id !== id));
				} else {
					// Simple upload
					managerRef.current!.remove(id);
					// Usuń ze stanu lokalnego
					setUploads((prev) => prev.filter(upload => upload.id !== id));
				}
			},
			pauseAll: () => managerRef.current!.pauseAll(),
			resumeAll: () => managerRef.current!.resumeAll(),
			cancelAll: () => managerRef.current!.cancelAll(),
			changePriority: (id, priority) => managerRef.current!.changePriority(id, priority),
			exportSessions: () => managerRef.current!.exportSessions(),
			importSessions: () => managerRef.current!.importSessions(),
			cleanupOldSessions: () => managerRef.current!.cleanupOldSessions()
		};
	}, [uploads, multipartUploads, queueStats, onUploadComplete]);

	// Uproszczony system - bez wznawiania sesji

	return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUpload() {
	const ctx = useContext(UploadContext);
	if (!ctx) throw new Error('useUpload must be used within UploadProvider');
	return ctx;
}
