// Typy dla systemu multipart upload

export type MultipartUploadStatus =
  | "initializing"
  | "uploading"
  | "completed"
  | "error"
  | "aborted"
  | "paused";

export interface MultipartUploadState {
  id: string;
  uploadId: string; // R2 upload ID
  key: string; // R2 object key
  fileName: string;
  fileSize: number;
  file?: File; // Optional reference to original File object (for UI components)
  folder: "personal" | "main";
  subPath?: string;
  status: MultipartUploadStatus;
  parts: Part[];
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
  progress: number; // 0-100
  bytesUploaded: number;
  speed: number; // MB/s
  etaSec: number | null;
}

export interface Part {
  partNumber: number;
  etag: string;
  size: number;
  uploadedAt: Date;
  status: "pending" | "uploading" | "completed" | "error";
  errorMessage?: string;
}

export interface MultipartUploadHandle {
  id: string;
  uploadId: string;
  key: string;
  fileName: string;
  fileSize: number;
  folder: "personal" | "main";
  subPath?: string;
  status: MultipartUploadStatus;
  progress: number;
  bytesUploaded: number;
  speed: number;
  etaSec: number | null;
  errorMessage?: string;
  parts: Part[];

  // Actions
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  abort: () => Promise<void>;

  // Events
  onProgress?: (progress: number, bytesUploaded: number, speed: number) => void;
  onStatusChange?: (status: MultipartUploadStatus) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

export interface MultipartUploadOptions {
  // Usunięto chunkSize - używa się teraz inteligentnego algorytmu optymalizacji
  maxConcurrentChunks?: number; // Maksymalna liczba równoczesnych chunków (będzie dostosowana przez algorytm)
  retryAttempts?: number; // Liczba prób retry dla failed chunks
  retryDelay?: number; // Opóźnienie między retry w ms
  // Performance optimization
  chunkTimeout?: number; // Timeout dla uploadu chunka w ms
  maxRetryDelay?: number; // Maksymalne opóźnienie retry w ms
  exponentialBackoff?: boolean; // Czy używać exponential backoff
  progressUpdateInterval?: number; // Interwał aktualizacji progress w ms
  // Adaptive chunk sizing - teraz wbudowane w algorytm
  // adaptiveChunkSize, minChunkSize, maxChunkSize, targetChunkCount - zastąpione przez chunkOptimizer
}

export interface MultipartUploadProgress {
  uploadId: string;
  partNumber: number;
  bytesUploaded: number;
  totalBytes: number;
  speed: number; // MB/s
  etaSec: number | null;
}

export interface MultipartUploadStats {
  totalParts: number;
  completedParts: number;
  failedParts: number;
  totalBytes: number;
  uploadedBytes: number;
  averageSpeed: number; // MB/s
  estimatedTimeRemaining: number | null; // sekundy
}

// Typy dla API responses
export interface CreateMultipartUploadResponse {
  uploadId: string;
  key: string;
  status: "created";
  message: string;
}

export interface SignPartResponse {
  presignedUrl: string;
  partNumber: number;
  expiresAt: Date;
}

export interface CompleteMultipartUploadResponse {
  status: "completed";
  key: string;
  etag: string;
  message: string;
}

export interface ListPartsResponse {
  parts: Part[];
  uploadId: string;
  key: string;
  totalParts: number;
}

export interface MultipartUploadStatusResponse {
  uploadId: string;
  key: string;
  status: MultipartUploadStatus;
  progress: number;
  parts: Part[];
  stats: MultipartUploadStats;
  errorMessage?: string;
}

// Typy dla error handling
export interface MultipartUploadError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  partNumber?: number;
}

// Typy dla resume capability
export interface ResumeUploadData {
  uploadId: string;
  key: string;
  fileName: string;
  fileSize: number;
  folder: "personal" | "main";
  subPath?: string;
  parts: Part[];
  lastUpdated: Date;
}

// Typy dla chunk management
export interface ChunkInfo {
  partNumber: number;
  startByte: number;
  endByte: number;
  size: number;
  status: "pending" | "uploading" | "completed" | "error";
  uploadedBytes?: number; // Dla real-time progress tracking
}

export interface ChunkUploadResult {
  partNumber: number;
  etag: string;
  size: number;
  success: boolean;
  errorMessage?: string;
  retryCount: number;
}
