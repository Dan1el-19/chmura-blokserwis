"use client";
import React from "react";
import { UploadTaskState } from "@/lib/simpleUpload";
import { useUpload } from "@/context/UploadContext";
import SmoothProgressBar from "@/components/ui/SmoothProgressBar";

export default function UploadProgressBadge({
  task,
}: {
  task: UploadTaskState;
}) {
  // Użyj płynnego progress jeśli dostępny, w przeciwnym razie oblicz standardowy
  const raw =
    task.smoothProgress !== undefined && !Number.isNaN(task.smoothProgress)
      ? task.smoothProgress
      : task.size
        ? (task.uploadedBytes / task.size) * 100
        : 0;
  const percent = Math.min(100, Math.max(0, raw));
  const { pause, resume, cancel, remove } = useUpload();

  const getStatusText = () => {
    switch (task.status) {
      case "uploading":
        return "Wysyłanie...";
      case "paused":
        return "Wstrzymane";
      case "error":
        return "Błąd";
      case "completed":
        return "Zakończone";
      case "canceled":
        return "Anulowane";
      case "queued":
        return `W kolejce (${task.queuePosition || 0})`;
      default:
        return "W kolejce";
    }
  };

  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <div className="w-full bg-gray-100 rounded-md p-2 text-xs">
      <div className="mb-1">
        <span className="font-medium text-gray-700">{task.fileName}</span>
      </div>

      {/* Użyj Material-UI progress bar dla lepszej stabilności */}
      <SmoothProgressBar progress={percent} className="mb-2" />

      <div className="flex justify-between items-center mt-1 text-gray-600">
        <span>
          {typeof task.speedMbps === "number" &&
          isFinite(task.speedMbps) &&
          task.speedMbps > 0
            ? `${(task.speedMbps / 8).toFixed(2)} MB/s`
            : "—"}
        </span>
        <div className="flex items-center gap-2">
          {task.status === "uploading" && task.etaSec !== null && (
            <span>~{formatWaitTime(task.etaSec)}</span>
          )}
          {task.status === "queued" && task.estimatedWaitTime && (
            <span>~{formatWaitTime(task.estimatedWaitTime)}</span>
          )}
          {task.status === "uploading" && (
            <button
              onClick={() => pause(task.id)}
              className="px-2 py-1 bg-yellow-600 text-white rounded text-xs"
            >
              Pauza
            </button>
          )}
          {task.status === "paused" && (
            <button
              onClick={() => resume(task.id)}
              className="px-2 py-1 bg-green-600 text-white rounded text-xs"
            >
              Wznów
            </button>
          )}

          {(task.status === "uploading" ||
            task.status === "queued" ||
            task.status === "paused") && (
            <button
              onClick={() => cancel(task.id)}
              className="px-2 py-1 bg-red-600 text-white rounded text-xs"
            >
              Anuluj
            </button>
          )}
          {task.status === "error" && (
            <button
              onClick={() => remove(task.id)}
              className="px-2 py-1 bg-red-600 text-white rounded text-xs"
            >
              Usuń
            </button>
          )}
        </div>
      </div>

      {task.errorMessage && (
        <div className="mt-1 text-red-600 text-xs">{task.errorMessage}</div>
      )}
      <div className="mt-1 text-gray-500 text-xs">{getStatusText()}</div>
      {task.status === "queued" &&
        task.queuePosition &&
        task.queuePosition > 1 && (
          <div className="mt-1 text-blue-600 text-xs">
            Pozycja w kolejce: {task.queuePosition}
          </div>
        )}
    </div>
  );
}
