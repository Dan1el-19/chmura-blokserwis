// Unifikowane typy dla systemu uploadu
export type UnifiedUploadStatus = 'queued' | 'uploading' | 'paused' | 'completed' | 'error' | 'canceled' | 'success' | 'restored' | 'aborted' | 'initializing';

export interface UnifiedUploadState {
	// Podstawowe informacje
	id: string;
	fileName: string;
	fileSize: number;
	status: UnifiedUploadStatus;
	
	// Progress
	progress: number; // 0-100
	bytesUploaded: number;
	
	// Speed i ETA
	speed: number; // MB/s
	etaSec: number | null;
	
	// Engine-specific data
	engine: 'uppy' | 'simple' | 'multipart';
	engineData: UppyUploadData | SimpleUploadData | MultipartUploadData; // Specific data for each engine
	
	// UI state
	errorMessage?: string;
	queuePosition?: number;
	estimatedWaitTime?: number;
}

// Adapter interface dla różnych silników uploadu
export interface UploadEngineAdapter {
	getProgress(upload: UnifiedUploadState): number;
	getSpeed(upload: UnifiedUploadState): string; // formatted speed
	getETA(upload: UnifiedUploadState): string; // formatted ETA
	getStatus(upload: UnifiedUploadState): string; // human readable status
	canPause(upload: UnifiedUploadState): boolean;
	canResume(upload: UnifiedUploadState): boolean;
	canCancel(upload: UnifiedUploadState): boolean;
	
	// Actions
	pause(upload: UnifiedUploadState): Promise<void>;
	resume(upload: UnifiedUploadState): Promise<void>;
	cancel(upload: UnifiedUploadState): Promise<void>;
	remove(upload: UnifiedUploadState): Promise<void>;
}

// Typy dla różnych silników
export interface UppyUploadData {
	handle: {
		pause?: () => void;
		resume?: () => void;
		cancel?: () => void;
		destroy?: () => void;
	};
	speedBps?: number;
	status: 'uploading' | 'success' | 'error' | 'paused' | 'restored';
}

export interface SimpleUploadData {
	folder: 'personal' | 'main';
	subPath?: string;
	speedMbps: number;
	smoothProgress?: number;
	lastPartUpdateTime?: number;
	key?: string;
}

export interface MultipartUploadData {
	uploadId: string;
	key: string;
	folder: 'personal' | 'main';
	subPath?: string;
	parts: Array<{
		partNumber: number;
		etag: string;
		size: number;
		uploadedAt: Date;
		status: 'pending' | 'uploading' | 'completed' | 'error';
	}>;
	status: 'initializing' | 'uploading' | 'completed' | 'error' | 'aborted' | 'paused';
}
