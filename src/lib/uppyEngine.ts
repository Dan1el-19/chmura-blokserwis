import Uppy from "@uppy/core";
import { auth } from "@/lib/firebase";

export type UppyUploadStatus = "idle" | "uploading" | "error" | "success";

export interface UppyUploadCallbacks {
  onProgress?: (
    progressPercent: number,
    bytesUploaded: number,
    bytesTotal: number,
    speedBps?: number
  ) => void;
  onStarted?: () => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
  onCancel?: () => void;
  onPaused?: () => void;
  onResumed?: () => void;
  onRestored?: (progressPercent: number) => void;
}

export interface UppyUploadHandle {
  id: string;
  uppy: Uppy;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  supportsPause: boolean;
  supportsResume: boolean;
}

function buildObjectKey(
  folder: "personal" | "main",
  fileName: string,
  userId?: string,
  subPath?: string
): string {
  const cleanSub = (subPath || "")
    .replace(/^[\/]+/, "")
    .replace(/\.\./g, "")
    .replace(/\/+/g, "/")
    .replace(/\s+$/, "")
    .replace(/^\s+/, "");
  const nested = cleanSub ? `${cleanSub.replace(/\/$/, "")}/` : "";
  if (folder === "personal") {
    return `users/${userId || "unknown"}/${nested}${fileName}`;
  }
  return `main/${nested}${fileName}`;
}

