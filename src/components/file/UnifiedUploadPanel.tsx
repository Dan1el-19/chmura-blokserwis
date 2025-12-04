"use client";
import React from "react";
import { UnifiedUploadState } from "@/types/upload";
import { MultipartUploadState, MultipartUploadStatus } from "@/types/multipart";
import UploadItem from "./UploadItem";
import { MultipartUploadItem } from "./MultipartUploadItem";

interface UnifiedUploadPanelProps {
  uploads: UnifiedUploadState[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export default function UnifiedUploadPanel({
  uploads,
  onPause,
  onResume,
  onCancel,
  onRemove,
}: UnifiedUploadPanelProps) {
  if (uploads.length === 0) {
    return null;
  }

  // Grupuj uploady według typu
  const simpleUploads = uploads.filter((upload) => upload.engine === "simple");
  const uppyUploads = uploads.filter((upload) => upload.engine === "uppy");
  const multipartUploads = uploads.filter(
    (upload) => upload.engine === "multipart"
  );

  return (
    <div className="mt-3 space-y-3">
      {/* Multipart Uploads */}
      {multipartUploads.map((upload) => {
        // Konwertuj UnifiedUploadState na MultipartUploadState
        const multipartData = upload.engineData as unknown as Record<
          string,
          unknown
        >;
        const multipartUpload: MultipartUploadState = {
          id: upload.id,
          uploadId: (multipartData?.uploadId as string) || upload.id,
          key: (multipartData?.key as string) || "",
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          folder: (multipartData?.folder as "personal" | "main") || "personal",
          subPath: multipartData?.subPath as string | undefined,
          status:
            (multipartData?.status as MultipartUploadStatus) ||
            (upload.status as MultipartUploadStatus),
          parts: [], // Tymczasowo pusta tablica
          createdAt: new Date(), // Tymczasowo
          updatedAt: new Date(), // Tymczasowo
          progress: upload.progress,
          bytesUploaded: upload.bytesUploaded,
          speed: upload.speed,
          etaSec: upload.etaSec,
          errorMessage: upload.errorMessage,
        };

        return (
          <MultipartUploadItem
            key={upload.id}
            upload={multipartUpload}
            onPause={onPause}
            onResume={onResume}
            onCancel={onCancel}
            onRemove={onRemove}
          />
        );
      })}

      {/* Simple Uploads */}
      {simpleUploads.map((upload) => (
        <UploadItem
          key={upload.id}
          upload={upload}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onRemove={onRemove}
        />
      ))}

      {/* Uppy Uploads */}
      {uppyUploads.map((upload) => (
        <UploadItem
          key={upload.id}
          upload={upload}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
