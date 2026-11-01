import { SvelteMap } from 'svelte/reactivity';
import { create } from '@bufbuild/protobuf';
import { uploads } from './api.js';
import { StorageLocation } from './gen/unisourcecfl/catalog/v1/catalog_pb.js';
import {
	CancelUploadRequestSchema,
	CompleteUploadRequestSchema,
	CreateUploadRequestSchema,
	GetUploadRequestSchema,
	RetryUploadRequestSchema,
	UploadFailureKind,
	UploadMode,
	UploadState,
	type UploadSession,
	type UploadTarget
} from './gen/unisourcecfl/upload/v1/upload_pb.js';
import {
	calculateMd5Base64,
	UploadTransportError,
	UploadTargetError,
	uploadToTarget,
	validateUploadSize
} from './upload.js';
import { storageErrorMessage } from './storage-error.js';
import {
	MultipartAccountChangedError,
	MultipartController,
	MultipartFileMismatchError,
	type MultipartProgressEvent
} from './multipart/controller.js';
import { canCreateMultipartUpload, type MultipartCapabilities } from './multipart/protocol.js';
import type { PersistedMultipartSession } from './multipart/session-store.js';

export type UploadDestination = {
	spaceId: string;
	parentId?: string;
	mode: UploadMode;
	label: string;
};
export type UploadTask = {
	id: string;
	name: string;
	sizeBytes: number;
	target: UploadDestination;
	file?: File;
	controller?: AbortController;
	multipartLocalId?: string;
	multipartVerifying?: boolean;
	multipartPartProgress?: Record<number, number>;
	phase:
		| 'queued'
		| 'needsFile'
		| 'paused'
		| 'checksum'
		| 'preparing'
		| 'uploading'
		| 'retrying'
		| 'finalizing'
		| 'verifying'
		| 'done'
		| 'cancelled'
		| 'error';
	progress: number;
	storageLocation?: StorageLocation;
	error?: string;
};
const terminal = (task: UploadTask) => ['done', 'cancelled', 'error'].includes(task.phase);

