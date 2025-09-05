"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Download, FileText, Calendar, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatDate, formatBytes } from '@/lib/utils';
import FileTypeIcon from '@/components/file/FileTypeIcon';

interface FileData { key: string; fileName: string; originalName: string; createdAt: Date; expiresAt: Date; owner: string; size?: number|null; mime?: string|null; thumbnailUrl?: string|null; }
interface FilePreviewProps { file: FileData; downloadUrl: string; slug: string; }

function FilePreview({ file, downloadUrl, slug }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawText, setRawText] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const ext = file.fileName.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isText = ['txt','md','json','xml','html','css','js','ts','tsx','jsx','sh'].includes(ext);
  const isVideo = ['mp4','webm','mov','mkv','ogg'].includes(ext);
  const isAudio = ['mp3','wav','flac','m4a','aac','opus'].includes(ext);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isImage || isPdf || isVideo || isAudio) {
          setPreviewUrl(downloadUrl);
          if (!cancelled) setLoading(false);
        } else if (isText) {
          const txt = await fetch(downloadUrl).then(r=>r.text());
          if (cancelled) return;
          setRawText(txt.slice(0,200_000));
          setPreviewUrl(`data:text/plain;charset=utf-8,${encodeURIComponent(txt)}`);
          setLoading(false);
        } else {
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setPreviewError('Nie można załadować podglądu pliku'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [downloadUrl,isImage,isPdf,isVideo,isAudio,isText]);

  useEffect(() => {
    if (!rawText || !isText) return;
    if (typeof window === 'undefined') return; // SSR guard
    let active = true;
    (async () => {
      try {
        const coreMod = await import('highlight.js/lib/core');
        // minimal interface to satisfy TS without full types
        interface HLCore {
          highlightElement: (el: HTMLElement) => void;
          registerLanguage: (name: string, lang: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
          getLanguage: (name: string) => unknown;
        }
        const core = coreMod as unknown as HLCore;
        // Selectively register a few common languages to reduce bundle size
        const langs: Array<[string, () => Promise<unknown>]> = [
          ['javascript', () => import('highlight.js/lib/languages/javascript')],
          ['typescript', () => import('highlight.js/lib/languages/typescript')],
          ['json', () => import('highlight.js/lib/languages/json')],
          ['xml', () => import('highlight.js/lib/languages/xml')],
          ['bash', () => import('highlight.js/lib/languages/bash')],
          ['css', () => import('highlight.js/lib/languages/css')]
        ];
        await Promise.all(langs.map(async ([name, loader]) => {
          if (!core.getLanguage(name)) {
            const langMod = await loader();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            core.registerLanguage(name, (langMod as any).default || langMod);
          }
        }));
        const el = document.getElementById('code-preview');
        if (active && el) {
          core.highlightElement(el as HTMLElement);
        }
      } catch {
        // silent fail
      }
    })();
    return () => { active = false; };
  }, [rawText, isText]);

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/files/public-download?slug=${encodeURIComponent(slug)}`);
      
      if (response.ok) {
        const { presignedUrl } = await response.json();
        // Natywne pobieranie przez przeglądarkę
        window.location.href = presignedUrl;
      } else {
        // Fallback: bezpośredni link
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.originalName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      // Fallback: bezpośredni link
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {previewUrl && !previewError && (
        <Card>
          <CardHeader>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Podgląd</h3>
          </CardHeader>
          <CardContent>
            {isImage && (
              <div className="flex justify-center">
                <Image
                  src={previewUrl}
                  alt={file.originalName}
                  width={800}
                  height={600}
                  priority
                  onClick={() => setLightbox(true)}
                  className="h-auto w-auto max-h-[55vh] object-contain rounded-md shadow-sm cursor-zoom-in"
                />
              </div>
            )}
            {isPdf && (
              <div className="w-full h-[65vh] max-h-[600px]">
                <iframe
                  src={previewUrl}
                  className="w-full h-full border rounded-md bg-white"
                  title={file.originalName}
                />
              </div>
            )}
            {isVideo && (
              <div className="w-full">
                <video
                  controls
                  preload="metadata"
                  onClick={() => setLightbox(true)}
                  className="w-full max-h-[65vh] rounded-md bg-black cursor-zoom-in"
                  src={previewUrl}
                />
              </div>
            )}
            {isAudio && (
              <div className="flex flex-col items-center gap-4">
                <FileTypeIcon fileName={file.fileName} size="sm" />
                <audio controls className="w-full">
                  <source src={previewUrl} />
                  Twoja przeglądarka nie obsługuje audio.
                </audio>
              </div>
            )}
            {isText && rawText && (
              <div className="bg-gray-900 text-gray-100 p-3 sm:p-4 rounded-md max-h-[60vh] overflow-auto text-sm font-mono">
                <pre>
                  <code
                    id="code-preview"
                    className={`language-${ext === 'ts' || ext === 'tsx' ? 'typescript' : ext}`}
                  >
                    {rawText}
                  </code>
                </pre>
              </div>
            )}
            {!isImage && !isPdf && !isVideo && !isAudio && !isText && (
              <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                <FileTypeIcon fileName={file.fileName} size="lg" />
                <p className="text-sm text-gray-600 max-w-xs">
                  Brak wbudowanego podglądu dla tego typu pliku.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {previewError && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center text-yellow-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{previewError}</span>
            </div>
          </CardContent>
        </Card>
      )}
      <button
        id="download-direct"
        onClick={handleDownload}
        className="hidden"
        aria-hidden="true"
      />
      {lightbox && previewUrl && (isImage || isVideo) && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            aria-label="Zamknij podgląd"
            className="absolute top-4 right-4 text-white text-sm bg-black/40 px-3 py-1 rounded-md hover:bg-black/60"
            onClick={() => setLightbox(false)}
          >
            Zamknij
          </button>
          {isImage && (
            <Image
              src={previewUrl}
              alt={file.originalName}
              width={1600}
              height={1200}
              className="max-h-[90vh] w-auto h-auto object-contain rounded-md shadow-2xl"
              priority
            />
          )}
          {isVideo && (
            <video
              src={previewUrl}
              controls
              autoPlay
              className="max-h-[90vh] max-w-full rounded-md shadow-2xl"
            />
          )}
        </div>
      )}
    </div>
  );
}


export default function PublicFilePage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFileData = async () => {
      try {
        const response = await fetch(`/api/files/shared?slug=${slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Plik nie został znaleziony');
          } else if (response.status === 410) {
            setError('Link do pliku wygasł');
          } else {
            setError('Błąd podczas ładowania pliku');
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setFileData(data.fileData);
        setDownloadUrl(data.downloadUrl);
      } catch {
        setError('Błąd podczas ładowania pliku');
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      fetchFileData();
    }
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Ładowanie pliku...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Błąd</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button variant="outline" onClick={() => window.history.back()}>
              Wróć
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!fileData || !downloadUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Błąd</h2>
            <p className="text-gray-600">Nie można załadować danych pliku</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 py-6 sm:py-8 flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <FileTypeIcon fileName={fileData.fileName} size="md" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-all">{fileData.originalName}</h1>
              <p className="text-gray-600 text-sm sm:text-base">Plik udostępniony z chmury Blokserwis</p>
            </div>
          </div>
          <div className="flex sm:flex-col md:flex-row gap-3 w-full sm:w-auto">
            <Button onClick={() => window.location.reload()} variant="outline" className="flex-1 sm:flex-none">Odśwież</Button>
          </div>
        </header>

        <div className="grid gap-6 lg:gap-8 grid-cols-1 xl:grid-cols-3">
          {/* Info panel */}
          <aside className="order-2 xl:order-1 xl:col-span-1 flex flex-col gap-6">
            <Card>
              <CardHeader>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Informacje</h3>
              </CardHeader>
              <CardContent className="space-y-4 text-sm sm:text-[0.95rem]">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Nazwa</p>
                    <p className="font-medium text-gray-900 break-all">{fileData.originalName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Utworzono</p>
                    <p className="font-medium text-gray-900">{formatDate(fileData.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Wygasa</p>
                    <p className="font-medium text-gray-900">{formatDate(fileData.expiresAt)}</p>
                  </div>
                </div>
                {fileData.size !== undefined && fileData.size !== null && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Rozmiar</p>
                      <p className="font-medium text-gray-900">{formatBytes(fileData.size)}</p>
                    </div>
                  </div>
                )}
                {fileData.mime && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Typ MIME</p>
                      <p className="font-medium text-gray-900 break-all">{fileData.mime}</p>
                    </div>
                  </div>
                )}
                <div className="pt-3 border-t border-gray-200 flex flex-col gap-2">
                  <Button
                    onClick={() => document.querySelector<HTMLButtonElement>('#download-direct')?.click()}
                    size="md"
                    className="w-full gap-2"
                  >
                    <Download className="h-5 w-5" /> Pobierz
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Preview */}
            <div className="order-1 xl:order-2 xl:col-span-2">
              <FilePreview file={fileData} downloadUrl={downloadUrl} slug={slug} />
            </div>
        </div>
      </div>
    </div>
  );
}
