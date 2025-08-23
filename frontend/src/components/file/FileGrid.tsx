"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  File, 
  Image as ImageIcon, 
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
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const clickAnchorRef = useRef<DOMRect | null>(null);

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
    
  if (imageExts.includes(extension)) return <ImageIcon className="h-8 w-8" />;
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

  const handleActionClick = (fileId: string, file: FileItem, event: React.MouseEvent) => {
    event.stopPropagation();
    if (showActions === fileId) {
      setShowActions(null);
      setMenuPosition(null);
      setActiveFile(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    clickAnchorRef.current = rect;
    // Wstępna pozycja (poniżej i wyrównanie do prawej krawędzi przycisku)
    setMenuPosition({ top: rect.bottom + 6, left: rect.right - 192 });
    setShowActions(fileId);
    setActiveFile(file);
  };

  const closeMenu = useCallback(() => {
    setShowActions(null);
    setMenuPosition(null);
    setActiveFile(null);
  }, []);

  const handleAction = (action: string, file: FileItem) => {
    closeMenu();
    switch (action) {
      case 'download':
        onDownload(file); break;
      case 'share':
        onShare(file); break;
      case 'delete':
        onDelete(file); break;
      case 'manage':
        onManageLinks(file); break;
      case 'stats':
        onStats(file); break;
    }
  };

  // Close on click outside / escape / resize / scroll
  useEffect(() => {
    if (!showActions) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-file-menu]')) return;
      closeMenu();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    const handleWindowChange = () => closeMenu();
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [showActions, closeMenu]);

  // Reposition after render & on size/position change
  useEffect(() => {
    if (!showActions) return;
    requestAnimationFrame(() => {
      const el = menuRef.current;
      const anchor = clickAnchorRef.current;
      if (!el || !anchor) return;
      const rect = el.getBoundingClientRect();
      let { top, left } = menuPosition || { top: anchor.bottom + 6, left: anchor.right - rect.width };
      if (left < 8) left = 8;
      if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
      if (top + rect.height > window.innerHeight - 8) {
        const aboveTop = anchor.top - rect.height - 6;
        if (aboveTop >= 8) top = aboveTop;
      }
      if (!menuPosition || top !== menuPosition.top || left !== menuPosition.left) {
        setMenuPosition({ top, left });
      }
    });
  }, [showActions, menuPosition]);

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
          {files.map((file, idx) => {
            const thumbnailUrl = thumbnailUrls[file.key] || getThumbnailUrl(file);
            
            return (
              <div
                key={file.key}
                className="group relative glass-card bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg p-3 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer file-tile-animate"
                style={{ animationDelay: `${idx * 40}ms` }}
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
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        src={thumbnailUrl}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          // Fallback do ikony jeśli obraz się nie załaduje
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    </>
                  ) : null}
                  <div className={`${thumbnailUrl && isImageFile(file.name) ? 'hidden' : ''} flex items-center justify-center`}>
                    {getFileIcon(file.name)}
                  </div>
                </div>

                {/* File Info + Actions (inline) */}
                <div className="mt-1">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                    </div>
                    <button
                      onClick={(e) => handleActionClick(file.key, file, e)}
                      className="mt-0.5 inline-flex items-center justify-center rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 p-1 transition-colors"
                      aria-label="Opcje pliku"
                      aria-haspopup={true}
                      aria-expanded={showActions === file.key}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // List View
        <div className="space-y-2 relative overflow-visible">
          {files.map((file) => (
            <div
              key={file.key}
                             className="group relative flex items-center space-x-4 p-4 glass-card bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer overflow-visible"
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

              {/* Actions Menu (always visible) */}
              <div className="flex-shrink-0">
                <button
                  onClick={(e) => handleActionClick(file.key, file, e)}
                  className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500 px-3 py-1.5 text-sm p-1"
                  aria-label="Opcje pliku"
                  aria-haspopup={true}
                  aria-expanded={showActions === file.key}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Portal dla menu akcji */}
      {showActions && menuPosition && activeFile && createPortal(
        <div
          data-file-menu
          ref={menuRef}
          className="fixed z-[9999] w-48 bg-white border border-gray-200 rounded-lg shadow-lg animate-in fade-in data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 will-change-transform"
          role="menu"
          aria-label="Opcje pliku"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div className="py-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('download', activeFile); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              role="menuitem"
            >
              <Download className="h-4 w-4 mr-2" />
              Pobierz
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('share', activeFile); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              role="menuitem"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Udostępnij
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('manage', activeFile); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              role="menuitem"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Zarządzaj linkami
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('stats', activeFile); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              role="menuitem"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Statystyki
            </button>
            <hr className="my-1" />
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('delete', activeFile); }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
              role="menuitem"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Usuń
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
