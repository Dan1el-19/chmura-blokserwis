"use client";
import React, { useEffect, useRef } from "react";
import {
  X,
  Download,
  Share2,
  Link,
  BarChart3,
  FileText,
  Trash2,
  FolderEdit,
} from "lucide-react";
import { FileItem, FolderItem } from "@/types";
import { formatBytes } from "@/lib/utils";

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  file?: FileItem | null;
  folder?: FolderItem | null;
  onAction: (action: string) => void;
}

export default function MobileBottomSheet({
  isOpen,
  onClose,
  file,
  folder,
  onAction,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  const handleAction = (action: string) => {
    onAction(action);
    onClose();
  };

  if (!isOpen) return null;

  const isFile = !!file;
  const item = file || folder;
  const itemName = isFile ? file?.name : folder?.name;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="md:hidden fixed inset-0 z-[11000] bg-black/50 animate-in fade-in duration-200"
    >
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-hidden flex flex-col"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header with file/folder info */}
        <div className="px-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3
                className="text-base font-semibold text-gray-900 truncate"
                title={itemName}
              >
                {itemName}
              </h3>
              {isFile && file && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatBytes(file.size)}
                </p>
              )}
              {!isFile && folder && (
                <p className="text-sm text-gray-500 mt-0.5">Folder</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Zamknij"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Actions list */}
        <div className="flex-1 overflow-y-auto py-2">
          {isFile ? (
            // File actions
            <>
              <button
                onClick={() => handleAction("download")}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Download className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-base text-gray-900">Pobierz</span>
              </button>

              <button
                onClick={() => handleAction("share")}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-base text-gray-900">Udostępnij</span>
              </button>

              <button
                onClick={() => handleAction("manage")}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <Link className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-base text-gray-900">
                  Zarządzaj linkami
                </span>
              </button>

              <button
                onClick={() => handleAction("stats")}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-base text-gray-900">Statystyki</span>
              </button>

              <button
                onClick={() => handleAction("rename")}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <span className="text-base text-gray-900">Zmień nazwę</span>
              </button>

              <div className="h-px bg-gray-100 my-2 mx-4" />

              <button
                onClick={() => handleAction("delete")}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-red-50 active:bg-red-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-base text-red-600">Usuń</span>
              </button>
            </>
          ) : (
            // Folder actions
            <>
              <button
                onClick={() => handleAction("download")}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Download className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-base text-gray-900">Pobierz</span>
                  <p className="text-xs text-gray-400">Wkrótce</p>
                </div>
              </button>

              <button
                onClick={() => handleAction("share")}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-base text-gray-900">Udostępnij</span>
                  <p className="text-xs text-gray-400">Wkrótce</p>
                </div>
              </button>

              <button
                onClick={() => handleAction("rename")}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <FolderEdit className="w-5 h-5 text-gray-600" />
                </div>
                <span className="text-base text-gray-900">Zmień nazwę</span>
              </button>

              <div className="h-px bg-gray-100 my-2 mx-4" />

              <button
                onClick={() => handleAction("delete")}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-red-50 active:bg-red-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-base text-red-600">Usuń</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
