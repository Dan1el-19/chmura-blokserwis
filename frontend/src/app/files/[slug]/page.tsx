'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Download, 
  FileText, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

interface FileData {
  key: string;
  fileName: string;
  originalName: string;
  createdAt: Date;
  expiresAt: Date;
  owner: string;
}

interface FilePreviewProps {
  file: FileData;
  downloadUrl: string;
  slug: string;
}

function FilePreview({ file, downloadUrl, slug }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fileExtension = file.fileName.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');
  const isPdf = fileExtension === 'pdf';
  const isText = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(fileExtension || '');

  useEffect(() => {
    if (isImage) {
      // Dla obrazów używamy bezpośrednio URL do pobrania
      setPreviewUrl(downloadUrl);
      setIsLoading(false);
    } else if (isPdf) {
      // Dla PDF używamy embed
      setPreviewUrl(downloadUrl);
      setIsLoading(false);
    } else if (isText) {
      // Dla plików tekstowych pobieramy zawartość
      fetch(downloadUrl)
        .then(response => response.text())
        .then(text => {
          setPreviewUrl(`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
          setIsLoading(false);
        })
        .catch(() => {
          setPreviewError('Nie można załadować podglądu pliku');
          setIsLoading(false);
        });
    } else {
      // Dla innych plików nie ma podglądu
      setIsLoading(false);
    }
  }, [downloadUrl, isImage, isPdf, isText]);

  const handleDownload = async () => {
    try {
      // Użyj nowego endpointu dla publicznego pobierania
      const response = await fetch(`/api/files/public-download?slug=${encodeURIComponent(slug)}`);
      
      if (response.ok) {
        // Pobierz plik jako blob
        const blob = await response.blob();
        
        // Utwórz URL dla blob
        const url = window.URL.createObjectURL(blob);
        
        // Utwórz link i wymuś pobieranie
        const link = document.createElement('a');
        link.href = url;
        link.download = file.originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Wyczyść URL
        window.URL.revokeObjectURL(url);
      } else {
        console.error('Błąd podczas pobierania pliku');
        // Fallback do presigned URL
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = file.originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Błąd podczas pobierania pliku:', error);
      // Fallback do presigned URL
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Podgląd pliku */}
      {previewUrl && !previewError && (
        <Card>
          <CardHeader>
                         <h3 className="text-lg font-semibold text-gray-900">Podgląd pliku</h3>
          </CardHeader>
          <CardContent>
            {isImage && (
              <div className="flex justify-center">
                <img 
                  src={previewUrl} 
                  alt={file.originalName}
                  className="max-w-full max-h-96 object-contain rounded-lg shadow-sm"
                />
              </div>
            )}
            {isPdf && (
              <div className="w-full h-96">
                <iframe
                  src={previewUrl}
                  className="w-full h-full border rounded-lg"
                  title={file.originalName}
                />
              </div>
            )}
            {isText && (
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-auto">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    Kliknij aby otworzyć w nowej karcie
                  </a>
                </pre>
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

      {/* Przycisk pobierania */}
      <div className="flex justify-center">
        <Button 
          onClick={handleDownload}
          size="lg"
          className="flex items-center gap-2"
        >
          <Download className="h-5 w-5" />
          Pobierz plik
        </Button>
      </div>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {fileData.originalName}
          </h1>
          <p className="text-gray-600">
            Plik udostępniony z chmury Blokserwis
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Informacje o pliku */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-900">Informacje o pliku</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Nazwa pliku</p>
                                         <p className="font-medium text-gray-900">{fileData.originalName}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Data utworzenia</p>
                                         <p className="font-medium text-gray-900">{formatDate(fileData.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Wygasa</p>
                                         <p className="font-medium text-gray-900">{formatDate(fileData.expiresAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Podgląd i pobieranie */}
          <div className="lg:col-span-2">
            <FilePreview file={fileData} downloadUrl={downloadUrl} slug={slug} />
          </div>
        </div>
      </div>
    </div>
  );
}