export async function startUppyUploadWithProgress(
  file: File,
  folder: "personal" | "main",
  subPath?: string,
  callbacks: UppyUploadCallbacks = {}
): Promise<UppyUploadHandle> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    callbacks.onError?.("Musisz być zalogowany, aby przesłać pliki");
    throw new Error("User not authenticated");
  }

  // Clear any previous Uppy state for this file to prevent conflicts
  try {
    const storageKeys = Object.keys(localStorage).filter(
      (key) => key.startsWith("uppy/") || key.startsWith("@uppy/")
    );
    storageKeys.forEach((key) => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        if (data.name === file.name || data.filename === file.name) {
          localStorage.removeItem(key);
        }
      } catch {
        // If can't parse, remove anyway to be safe
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn("Could not clear Uppy localStorage:", e);
  }

  const uppy = new Uppy({
    autoProceed: false,
    allowMultipleUploads: false,
    debug: false,
    restrictions: {
      maxFileSize: null,
    },
  });

  // Build the target key in R2
  const objectKey = buildObjectKey(folder, file.name, currentUser.uid, subPath);

  // Detect if this is a large file that needs special handling
  const VERY_LARGE_FILE_THRESHOLD = 200 * 1024 * 1024; // 200MB - above this, recommend chunks
  const isVeryLargeFile = file.size > VERY_LARGE_FILE_THRESHOLD;

  if (isVeryLargeFile) {
    // For very large files >200MB, suggest using multipart upload system
    callbacks.onError?.(
      `Pliki większe niż 200MB wymagają implementacji multipart upload. Obecnie obsługiwane do 200MB.`
    );
    throw new Error("File too large for current implementation");
  }

  // Custom uploader for small files using presigned URLs
  let uploadAborted = false;
  let uploadXHR: XMLHttpRequest | null = null;
  let targetPercent = 0;
  let lastSpeed = 0;

  const performUpload = async () => {
    try {
      // Get presigned URL for this specific file
      const token = await currentUser.getIdToken();
      const response = await fetch(
        `/api/files/presigned?op=put&key=${encodeURIComponent(objectKey)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to get upload URL");
      }

      const result = await response.json();
      const presignedUrl = result.presignedUrl;

      // Create XHR upload with proper timeouts and error handling
      return new Promise<void>((resolve, reject) => {
        if (uploadAborted) {
          reject(new Error("Upload was aborted"));
          return;
        }

        const xhr = new XMLHttpRequest();
        uploadXHR = xhr;

        // Set appropriate timeout based on file size (minimum 5 minutes, max 60 minutes)
        const timeoutMinutes = Math.min(
          60,
          Math.max(5, Math.ceil(file.size / (1024 * 1024 * 2)))
        ); // 2MB per minute base
        xhr.timeout = timeoutMinutes * 60 * 1000;

        console.log(
          `Starting upload of ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB) with ${timeoutMinutes}min timeout`
        );

        // let lastProgressTime = Date.now();
        let lastLoaded = 0;
        const uploadStartTime = Date.now();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable && !uploadAborted) {
            const now = Date.now();
            const bytesDiff = event.loaded - lastLoaded;

            // Calculate average speed since upload start for more stable ETA
            const totalTime = (now - uploadStartTime) / 1000; // seconds
            const avgSpeed = totalTime > 0 ? event.loaded / totalTime : 0;

            // lastProgressTime = now;
            lastLoaded = event.loaded;

            targetPercent = (event.loaded / event.total) * 100;
            lastSpeed = avgSpeed; // Use average speed for more stable reporting

            // Log progress for debugging large files
            if (
              file.size > 50 * 1024 * 1024 &&
              event.loaded % (10 * 1024 * 1024) < bytesDiff
            ) {
              console.log(
                `Upload progress: ${targetPercent.toFixed(1)}% (${(event.loaded / (1024 * 1024)).toFixed(2)}MB/${(event.total / (1024 * 1024)).toFixed(2)}MB) - ${(avgSpeed / (1024 * 1024)).toFixed(2)} MB/s avg`
              );
            }

            // Emit progress update
            callbacks.onProgress?.(
              targetPercent,
              event.loaded,
              event.total,
              avgSpeed
            );
          }
        });

        xhr.addEventListener("load", async () => {
          if (uploadAborted) return;

          if (xhr.status >= 200 && xhr.status < 300) {
            // After successful upload, record it in Firestore
            try {
              const recordResponse = await fetch("/api/files/upload-record", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  fileName: file.name,
                  fileSize: file.size,
                  key: objectKey,
                  folder: folder,
                  subPath: subPath || null,
                }),
              });

              if (!recordResponse.ok) {
                console.warn(
                  "Failed to record upload in Firestore, but file was uploaded to R2"
                );
              }
            } catch (recordError) {
              console.warn("Failed to record upload:", recordError);
            }

            targetPercent = 100;
            callbacks.onProgress?.(100, file.size, file.size, lastSpeed);
            callbacks.onSuccess?.();
            resolve();
          } else {
            const errorText =
              xhr.responseText || xhr.statusText || "Unknown error";
            reject(new Error(`Upload failed: ${xhr.status} - ${errorText}`));
          }
        });

        xhr.addEventListener("error", () => {
          if (!uploadAborted) {
            console.error(
              "XHR Upload error for file:",
              file.name,
              "Size:",
              (file.size / (1024 * 1024)).toFixed(2),
              "MB"
            );
            reject(new Error(`Network error during upload of ${file.name}`));
          }
        });

        xhr.addEventListener("timeout", () => {
          if (!uploadAborted) {
            console.error(
              "XHR Upload timeout for file:",
              file.name,
              "Size:",
              (file.size / (1024 * 1024)).toFixed(2),
              "MB",
              `Timeout: ${timeoutMinutes}min`
            );
            reject(
              new Error(
                `Upload timed out after ${timeoutMinutes} minutes. Try uploading smaller chunks or check your connection.`
              )
            );
          }
        });

        xhr.addEventListener("abort", () => {
          console.log("XHR Upload aborted for file:", file.name);
          reject(new Error("Upload aborted by user"));
        });

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream"
        );

        // Send the file
        xhr.send(file);
      });
    } catch (error) {
      throw error;
    }
  };

  // Start upload immediately
  callbacks.onStarted?.();
  performUpload().catch((error) => {
    callbacks.onError?.(error.message || "Upload failed");
  });

  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    uppy,
    cancel: () => {
      uploadAborted = true;
      if (uploadXHR) {
        try {
          uploadXHR.abort();
        } catch {}
      }
      callbacks.onCancel?.();
    },
    pause: () => {
      /* XHR doesn't support pausing */
    },
    resume: () => {
      /* XHR doesn't support resuming */
    },
    destroy: () => {
      uploadAborted = true;
      if (uploadXHR) {
        try {
          uploadXHR.abort();
        } catch {}
      }
      try {
        uppy.destroy();
      } catch {}
    },
    supportsPause: false,
    supportsResume: false,
  };
}
