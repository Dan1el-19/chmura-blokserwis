"use client";
import React, { useState, useRef, useCallback } from "react";

interface DragDropUploadProps {
  onFilesSelected: (files: File[]) => void;
  className?: string;
  children?: React.ReactNode;
}

export default function DragDropUpload({
  onFilesSelected,
  className = "",
  children,
}: DragDropUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isInternalDrag = (e: React.DragEvent) => {
    return Array.from(e.dataTransfer.types || []).includes(
      "application/x-file-key"
    );
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      Array.from(e.dataTransfer.types || []).includes("application/x-file-key")
    )
      return; // ignore internal file move
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isInternalDrag(e)) return;
      setDragCounter((prev) => prev - 1);
      if (dragCounter === 0) {
        setIsDragOver(false);
      }
    },
    [dragCounter]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isInternalDrag(e)) {
        // Ensure overlay hidden for internal drags
        if (isDragOver) setIsDragOver(false);
      }
    },
    [isDragOver]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isInternalDrag(e)) return; // folder move will handle itself
      setIsDragOver(false);
      setDragCounter(0);

      const files: File[] = [];
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          if (file && file.size > 0) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = "";
  };

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Overlay podczas drag */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-50">
          <div className="text-center text-blue-700 font-medium">
            <div className="text-2xl mb-2">📁</div>
            <div>Upuść pliki tutaj</div>
            <div className="text-sm mt-1">Aby je przesłać</div>
          </div>
        </div>
      )}

      {/* Ukryty input file */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        onClick={handleClick}
      />
    </div>
  );
}
