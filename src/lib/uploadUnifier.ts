import {
  UnifiedUploadState,
  UppyUploadData,
  SimpleUploadData,
} from "@/types/upload";
import { UploadTaskState } from "./simpleUpload";
import { MultipartUploadState } from "@/types/multipart";

// Utility do konwersji SimpleUpload na UnifiedUpload
export function convertSimpleUploadToUnified(
  simpleUpload: UploadTaskState
): UnifiedUploadState {
  return {
    id: simpleUpload.id,
    fileName: simpleUpload.fileName,
    fileSize: simpleUpload.size,
    status:
      simpleUpload.status === "completed" ? "success" : simpleUpload.status,
    progress:
      simpleUpload.smoothProgress ||
      (simpleUpload.uploadedBytes / simpleUpload.size) * 100,
    bytesUploaded: simpleUpload.uploadedBytes,
    speed: simpleUpload.speedMbps / 8, // Convert to MB/s
    etaSec: simpleUpload.etaSec,
    engine: "simple",
    engineData: {
      folder: simpleUpload.folder,
      subPath: simpleUpload.subPath,
      speedMbps: simpleUpload.speedMbps,
      smoothProgress: simpleUpload.smoothProgress,
      lastPartUpdateTime: simpleUpload.lastPartUpdateTime,
      key: simpleUpload.key,
    } as SimpleUploadData,
    errorMessage: simpleUpload.errorMessage,
    queuePosition: simpleUpload.queuePosition,
    estimatedWaitTime: simpleUpload.estimatedWaitTime,
  };
}

// Utility do konwersji UppyJob na UnifiedUpload
export function convertUppyJobToUnified(uppyJob: {
  progress: number;
  status: "uploading" | "success" | "error" | "paused" | "restored";
  speedBps?: number;
  handle: unknown;
  fileName?: string;
  fileSize?: number;
  bytesUploaded?: number;
}): UnifiedUploadState {
  return {
    id: `uppy-${Date.now()}`, // Generate unique ID for Uppy
    fileName: uppyJob.fileName || "Unknown file",
    fileSize: uppyJob.fileSize || 0,
    status: uppyJob.status === "success" ? "completed" : uppyJob.status,
    progress: uppyJob.progress || 0,
    bytesUploaded: uppyJob.bytesUploaded || 0,
    speed: uppyJob.speedBps ? uppyJob.speedBps / (1024 * 1024) : 0,
    etaSec: null, // Uppy doesn't provide ETA directly
    engine: "uppy",
    engineData: {
      handle: uppyJob.handle,
      speedBps: uppyJob.speedBps,
      status: uppyJob.status,
    } as UppyUploadData,
  };
}

// Utility do konwersji MultipartUpload na UnifiedUpload
export function convertMultipartUploadToUnified(
  multipartUpload: MultipartUploadState
): UnifiedUploadState {
  return {
    id: multipartUpload.id,
    fileName: multipartUpload.fileName,
    fileSize: multipartUpload.fileSize,
    status:
      multipartUpload.status === "completed"
        ? "success"
        : multipartUpload.status,
    progress: multipartUpload.progress,
    bytesUploaded: multipartUpload.bytesUploaded,
    speed: multipartUpload.speed,
    etaSec: multipartUpload.etaSec,
    engine: "multipart",
    engineData: {
      uploadId: multipartUpload.uploadId,
      key: multipartUpload.key,
      folder: multipartUpload.folder,
      subPath: multipartUpload.subPath,
      parts: multipartUpload.parts,
      status: multipartUpload.status,
    },
    errorMessage: multipartUpload.errorMessage,
    queuePosition: undefined, // Multipart nie ma kolejki
    estimatedWaitTime: undefined, // Multipart nie ma estimated wait time
  };
}

// Utility do łączenia wszystkich uploadów
export function unifyAllUploads(
  simpleUploads: UploadTaskState[],
  uppyJob: {
    progress: number;
    status: "uploading" | "success" | "error" | "paused" | "restored";
    speedBps?: number;
    handle: unknown;
    fileName?: string;
    fileSize?: number;
    bytesUploaded?: number;
  } | null,
  multipartUploads: MultipartUploadState[] = []
): UnifiedUploadState[] {
  const unifiedUploads: UnifiedUploadState[] = [];

  // Dodaj Simple uploads
  simpleUploads.forEach((upload) => {
    unifiedUploads.push(convertSimpleUploadToUnified(upload));
  });

  // Dodaj Uppy upload (jeśli istnieje)
  if (uppyJob) {
    unifiedUploads.push(convertUppyJobToUnified(uppyJob));
  }

  // Dodaj Multipart uploads
  multipartUploads.forEach((upload) => {
    unifiedUploads.push(convertMultipartUploadToUnified(upload));
  });

  return unifiedUploads;
}

// Utility do sprawdzania czy są aktywne uploady
export function hasActiveUploads(
  simpleUploads: UploadTaskState[],
  uppyJob: {
    status: "uploading" | "success" | "error" | "paused" | "restored";
  } | null,
  multipartUploads: MultipartUploadState[] = []
): boolean {
  const hasActiveSimple = simpleUploads.some(
    (u) => u.status === "uploading" || u.status === "queued"
  );

  const hasActiveUppy =
    uppyJob && (uppyJob.status === "uploading" || uppyJob.status === "paused");

  const hasActiveMultipart = multipartUploads.some(
    (u) => u.status === "uploading" || u.status === "initializing"
  );

  return hasActiveSimple || hasActiveUppy || hasActiveMultipart;
}
