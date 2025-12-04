import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  startUppyUploadWithProgress,
  UppyUploadHandle,
} from "@/lib/uppyEngine";
import { useUpload } from "@/context/UploadContext";
import { unifyAllUploads, hasActiveUploads } from "@/lib/uploadUnifier";
import { FolderSpace } from "./useStorageNavigation";

// Constants
export const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB
export const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB

interface UppyJobState {
  progress: number;
  status: "uploading" | "success" | "error" | "paused" | "restored";
  speedBps?: number;
  handle: UppyUploadHandle | null;
  fileName?: string;
  fileSize?: number;
  bytesUploaded?: number;
}

interface FileUploadState {
  // Upload context
  uploads: ReturnType<typeof useUpload>["uploads"];
  multipartUploads: ReturnType<typeof useUpload>["multipartUploads"];
  allUnifiedUploads: ReturnType<typeof unifyAllUploads>;
  hasActiveUploadsState: boolean;

  // Uppy job
  uppyJob: UppyJobState | null;

  // Selected file for cost calculator
  selectedFileForUpload: File | null;
  showCostCalculatorModal: boolean;

  // Actions
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleFilesSelected: (files: File[]) => Promise<void>;
  handleCostCalculatorConfirm: () => Promise<void>;
  handleCostCalculatorClose: () => void;

  // Upload context actions (forwarded)
  pause: (id: string) => void;
  resume: (id: string) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
}

interface UseFileUploadOptions {
  currentFolder: FolderSpace;
  path: string[];
  fetchFiles: () => Promise<void>;
  fetchUserData: () => Promise<void>;
}