export class UploadManager {
	tasks = $state<UploadTask[]>([]);
	collapsed = $state(false);
	private processing = false;
	private generation = 0;
	private restoreVersion = 0;
	private capabilities?: MultipartCapabilities;
	private completedTimers = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	private readonly unsubscribeMultipartProgress?: () => void;
	constructor(
		private onComplete: (target: UploadDestination) => void,
		private readonly multipart?: MultipartController
	) {
		this.unsubscribeMultipartProgress = multipart?.subscribeProgress((event) => this.onMultipartProgress(event));
	}
	get pendingCount(): number {
		return this.tasks.filter((task) => !terminal(task)).length;
	}
	setMultipartCapabilities(capabilities: MultipartCapabilities | undefined): void {
		this.capabilities = capabilities;
		this.multipart?.setCapabilities(capabilities);
	}
	setAccountId(ownerId: string): void {
		this.multipart?.setAccountId(ownerId || 'signed-out');
		const version = ++this.restoreVersion;
		const generation = this.generation;
		if (!ownerId || !this.multipart) return;
		void this.multipart.listSessions().then((sessions) => {
			if (version !== this.restoreVersion || generation !== this.generation) return;
			for (const session of sessions) this.restoreSession(session);
			if (this.tasks.some((task) => task.multipartVerifying && task.phase === 'queued')) void this.process();
		}).catch(() => {
			// IndexedDB is optional; no server upload has started until a user selects a file.
		});
	}
	enqueue(files: File[], target: UploadDestination, maxBytes: number): void {
		const tasks = files.map((file) => {
			const id = crypto.randomUUID();
			const multipartEligible = canCreateMultipartUpload(this.capabilities, file.size);
			return {
				id,
				name: file.name,
				sizeBytes: file.size,
				target: { ...target },
				file,
				...(multipartEligible ? { multipartLocalId: id } : {}),
				phase: 'queued' as UploadTask['phase'],
				progress: 0
			};
		});
		for (const task of tasks) {
			const file = task.file!;
			const multipartEligible = canCreateMultipartUpload(this.capabilities, file.size);
			if (!multipartEligible && !validateUploadSize(file.size, maxBytes)) {
				task.phase = 'error';
				Object.assign(task, {
					error: `Pojedynczy plik może mieć maksymalnie ${maxBytes < 1000 ? `${maxBytes} B` : `${new Intl.NumberFormat('pl-PL').format(maxBytes / 1_000_000)} MB`}.`
				});
				Object.assign(task, { file: undefined });
			}
		}
		this.tasks.push(...tasks);
		this.collapsed = false;
		void this.process();
	}
	resume(id: string, file?: File): void {
		const task = this.tasks.find((item) => item.id === id);
		if (!task || !task.multipartLocalId || task.phase === 'done' || task.phase === 'cancelled') return;
		if (file) task.file = file;
		if (task.multipartVerifying) {
			task.phase = 'queued';
		} else if (task.file) {
			task.phase = 'queued';
			task.error = undefined;
		} else {
			task.phase = 'needsFile';
			return;
		}
		void this.process();
	}
	pause(id: string): void {
		const task = this.tasks.find((item) => item.id === id);
		if (!task || !task.multipartLocalId || terminal(task)) return;
		task.phase = 'paused';
		void this.multipart?.pause(task.multipartLocalId);
	}
	cancel(id: string): void {
		const task = this.tasks.find((task) => task.id === id);
		if (!task || task.phase === 'done' || task.phase === 'cancelled' || (task.phase === 'error' && !task.multipartLocalId)) return;
		if (task.multipartLocalId && this.multipart) {
			task.phase = 'cancelled';
			task.file = undefined;
			void this.multipart.cancel(task.multipartLocalId).catch((error: unknown) => {
				// A timeout during cancellation does not prove that the server did not
				// create or cancel the session. Keep the queue item recoverable so the
				// owner can reselect the file and reconcile it with the same request ID.
				task.phase = 'needsFile';
				task.error = storageErrorMessage(error);
			});
			return;
		}
		if (task.controller) task.controller.abort();
		else {
			task.phase = 'cancelled';
			task.file = undefined;
		}
	}
	cancelAll(): void {
		for (const task of this.tasks) this.cancel(task.id);
	}
	clearFinished(): void {
		for (const task of this.tasks) {
			if (terminal(task)) {
				clearTimeout(this.completedTimers.get(task.id));
				this.completedTimers.delete(task.id);
			}
		}
		this.tasks = this.tasks.filter((task) => !terminal(task));
	}
	reset(): void {
		for (const task of this.tasks) {
			if (task.multipartLocalId) {
				void this.multipart?.pause(task.multipartLocalId);
				task.file = undefined;
				task.controller?.abort();
			} else this.cancel(task.id);
		}
		for (const timer of this.completedTimers.values()) clearTimeout(timer);
		this.completedTimers.clear();
		this.generation++;
		this.restoreVersion++;
		this.processing = false;
		this.tasks = [];
	}
	private async process(): Promise<void> {
		if (this.processing) return;
		this.processing = true;
		const generation = this.generation;
		try {
			let task: UploadTask | undefined;
			while (
				generation === this.generation &&
				(task = this.tasks.find((task) => task.phase === 'queued'))
			)
				await this.run(task);
		} finally {
			if (generation === this.generation) this.processing = false;
		}
	}
	private restoreSession(session: PersistedMultipartSession): void {
		if (['completed', 'cancelled'].includes(session.phase) || this.tasks.some((task) => task.multipartLocalId === session.localId)) return;
		const verifying = session.phase === 'verifying';
		this.tasks.push({
			id: session.localId,
			name: session.name,
			sizeBytes: session.sizeBytes,
			target: {
				spaceId: session.spaceId,
				...(session.parentId ? { parentId: session.parentId } : {}),
				mode: session.uploadMode,
				label: session.spaceId
			},
			multipartLocalId: session.localId,
			multipartVerifying: verifying,
			phase: verifying ? 'queued' : 'needsFile',
			progress: verifying ? 99 : 0,
			...(session.phase === 'failed' ? { error: 'Sesja wymaga ponownego wyboru pliku lub anulowania.' } : {})
		});
		this.collapsed = false;
	}
	private onMultipartProgress(event: MultipartProgressEvent): void {
		const task = this.tasks.find((item) => item.multipartLocalId === event.localId);
		if (!task) return;
		if (event.reset) {
			task.multipartPartProgress = {};
			task.progress = 0;
			return;
		}
		if (event.partNumber === undefined || event.loaded === undefined || event.total === undefined) return;
		if (task.phase === 'preparing' || task.phase === 'queued') task.phase = 'uploading';
		if (!task.multipartPartProgress) task.multipartPartProgress = {};
		const parts = task.multipartPartProgress;
		parts[event.partNumber] = Math.min(event.total, Math.max(0, event.loaded));
		const sentBytes = Object.values(parts).reduce((sum, loaded) => sum + loaded, 0);
		task.progress = Math.min(99, Math.floor((sentBytes / task.sizeBytes) * 100));
	}
	private async runMultipart(task: UploadTask): Promise<void> {
		if (!this.multipart || !task.multipartLocalId) {
			task.phase = 'error';
			task.error = 'Multipart transfer controller is unavailable.';
			return;
		}
		const generation = this.generation;
		if (task.multipartVerifying) {
			await this.watchMultipartVerification(task, generation);
			return;
		}
		const file = task.file;
		if (!file) {
			task.phase = 'needsFile';
			return;
		}
		task.sizeBytes = file.size;
		task.name = file.name;
		task.phase = 'preparing';
		task.error = undefined;
		try {
			const session = await this.multipart.start(file, task.target, task.target.mode, task.multipartLocalId);
			if (generation !== this.generation) return;
			const currentPhase = task.phase as UploadTask['phase'];
			if (currentPhase === 'paused' || currentPhase === 'cancelled') return;
			if (session.phase === 'verifying') {
				task.multipartVerifying = true;
				task.file = undefined;
				task.phase = 'verifying';
				task.progress = 99;
				await this.watchMultipartVerification(task, generation);
				return;
			}
			if (session.phase !== 'completed') throw new Error(`Multipart session is ${session.phase}.`);
			this.finishMultipartTask(task, generation);
		} catch (error) {
			const currentPhase = task.phase as UploadTask['phase'];
			if (generation !== this.generation || currentPhase === 'cancelled' || currentPhase === 'paused') return;
			if (error instanceof MultipartAccountChangedError) return;
			if (error instanceof MultipartFileMismatchError) {
				task.phase = 'needsFile';
				task.file = undefined;
				task.error = 'Wybrany plik nie odpowiada zapisanej sesji. Wybierz właściwy plik, aby ją wznowić.';
				return;
			}
			task.phase = 'error';
			task.error = storageErrorMessage(error);
		}
	}
	private async watchMultipartVerification(task: UploadTask, generation: number): Promise<void> {
		if (!this.multipart || !task.multipartLocalId) return;
		task.phase = 'verifying';
		task.progress = 99;
		while (generation === this.generation && task.phase === 'verifying') {
			try {
				const session = await this.multipart.refreshSession(task.multipartLocalId);
				if (generation !== this.generation || task.phase !== 'verifying') return;
				if (session.phase === 'completed') {
					this.finishMultipartTask(task, generation);
					return;
				}
				if (session.phase === 'failed' || session.phase === 'cancelled') throw new Error(`Multipart session is ${session.phase}.`);
			} catch (error) {
				if (generation !== this.generation || task.phase !== 'verifying') return;
				task.phase = 'error';
				task.error = storageErrorMessage(error);
				return;
			}
			await new Promise<void>((resolve) => setTimeout(resolve, 1500));
		}
	}
	private finishMultipartTask(task: UploadTask, generation: number): void {
		task.phase = 'done';
		task.progress = 100;
		task.file = undefined;
		task.multipartVerifying = false;
		task.error = undefined;
		this.onComplete(task.target);
		this.completedTimers.set(task.id, setTimeout(() => {
			this.completedTimers.delete(task.id);
			if (generation === this.generation) this.tasks = this.tasks.filter((item) => item.id !== task.id);
		}, 5000));
	}
	private async run(task: UploadTask): Promise<void> {
		if (task.multipartLocalId) {
			await this.runMultipart(task);
			return;
		}
		const file = task.file;
		if (!file) {
			task.phase = 'needsFile';
			return;
		}
		const {
			spaceId: targetSpaceId,
			parentId: targetParentId,
			mode: targetUploadMode
		} = task.target;
		const generation = this.generation;
		const controller = new AbortController();
		task.controller = controller;
		let uploadId = '';
		let activeAttemptId = '';
		let cancellation: Promise<unknown> | undefined;
		const cancelSession = () => {
			if (generation === this.generation && uploadId && !cancellation) {
				cancellation = uploads.cancelUpload(create(CancelUploadRequestSchema, { uploadId }));
				// The error is reported below once the active operation settles.
				void cancellation.catch(() => {});
			}
		};
		const checkCancelled = () => {
			if (controller.signal.aborted || generation !== this.generation)
				throw new DOMException('Upload anulowany.', 'AbortError');
		};
		const checkOnline = () => {
			if (!navigator.onLine)
				throw new Error('Brak połączenia z siecią. Spróbuj ponownie po odzyskaniu łączności.');
		};
		controller.signal.addEventListener('abort', cancelSession);
		Object.assign(task, { name: file.name, phase: 'checksum', progress: 0 });
		try {
			checkOnline();
			const md5Base64 = await calculateMd5Base64(file, {
				signal: controller.signal,
				onProgress: (progress) => {
					if (!controller.signal.aborted && generation === this.generation)
						task.progress = progress;
				}
			});
			checkCancelled();
			checkOnline();
			Object.assign(task, { name: file.name, phase: 'preparing', progress: 0 });
			let response: { session?: UploadSession; target?: UploadTarget } = await uploads.createUpload(
				create(CreateUploadRequestSchema, {
					spaceId: targetSpaceId,
					...(targetParentId ? { parentId: targetParentId } : {}),
					name: file.name,
					sizeBytes: BigInt(file.size),
					md5Base64,
					requestId: crypto.randomUUID(),
					uploadMode: targetUploadMode,
					supportsAttempts: true
				})
			);
			let session = response.session;
			if (!session) throw new Error('Backend nie zwrócił sesji uploadu.');
			uploadId = session.id;
			checkCancelled();
			let retried = false;
			while (session.state !== UploadState.COMPLETED) {
				activeAttemptId = session.attemptId;
				const attemptId = activeAttemptId;
				const storageLocation = session.storageLocation;
				const phase = retried ? 'retrying' : 'uploading';
				checkCancelled();
				checkOnline();
				if (!response.target?.url)
					throw new Error('Backend nie zwrócił podpisanego adresu do przesłania pliku.');
				Object.assign(task, { name: file.name, phase, progress: 0, storageLocation });
				let acceptingProgress = true;
				try {
					await uploadToTarget(file, response.target.url, response.target.headers, {
						signal: controller.signal,
						onProgress: (loaded, total) => {
							if (!acceptingProgress || controller.signal.aborted || activeAttemptId !== attemptId)
								return;
							Object.assign(task, {
								name: file.name,
								phase,
								progress: total ? Math.round((loaded / total) * 100) : 0,
								storageLocation
							});
						}
					});
				} catch (error) {
					acceptingProgress = false;
					checkCancelled();
					checkOnline();
					const failureKind =
						error instanceof UploadTransportError
							? UploadFailureKind.TRANSPORT
							: error instanceof UploadTargetError && error.status >= 500 && error.status <= 599
								? UploadFailureKind.SERVER
								: undefined;
					if (
						retried ||
						targetUploadMode !== UploadMode.AUTO ||
						!session.fallbackAllowed ||
						session.attemptNumber !== 1 ||
						!attemptId ||
						failureKind === undefined
					)
						throw error;
					retried = true;
					activeAttemptId = '';
					Object.assign(task, {
						name: file.name,
						phase: 'preparing',
						progress: 0,
						storageLocation
					});
					response = await uploads.retryUpload(
						create(RetryUploadRequestSchema, {
							uploadId,
							failedAttemptId: attemptId,
							requestId: crypto.randomUUID(),
							failureKind
						}),
						{ signal: controller.signal }
					);
					checkCancelled();
					session = response.session;
					if (!session)
						throw new Error('Backend nie zwrócił sesji ponowienia uploadu.', { cause: error });
					if (session.id !== uploadId)
						throw new Error('Backend zwrócił inną sesję uploadu.', { cause: error });
					continue;
				} finally {
					acceptingProgress = false;
				}
				checkCancelled();
				Object.assign(task, {
					name: file.name,
					phase: 'finalizing',
					progress: 100,
					storageLocation
				});
				const completeRequest = create(CompleteUploadRequestSchema, { uploadId, attemptId });
				try {
					await uploads.completeUpload(completeRequest);
				} catch (error) {
					checkCancelled();
					checkOnline();
					const recovered = await uploads.getUpload(create(GetUploadRequestSchema, { uploadId }));
					checkCancelled();
					if (recovered.session?.state !== UploadState.COMPLETED) {
						if (
							recovered.session?.state !== UploadState.OPEN ||
							recovered.session.attemptId !== attemptId
						)
							throw error;
						await uploads.completeUpload(completeRequest);
					}
				}
				checkCancelled();
				break;
			}
			checkCancelled();
			Object.assign(task, {
				name: file.name,
				phase: 'done',
				progress: 100,
				storageLocation: session.storageLocation
			});
			this.onComplete(task.target);
			this.completedTimers.set(
				task.id,
				setTimeout(() => {
					this.completedTimers.delete(task.id);
					if (generation === this.generation)
						this.tasks = this.tasks.filter((item) => item.id !== task.id);
				}, 5000)
			);
		} catch (error) {
			if (
				controller.signal.aborted ||
				(error instanceof DOMException && error.name === 'AbortError')
			) {
				Object.assign(task, {
					name: file.name,
					phase: 'cancelled',
					progress: 0,
					storageLocation: task.storageLocation
				});
				if (uploadId) {
					try {
						cancelSession();
						await cancellation;
					} catch (cancelError) {
						task.error = `Upload przerwano w przeglądarce, ale nie udało się anulować sesji: ${storageErrorMessage(cancelError)}`;
					}
				}
			} else {
				Object.assign(task, {
					name: file.name,
					phase: 'error',
					progress: 0,
					storageLocation: task.storageLocation,
					error: storageErrorMessage(error)
				});
			}
		} finally {
			activeAttemptId = '';
			controller.signal.removeEventListener('abort', cancelSession);
			task.controller = undefined;
			task.file = undefined;
		}
	}
}
