"use client";
import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  Calendar,
  HardDrive,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RefreshCcw,
} from "lucide-react";
import NextImage from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatDate, formatBytes } from "@/lib/utils";
import { FileItem } from "@/types";
import { auth } from "@/lib/firebase";

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  onDownload: (file: FileItem) => void;
}

function FilePreviewModal({
  isOpen,
  onClose,
  file,
  onDownload,
}: FilePreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawText, setRawText] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [canWrapLines, setCanWrapLines] = useState(true);
  const [entered, setEntered] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [textOffset, setTextOffset] = useState(0);
  const [hasMoreText, setHasMoreText] = useState(false);
  const [textLoadingMore, setTextLoadingMore] = useState(false);
  const TEXT_CHUNK = 256_000; // 256KB na porcję

  const ext = file?.name.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(
    ext
  );
  const isPdf = ext === "pdf";
  const isText = [
    "txt",
    "md",
    "json",
    "xml",
    "html",
    "css",
    "js",
    "ts",
    "tsx",
    "jsx",
    "sh",
  ].includes(ext);
  const isVideo = ["mp4", "webm", "mov", "mkv", "ogg"].includes(ext);
  const isAudio = ["mp3", "wav", "flac", "m4a", "aac", "opus"].includes(ext);

  // Pobierz presigned URL dla podglądu
  useEffect(() => {
    if (!isOpen || !file) {
      setPreviewUrl(null);
      setPreviewError(null);
      setLoading(true);
      setRawText(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setPreviewError(null);

        const token = await auth.currentUser?.getIdToken().catch(() => null);
        if (!token) {
          setPreviewError("Brak autoryzacji");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `/api/files/presigned?key=${encodeURIComponent(file.key)}&op=get`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          setPreviewError("Błąd generowania linku do podglądu");
          setLoading(false);
          return;
        }

        const { presignedUrl } = await response.json();

        if (isImage || isPdf || isVideo || isAudio) {
          setPreviewUrl(presignedUrl);
          if (!cancelled) setLoading(false);
        } else if (isText) {
          // Lazy loading dużych plików tekstowych przy użyciu nagłówka Range
          setPreviewUrl(presignedUrl);
          setRawText("");
          setTextOffset(0);
          setHasMoreText(true);
          // Załaduj pierwszą porcję
          try {
            const res = await fetch(presignedUrl, {
              headers: { Range: `bytes=0-${TEXT_CHUNK - 1}` },
            });
            if (!res.ok && res.status !== 206 && res.status !== 200)
              throw new Error("range");
            const chunk = await res.text();
            if (cancelled) return;
            setRawText(chunk);
            setTextOffset(chunk.length);
            setHasMoreText(chunk.length >= TEXT_CHUNK);
            setLoading(false);
          } catch {
            if (!cancelled) {
              setPreviewError("Nie można załadować podglądu pliku");
              setLoading(false);
            }
          }
        } else {
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPreviewError("Nie można załadować podglądu pliku");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, file, isImage, isPdf, isVideo, isAudio, isText]);

  // Zamknięcie klawiszem ESC + blokada scrolla tła gdy modal otwarty
  useEffect(() => {
    if (!isOpen) return;
    setEntered(false);
    // małe opóźnienie aby aktywować animację wejścia
    const t = setTimeout(() => setEntered(true), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightbox) setLightbox(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevOverflow;
      clearTimeout(t);
      setEntered(false);
    };
  }, [isOpen, lightbox, onClose]);

  // Syntax highlighting dla plików tekstowych
  useEffect(() => {
    if (!rawText || !isText || !isOpen || !file) return;
    if (typeof window === "undefined") return;
    let active = true;
    (async () => {
      try {
        const coreMod = await import("highlight.js/lib/core");
        interface HLCore {
          highlightElement: (el: HTMLElement) => void;
          registerLanguage: (name: string, lang: unknown) => void;
          getLanguage: (name: string) => unknown;
        }
        const core = coreMod as unknown as HLCore;
        const langs: Array<[string, () => Promise<unknown>]> = [
          ["javascript", () => import("highlight.js/lib/languages/javascript")],
          ["typescript", () => import("highlight.js/lib/languages/typescript")],
          ["json", () => import("highlight.js/lib/languages/json")],
          ["xml", () => import("highlight.js/lib/languages/xml")],
          ["bash", () => import("highlight.js/lib/languages/bash")],
          ["css", () => import("highlight.js/lib/languages/css")],
        ];
        await Promise.all(
          langs.map(async ([name, loader]) => {
            if (!core.getLanguage(name)) {
              const langMod = await loader();
              core.registerLanguage(
                name,
                (langMod as { default?: unknown }).default || langMod
              );
            }
          })
        );
        const el = document.getElementById("code-preview");
        if (active && el) {
          core.highlightElement(el as HTMLElement);
        }
      } catch {
        // silent fail
      }
    })();
    return () => {
      active = false;
    };
  }, [rawText, isText, isOpen, file]);

  if (!isOpen || !file) return null;

  const getFileIcon = () => {
    if (isImage)
      return <ImageIcon aria-hidden className="h-8 w-8 text-blue-500" />;
    if (isVideo)
      return <Video aria-hidden className="h-8 w-8 text-purple-500" />;
    if (isAudio)
      return <Music aria-hidden className="h-8 w-8 text-green-500" />;
    if (isPdf) return <FileText aria-hidden className="h-8 w-8 text-red-500" />;
    if (isText)
      return <FileText aria-hidden className="h-8 w-8 text-orange-500" />;
    return <Archive aria-hidden className="h-8 w-8 text-gray-500" />;
  };

  const getFileType = () => {
    if (isImage) return "Obraz";
    if (isVideo) return "Wideo";
    if (isAudio) return "Audio";
    if (isPdf) return "PDF";
    if (isText) return "Plik tekstowy";
    return "Plik";
  };

  // Prefer createdAt if available (extended type), otherwise fallback to lastModified
  type MaybeCreatedFile = FileItem & { createdAt?: Date };
  const createdAt: Date =
    (file as MaybeCreatedFile).createdAt ?? file.lastModified;

  return (
    <div
      className={`fixed inset-0 z-10000 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-200 ${entered ? "opacity-100" : "opacity-0"}`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <Card
        className={`w-full sm:max-w-lg md:max-w-3xl lg:max-w-4xl max-h-[95vh] sm:max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-xl transition-all duration-200 ease-out text-gray-900 ${entered ? "translate-y-0 md:scale-100 opacity-100" : "translate-y-4 md:translate-y-0 md:scale-[0.98] opacity-0"}`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <CardHeader className="sticky top-0 z-10 bg-white border-b border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3 text-gray-900">
          <div className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
            {getFileIcon()}
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3
                className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 truncate"
                title={file.name}
              >
                {file.name}
              </h3>
              <p className="text-[10px] sm:text-xs md:text-sm text-gray-600">
                {getFileType()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(file)}
              aria-label="Pobierz"
              className="px-2 sm:px-3 py-1.5"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0 sm:mr-2" />
              <span className="text-xs sm:text-sm hidden sm:inline">
                Pobierz
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Zamknij"
              className="no-min-touch p-1.5 sm:p-2"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-auto max-h-[calc(85vh-56px)] md:max-h-[calc(85vh-64px)]">
          {/* Informacje o pliku */}
          <div className="px-4 py-3 border-b border-gray-200 bg-white text-gray-900">
            {/* Mobile: stacked groups with horizontal separators */}
            <div className="sm:hidden text-sm">
              <div className="py-2">
                <div className="text-gray-600 text-center">Rozmiar</div>
                <div className="font-medium text-gray-900 text-center">
                  {formatBytes(file.size)}
                </div>
              </div>
              <div className="border-t border-gray-200 my-2" />
              <div className="py-2">
                <div className="text-gray-600 text-center">Utworzono</div>
                <div
                  className="font-medium text-gray-900 text-center whitespace-nowrap truncate"
                  title={formatDate(createdAt)}
                >
                  {formatDate(createdAt)}
                </div>
              </div>
              <div className="border-t border-gray-200 my-2" />
              <div className="py-2">
                <div className="text-gray-600 text-center">Typ</div>
                <div className="font-medium text-gray-900 text-center">
                  {ext.toUpperCase() || "N/A"}
                </div>
              </div>
            </div>

            {/* Desktop: centered full-width 3-column grid with vertical dividers and centered content */}
            <div className="hidden sm:block">
              <div className="w-full max-w-4xl mx-auto grid grid-cols-3 divide-x divide-gray-200">
                {/* Col 1 */}
                <div className="px-4 py-1.5 flex flex-col items-center text-center min-w-0 overflow-hidden">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                    <HardDrive aria-hidden className="h-4 w-4 text-gray-500" />
                    Rozmiar
                  </div>
                  <div
                    className="text-sm font-medium text-gray-900 text-center truncate max-w-[24ch]"
                    title={formatBytes(file.size)}
                  >
                    {formatBytes(file.size)}
                  </div>
                </div>
                {/* Col 2 */}
                <div className="px-4 py-1.5 flex flex-col items-center text-center min-w-0 overflow-hidden">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                    <Calendar aria-hidden className="h-4 w-4 text-gray-500" />
                    Utworzono
                  </div>
                  <div
                    className="text-sm font-medium text-gray-900 text-center truncate max-w-[24ch]"
                    title={formatDate(createdAt)}
                  >
                    {formatDate(createdAt)}
                  </div>
                </div>
                {/* Col 3 */}
                <div className="px-4 py-1.5 flex flex-col items-center text-center min-w-0 overflow-hidden">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                    <FileText aria-hidden className="h-4 w-4 text-gray-500" />
                    Typ
                  </div>
                  <div
                    className="text-sm font-medium text-gray-900 text-center truncate max-w-[24ch]"
                    title={ext.toUpperCase() || "N/A"}
                  >
                    {ext.toUpperCase() || "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Podgląd pliku */}
          <div className="p-4 md:p-6 bg-white text-gray-900">
            {loading && (
              <div className="flex flex-col items-center justify-center p-10 text-center text-gray-600 dark:text-gray-300">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-transparent dark:border-gray-600" />
                <p className="mt-4 text-sm">Ładowanie podglądu…</p>
              </div>
            )}

            {previewError && (
              <div className="text-center p-10">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-red-500" />
                <p className="text-red-600 dark:text-red-400 font-medium">
                  {previewError || "Nie udało się wczytać podglądu"}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                  Spróbuj ponownie lub pobierz plik.
                </p>
              </div>
            )}

            {previewUrl && !loading && !previewError && (
              <>
                {isImage && (
                  <div className="text-center">
                    <div className="relative mx-auto w-full max-w-4xl h-[60vh] md:h-[65vh]">
                      <NextImage
                        src={previewUrl}
                        alt={file.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 800px"
                        className="object-contain rounded-lg cursor-pointer hover:opacity-95 transition"
                        onClick={() => setLightbox(true)}
                        priority={false}
                        unoptimized
                      />
                    </div>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mt-2">
                      Kliknij, aby powiększyć
                    </p>
                  </div>
                )}

                {isVideo && (
                  <div className="text-center">
                    <video
                      src={previewUrl}
                      controls
                      className="mx-auto w-full max-w-4xl max-h-[60vh] md:max-h-[65vh] rounded-lg shadow-sm bg-black"
                    >
                      Twoja przeglądarka nie obsługuje odtwarzacza wideo.
                    </video>
                  </div>
                )}

                {isAudio && (
                  <div className="text-center">
                    <audio
                      src={previewUrl}
                      controls
                      className="w-full max-w-lg mx-auto"
                    >
                      Twoja przeglądarka nie obsługuje odtwarzacza audio.
                    </audio>
                  </div>
                )}

                {isPdf && (
                  <div className="text-center">
                    <iframe
                      src={previewUrl}
                      className="w-full h-[70vh] md:h-[65vh] border rounded-lg bg-white"
                      title={file.name}
                    />
                  </div>
                )}

                {isText && rawText !== null && (
                  <div className="rounded-lg border bg-gray-900 border-gray-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gray-800">
                      <span className="text-xs text-gray-300">
                        Podgląd tekstu
                      </span>
                      <button
                        className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-200 hover:bg-gray-700"
                        onClick={() => setCanWrapLines((v) => !v)}
                        aria-label="Przełącz zawijanie linii"
                      >
                        {canWrapLines ? "Wyłącz zawijanie" : "Włącz zawijanie"}
                      </button>
                    </div>
                    <div className="overflow-auto max-h-[60vh] md:max-h-[65vh]">
                      <pre
                        className={`text-sm ${canWrapLines ? "whitespace-pre-wrap" : "whitespace-pre"} text-gray-100 p-4`}
                      >
                        <code id="code-preview" className={`language-${ext}`}>
                          {rawText}
                        </code>
                      </pre>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border-t border-gray-800">
                      <span className="text-[11px] text-gray-400">
                        Załadowano: {textOffset.toLocaleString()} B
                      </span>
                      {hasMoreText && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!previewUrl || textLoadingMore) return;
                            try {
                              setTextLoadingMore(true);
                              const start = textOffset;
                              const end = start + TEXT_CHUNK - 1;
                              const res = await fetch(previewUrl, {
                                headers: { Range: `bytes=${start}-${end}` },
                              });
                              if (
                                !res.ok &&
                                res.status !== 206 &&
                                res.status !== 200
                              )
                                throw new Error("range");
                              const chunk = await res.text();
                              setRawText((prev) => (prev ?? "") + chunk);
                              setTextOffset(start + chunk.length);
                              setHasMoreText(chunk.length >= TEXT_CHUNK);
                            } catch {
                              setHasMoreText(false);
                            } finally {
                              setTextLoadingMore(false);
                            }
                          }}
                          aria-label="Załaduj więcej"
                        >
                          {textLoadingMore ? "Ładowanie…" : "Załaduj więcej"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {!isImage && !isVideo && !isAudio && !isPdf && !isText && (
                  <div className="text-center p-10 text-gray-700 dark:text-gray-300">
                    <Archive className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                    <p className="font-medium">
                      Podgląd nie jest dostępny dla tego typu pliku
                    </p>
                    <p className="text-sm mt-2">
                      Pobierz plik, aby go otworzyć.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox dla obrazów */}
      {lightbox && isImage && previewUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-10001 p-4"
          onClick={() => setLightbox(false)}
        >
          <div
            className="relative w-full h-full overflow-hidden"
            onWheel={(e) => {
              if (e.ctrlKey) return; // pozwól przeglądarce na systemowy zoom
              if (e.deltaY < 0)
                setZoom((z) => Math.min(5, +(z + 0.2).toFixed(2)));
              else setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)));
            }}
          >
            <NextImage
              src={previewUrl}
              alt={file.name}
              fill
              className="object-contain"
              onClick={(e) => {
                e.stopPropagation();
                // double-click to toggle zoom
                setZoom((z) => (z > 1 ? 1 : 2));
              }}
              sizes="100vw"
              priority
              unoptimized
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
              }}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightbox(false)}
          >
            <X className="h-6 w-6" />
          </Button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur px-2 py-1 rounded-full text-white">
            <button
              className="p-2 hover:bg-white/20 rounded-full"
              aria-label="Pomniejsz"
              onClick={(e) => {
                e.stopPropagation();
                setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)));
              }}
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="text-xs px-1 min-w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="p-2 hover:bg-white/20 rounded-full"
              aria-label="Powiększ"
              onClick={(e) => {
                e.stopPropagation();
                setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)));
              }}
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              className="p-2 hover:bg-white/20 rounded-full"
              aria-label="Resetuj zoom"
              onClick={(e) => {
                e.stopPropagation();
                setZoom(1);
              }}
            >
              <RefreshCcw className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilePreviewModal;