export function useFileUpload({
  currentFolder,
  path,
  fetchFiles,
  fetchUserData,
}: UseFileUploadOptions): FileUploadState {
  const useUppy = true;

  const {
    enqueue,
    enqueueMultipart,
    uploads,
    multipartUploads,
    pause,
    resume,
    cancel,
    remove,
  } = useUpload();

  const [uppyJob, setUppyJob] = useState<UppyJobState | null>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] =
    useState<File | null>(null);
  const [showCostCalculatorModal, setShowCostCalculatorModal] = useState(false);

  // Computed values
  const allUnifiedUploads = unifyAllUploads(uploads, uppyJob, multipartUploads);
  const hasActiveUploadsState = hasActiveUploads(
    uploads,
    uppyJob,
    multipartUploads
  );

  // Store current handle for cleanup on unmount only
  const currentHandleRef = useRef<UppyUploadHandle | null>(null);

  // Update ref when handle changes
  useEffect(() => {
    currentHandleRef.current = uppyJob?.handle || null;
  }, [uppyJob?.handle]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      try {
        const currentHandle = currentHandleRef.current;
        if (currentHandle) {
          currentHandle.destroy();
        }
      } catch {
        // Silent fail
      }
    };
  }, []);

  // Warn before unload if active uploads
  useEffect(() => {
    if (typeof window === "undefined") return;
    const before = (e: BeforeUnloadEvent) => {
      if (hasActiveUploadsState) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [hasActiveUploadsState]);

  // After uploads complete, refresh data
  useEffect(() => {
    const completed = uploads.filter((u) => u.status === "completed");
    if (completed.length) {
      const t = setTimeout(() => {
        fetchFiles();
        fetchUserData();
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [uploads, fetchFiles, fetchUserData]);

  // After multipart uploads complete, refresh data
  useEffect(() => {
    const completedMultipart = multipartUploads.filter(
      (u) => u.status === "completed"
    );
    if (completedMultipart.length) {
      const t = setTimeout(() => {
        fetchFiles();
        fetchUserData();
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [multipartUploads, fetchFiles, fetchUserData]);

  const handleFilesSelected = useCallback(
    async (sel: File[]) => {
      // Check if uploads are already active
      if (
        hasActiveUploadsState ||
        (uppyJob &&
          (uppyJob.status === "uploading" || uppyJob.status === "paused"))
      ) {
        toast.error(
          "Upload już trwa! Poczekaj aż zakończy się obecny upload.",
          {
            icon: "⚠️",
            duration: 4000,
          }
        );
        return;
      }

      // Check if user selected more than 1 file
      if (sel.length > 1) {
        toast("MultiUpload - Wkrótce", {
          icon: "⏳",
          duration: 3000,
        });
        return;
      }

      const subPath = path.join("/");
      const firstFile = sel[0];
      if (!firstFile) return;

      // Multipart upload for files ≥50MB
      if (firstFile.size >= MULTIPART_THRESHOLD) {
        setSelectedFileForUpload(firstFile);
        setShowCostCalculatorModal(true);
      } else if (useUppy && firstFile.size >= LARGE_FILE_THRESHOLD) {
        setSelectedFileForUpload(firstFile);
        setShowCostCalculatorModal(true);
      } else {
        await enqueue(firstFile, currentFolder, subPath || undefined);
      }
    },
    [hasActiveUploadsState, uppyJob, path, currentFolder, enqueue]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const filesSel = e.target.files;
      if (!filesSel) return;

      const files = Array.from(filesSel);
      await handleFilesSelected(files);

      e.target.value = "";
    },
    [handleFilesSelected]
  );

  const handleCostCalculatorConfirm = useCallback(async () => {
    if (!selectedFileForUpload) return;

    // Additional check if upload already started
    if (hasActiveUploadsState || (uppyJob && uppyJob.status === "uploading")) {
      toast.error("Upload już trwa! MultiUpload - Wkrótce", {
        icon: "⚠️",
        duration: 4000,
      });
      setShowCostCalculatorModal(false);
      setSelectedFileForUpload(null);
      return;
    }

    const f = selectedFileForUpload;
    const subPath = path.join("/");

    const isMultipart = f.size >= MULTIPART_THRESHOLD;
    const isLarge = useUppy && f.size >= LARGE_FILE_THRESHOLD;

    if (isMultipart) {
      // Multipart upload
      try {
        await enqueueMultipart(f, currentFolder, subPath || undefined);
        toast.success("Rozpoczęto multipart upload");
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Nie udało się rozpocząć multipart uploadu"
        );
      }
      setShowCostCalculatorModal(false);
      setSelectedFileForUpload(null);
    } else if (isLarge) {
      try {
        const handle = await startUppyUploadWithProgress(
          f,
          currentFolder,
          subPath || undefined,
          {
            onStarted: () =>
              setUppyJob((p) =>
                p
                  ? { ...p, status: "uploading" }
                  : {
                      status: "uploading",
                      progress: 0,
                      handle: null,
                      fileName: f.name,
                      fileSize: f.size,
                    }
              ),
            onProgress: (
              percent: number,
              bytesUploaded: number,
              bytesTotal: number,
              speedBps?: number
            ) =>
              setUppyJob((p) => ({
                ...(p || { status: "uploading", progress: 0, handle: null }),
                progress: percent,
                speedBps,
                bytesUploaded,
                fileSize: bytesTotal,
              })),
            onSuccess: () => {
              setUppyJob((p) =>
                p
                  ? { ...p, status: "success", progress: 100 }
                  : { status: "success", progress: 100, handle: null }
              );
              setTimeout(() => {
                setUppyJob(null);
              }, 1500);
              fetchFiles();
              fetchUserData();
            },
            onError: (msg: string) => {
              toast.error(msg);
              setUppyJob((p) =>
                p
                  ? { ...p, status: "error" }
                  : { status: "error", progress: 0, handle: null }
              );
            },
            onCancel: () => {
              setUppyJob((p) =>
                p
                  ? { ...p, status: "error" }
                  : { status: "error", progress: 0, handle: null }
              );
              toast("Anulowano upload");
            },
            onPaused: () =>
              setUppyJob((p) => (p ? { ...p, status: "paused" } : p)),
            onResumed: () =>
              setUppyJob((p) => (p ? { ...p, status: "uploading" } : p)),
            onRestored: (percent: number) =>
              setUppyJob({
                progress: percent,
                status: "restored",
                handle: null,
              }),
          }
        );
        setUppyJob({
          progress: 0,
          status: "uploading",
          handle,
          fileName: f.name,
          fileSize: f.size,
        });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Nie udało się rozpocząć uploadu"
        );
      }
      setShowCostCalculatorModal(false);
      setSelectedFileForUpload(null);
    } else {
      setShowCostCalculatorModal(false);
      setSelectedFileForUpload(null);
      await enqueue(f, currentFolder, subPath || undefined);
    }
  }, [
    selectedFileForUpload,
    hasActiveUploadsState,
    uppyJob,
    path,
    currentFolder,
    enqueueMultipart,
    enqueue,
    fetchFiles,
    fetchUserData,
  ]);

  const handleCostCalculatorClose = useCallback(() => {
    setShowCostCalculatorModal(false);
    setSelectedFileForUpload(null);
  }, []);

  return {
    uploads,
    multipartUploads,
    allUnifiedUploads,
    hasActiveUploadsState,
    uppyJob,
    selectedFileForUpload,
    showCostCalculatorModal,
    handleFileUpload,
    handleFilesSelected,
    handleCostCalculatorConfirm,
    handleCostCalculatorClose,
    pause,
    resume,
    cancel,
    remove,
  };
}
