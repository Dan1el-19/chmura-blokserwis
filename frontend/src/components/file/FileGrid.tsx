"use client";
import { useState, useEffect } from 'react';
import { 
  File, 
  Image, 
  Video, 
  Music, 
  Archive, 
  FileText, 
  HardDrive,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  BarChart3
} from 'lucide-react';
import { FileItem } from '@/types';
import { formatBytes } from '@/lib/utils';

import { auth } from '@/lib/firebase';

interface FileGridProps {
  files: FileItem[];
  currentFolder: string;
  viewMode: 'grid' | 'list';
  onDownload: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onManageLinks: (file: FileItem) => void;
  onStats: (file: FileItem) => void;
  uploads?: Array<{
    id: string;
    fileName: string;
    folder: string;
    uploadedBytes: number;
    size: number;
  }>;
}

export default function FileGrid({ 
  files, 
  currentFolder, 
  viewMode,
  onDownload, 
  onShare, 
  onDelete, 
  onManageLinks, 
  onStats,
  uploads = []
}: FileGridProps) {

  const [showActions, setShowActions] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  // Ładuj thumbnail URL-e dla obrazów
  useEffect(() => {
    const loadThumbnailUrls = async () => {
      const newThumbnailUrls: Record<string, string> = {};
      
      for (const file of files) {
        if (isImageFile(file.name) && !file.publicUrl) {
          try {
            const response = await fetch(`/api/files/presigned?key=${encodeURIComponent(file.key)}`, {
              headers: {
                'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              newThumbnailUrls[file.key] = data.presignedUrl;
            }
          } catch (error) {
            console.error('Error getting presigned URL for', file.key, error);
          }
        }
      }
      
      setThumbnailUrls(newThumbnailUrls);
    };

    if (files.length > 0) {
      loadThumbnailUrls();
    }
  }, [files]);

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return <File className="h-8 w-8" />;
    
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
    
    if (imageExts.includes(extension)) return <Image className="h-8 w-8" />;
    if (videoExts.includes(extension)) return <Video className="h-8 w-8" />;
    if (audioExts.includes(extension)) return <Music className="h-8 w-8" />;
    if (archiveExts.includes(extension)) return <Archive className="h-8 w-8" />;
    if (docExts.includes(extension)) return <FileText className="h-8 w-8" />;
    
    return <File className="h-8 w-8" />;
  };

  const isImageFile = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    return extension ? imageExts.includes(extension) : false;
  };

  const getThumbnailUrl = (file: FileItem) => {
    // Jeśli plik ma publicUrl, użyj go jako miniaturki
    if (file.publicUrl) return file.publicUrl;
    
    // Jeśli to obraz, użyj presigned URL z cache
    if (isImageFile(file.name)) {
      return thumbnailUrls[file.key] || null;
    }
    
    return null;
  };

  const formatDate = (date: Date) => {
    try {
      if (!date || isNaN(date.getTime())) {
        return 'Nieznana data';
      }
      return new Intl.DateTimeFormat('pl-PL', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return 'Nieznana data';
    }
  };

  const handleFileClick = () => {
    // File click handler - can be extended later
  };

  const handleActionClick = (fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setShowActions(showActions === fileId ? null : fileId);
  };

  const handleAction = (action: string, file: FileItem) => {
    setShowActions(null);
    switch (action) {
      case 'download':
        onDownload(file);
        break;
      case 'share':
        onShare(file);
        break;
      case 'delete':
        onDelete(file);
        break;
      case 'manage':
        onManageLinks(file);
        break;
      case 'stats':
        onStats(file);
        break;
    }
  };

  const filteredUploads = uploads.filter(upload => upload.folder === currentFolder);

  return (
    <div className="space-y-6">
      {/* Upload Progress Section */}
      {filteredUploads.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">
            Uploady w toku ({filteredUploads.length})
          </h3>
          <div className="space-y-2">
            {filteredUploads.map((upload) => (
              <div key={upload.id} className="flex items-center justify-between text-sm">
                <span className="text-blue-800 truncate">{upload.fileName}</span>
                <span className="text-blue-600">
                  {Math.round((upload.uploadedBytes / upload.size) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Grid */}
      {files.length === 0 ? (
        <div className="text-center py-12">
          <HardDrive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2 font-roboto">
            Brak plików w tym folderze
          </h3>
          <p className="text-gray-500">
            {currentFolder === 'personal' ? 'Twój folder jest pusty' : 'Folder główny jest pusty'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {files.map((file) => {
            const thumbnailUrl = thumbnailUrls[file.key] || getThumbnailUrl(file);
            
            return (
              <div
                key={file.key}
                className="group relative bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => handleFileClick()}
                role="button"
                tabIndex={0}
                aria-label={`Plik: ${file.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleFileClick();
                  }
                }}
              >
                {/* Thumbnail/Icon */}
                <div className="aspect-square mb-3 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                  {thumbnailUrl && isImageFile(file.name) ? (
                    <img 
                      alt={file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      src={thumbnailUrl}
                      onError={(e) => {
                        // Fallback do ikony jeśli obraz się nie załaduje
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`${thumbnailUrl && isImageFile(file.name) ? 'hidden' : ''} flex items-center justify-center`}>
                    {getFileIcon(file.name)}
                  </div>
                </div>

                {/* File Info */}
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 truncate mb-1" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatBytes(file.size)}
                  </p>
                </div>

                {/* Actions Menu */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleActionClick(file.key, e)}
                    className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500 px-3 py-1.5 text-sm p-1 bg-white bg-opacity-90 hover:bg-opacity-100"
                    aria-label="Opcje pliku"
                    aria-haspopup={true}
                    aria-expanded={showActions === file.key}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  
                  {showActions === file.key && (
                    <div 
                      className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
                      role="menu"
                      aria-label="Opcje pliku"
                    >
                      <div className="py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction('download', file);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          role="menuitem"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Pobierz
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction('share', file);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          role="menuitem"
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          Udostępnij
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction('manage', file);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          role="menuitem"
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          Zarządzaj linkami
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction('stats', file);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          role="menuitem"
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Statystyki
                        </button>
                        <hr className="my-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction('delete', file);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                          role="menuitem"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Usuń
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // List View
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.key}
              className="group relative flex items-center space-x-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                              onClick={() => handleFileClick()}
              role="button"
              tabIndex={0}
              aria-label={`Plik: ${file.name}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleFileClick();
                }
              }}
            >
              {/* File Icon */}
              <div className="flex-shrink-0">
                {getFileIcon(file.name)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatBytes(file.size)} • {formatDate(file.lastModified)}
                </p>
              </div>

              {/* Actions Menu */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleActionClick(file.key, e)}
                  className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500 px-3 py-1.5 text-sm p-1"
                  aria-label="Opcje pliku"
                  aria-haspopup={true}
                  aria-expanded={showActions === file.key}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                
                {showActions === file.key && (
                  <div 
                    className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
                    role="menu"
                    aria-label="Opcje pliku"
                  >
                    <div className="py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('download', file);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        role="menuitem"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Pobierz
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('share', file);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        role="menuitem"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Udostępnij
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('manage', file);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        role="menuitem"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Zarządzaj linkami
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('stats', file);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        role="menuitem"
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Statystyki
                      </button>
                      <hr className="my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('delete', file);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                        role="menuitem"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Usuń
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
