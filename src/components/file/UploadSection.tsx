import React, { useRef, useState } from "react";
import { Upload, AlertCircle, Pause, Play, X, File } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Progress } from "@/components/ui/progress";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "paused" | "completed" | "error";
  speed: number; // MB/s
  remainingTime: number; // seconds
}

interface UploadSectionProps {
  currentFolder: string;
  uploading: boolean;
  storagePercentage: number;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function UploadSection({
  currentFolder,
  uploading,
  storagePercentage,
  onFileUpload,
}: UploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);

  const handleChooseFilesClick = () => {
    try {
      fileInputRef.current?.click();
    } catch {}
  };

  const formatDuration = (seconds: number) => {
    if (!isFinite(seconds) || seconds <= 0) return "";
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const handlePauseUpload = (fileId: string) => {
    setUploadFiles((prev) =>
      prev.map((file) =>
        file.id === fileId
          ? {
              ...file,
              status: file.status === "uploading" ? "paused" : "uploading",
            }
          : file
      )
    );
  };

  const handleCancelUpload = (fileId: string) => {
    setUploadFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  return (
    <Card className="glass-card shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
          <h2 className="text-lg font-semibold text-gray-900 font-roboto">
            {currentFolder === "personal" ? "Mój folder" : "Folder główny"}
          </h2>

          {/* Ukryty input, odpalany programowo */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onFileUpload}
            disabled={uploading}
            className="hidden"
            id="file-upload-hidden"
          />

          <Button
            variant="primary"
            size="md"
            disabled={uploading}
            onClick={handleChooseFilesClick}
            className="w-full sm:w-auto"
            data-testid="choose-files-button"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Przesyłanie..." : "Wybierz pliki"}
          </Button>
        </div>

        {/* Upload Progress Section */}
        {uploadFiles.length > 0 && (
          <div className="space-y-3 mt-4">
            <h3 className="text-sm font-medium text-gray-700">
              Przesyłanie plików
            </h3>
            {uploadFiles.map((uploadFile) => (
              <div key={uploadFile.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {uploadFile.status === "uploading" && (
                      <>
                        <button
                          onClick={() => handlePauseUpload(uploadFile.id)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                        <span className="text-xs text-gray-500">
                          {uploadFile.speed.toFixed(1)} MB/s
                        </span>
                        {uploadFile.remainingTime > 0 && (
                          <span className="text-xs text-gray-500">
                            ETA: {formatDuration(uploadFile.remainingTime)}
                          </span>
                        )}
                      </>
                    )}
                    {uploadFile.status === "paused" && (
                      <>
                        <button
                          onClick={() => handlePauseUpload(uploadFile.id)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                        <span className="text-xs text-gray-500">
                          Wstrzymane
                        </span>
                      </>
                    )}
                    <button
                      onClick={() => handleCancelUpload(uploadFile.id)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Progress value={uploadFile.progress} className="h-2" />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">
                    {uploadFile.progress.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500">
                    {(uploadFile.file.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {storagePercentage > 90 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-800 text-sm font-medium">
                  Uwaga: Wykorzystujesz {storagePercentage.toFixed(1)}%
                  dostępnej przestrzeni
                </p>
                <p className="text-red-700 text-sm mt-1">
                  Rozważ usunięcie niepotrzebnych plików przed dodaniem nowych.
                </p>
              </div>
            </div>
          </div>
        )}

        {storagePercentage > 70 && storagePercentage <= 90 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-yellow-800 text-sm font-medium">
                  Wykorzystujesz {storagePercentage.toFixed(1)}% dostępnej
                  przestrzeni
                </p>
                <p className="text-yellow-700 text-sm mt-1">
                  Rozważ uporządkowanie plików w najbliższym czasie.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
