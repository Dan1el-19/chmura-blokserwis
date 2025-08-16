import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Trash2, 
  Share2, 
  Folder,
  MoreVertical,
  Grid3X3,
  List,
  Eye,
  X,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatBytes } from '@/lib/utils';
import type { FileItem } from '@/types';
import { auth } from '@/lib/firebase';

interface FileGridProps {
  files: FileItem[];

  onDownload: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onManageLinks: (file: FileItem) => void;
  onStats: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
}

type ViewMode = 'grid' | 'list';

export default function FileGrid({
  files,
  onDownload,
  onShare,
  onManageLinks,
  onStats,
  onDelete
}: FileGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    // Ikony dla różnych typów plików
    const iconMap: Record<string, string> = {
      pdf: '📄',
      doc: '📝',
      docx: '📝',
      xls: '📊',
      xlsx: '📊',
      ppt: '📈',
      pptx: '📈',
      txt: '📄',
      md: '📝',
      json: '📋',
      xml: '📋',
      html: '🌐',
      css: '🎨',
      js: '⚡',
      ts: '⚡',
      py: '🐍',
      java: '☕',
      cpp: '⚙️',
      c: '⚙️',
      zip: '📦',
      rar: '📦',
      '7z': '📦',
      mp3: '🎵',
      wav: '🎵',
      mp4: '🎬',
      avi: '🎬',
      mov: '🎬',
      gif: '🖼️',
      svg: '🖼️'
    };

    return iconMap[extension || ''] || '📄';
  };

  const isImage = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension || '');
  };



  const handleFileClick = (file: FileItem) => {
    if (isImage(file.name)) {
      setSelectedFile(file);
    } else {
      onDownload(file);
    }
  };

  const closePreview = () => {
    setSelectedFile(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Pliki</h3>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="p-2"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="p-2"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {files.length === 0 ? (
          <CardContent className="p-6 sm:p-8 text-center">
            <Folder className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Brak plików w tym folderze</p>
          </CardContent>
        ) : (
          <CardContent className="p-0">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 sm:p-6">
                {files.map((file) => (
                  <FileGridItem
                    key={file.key}
                    file={file}
                    onDownload={onDownload}
                    onShare={onShare}
                    onManageLinks={onManageLinks}
                    onStats={onStats}
                    onDelete={onDelete}
                    onClick={handleFileClick}
                    getFileIcon={getFileIcon}
                    isImage={isImage}
                  />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {files.map((file) => (
                  <FileListItem
                    key={file.key}
                    file={file}
                    onDownload={onDownload}
                    onShare={onShare}
                    onManageLinks={onManageLinks}
                    onStats={onStats}
                    onDelete={onDelete}
                    onClick={handleFileClick}
                    getFileIcon={getFileIcon}
                    isImage={isImage}
                  />
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Image Preview Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={closePreview}
              className="absolute top-4 right-4 z-10 bg-white bg-opacity-90 hover:bg-opacity-100"
            >
              <X className="h-6 w-6" />
            </Button>
            
            <div className="bg-white rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{selectedFile.name}</h3>
                <p className="text-sm text-gray-600">
                  {formatBytes(selectedFile.size)} • {new Date(selectedFile.lastModified).toLocaleDateString('pl-PL')}
                </p>
              </div>
              
              <div className="flex justify-center p-4">
                <ThumbnailImage
                  file={selectedFile}
                  className="max-w-full max-h-96 object-contain rounded-lg"
                  alt={selectedFile.name}
                />
              </div>
              
              <div className="p-4 border-t border-gray-200 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onDownload(selectedFile)}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Pobierz
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onShare(selectedFile)}
                  className="flex-1"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Udostępnij
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onManageLinks(selectedFile)}
                  className="flex-1"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Zarządzaj linkami
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onStats(selectedFile)}
                  className="flex-1"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Statystyki
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface FileItemProps {
  file: FileItem;
  onDownload: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onManageLinks: (file: FileItem) => void;
  onStats: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onClick: (file: FileItem) => void;
  getFileIcon: (fileName: string) => string;
  isImage: (fileName: string) => boolean;
}

function FileGridItem({
  file,
  onDownload,
  onShare,
  onManageLinks,
  onStats,
  onDelete,
  onClick,
  getFileIcon,
  isImage
}: FileItemProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div 
      className="group relative bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
      onClick={() => onClick(file)}
    >
      {/* Thumbnail */}
      <div className="aspect-square mb-3 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
        {isImage(file.name) ? (
          <ThumbnailImage
            file={file}
            className="w-full h-full object-cover"
            alt={file.name}
          />
        ) : (
          <span className="text-4xl">{getFileIcon(file.name)}</span>
        )}
      </div>

      {/* File Info */}
      <div className="text-center">
        <p className="text-sm font-medium text-gray-900 truncate mb-1">
          {file.name}
        </p>
        <p className="text-xs text-gray-500">
          {formatBytes(file.size)}
        </p>
      </div>

      {/* Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(!showActions);
          }}
          className="p-1 bg-white bg-opacity-90 hover:bg-opacity-100"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Actions Menu */}
      {showActions && (
        <div className="absolute top-8 right-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-32">
          <div className="p-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(file);
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Pobierz
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare(file);
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Udostępnij
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onManageLinks(file);
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Zarządzaj linkami
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStats(file);
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Statystyki
            </button>
            {isImage(file.name) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(file);
                  setShowActions(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Podgląd
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file);
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 rounded flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Usuń
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FileListItem({
  file,
  onDownload,
  onShare,
  onManageLinks,
  onStats,
  onDelete,
  onClick,
  getFileIcon,
  isImage
}: FileItemProps) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <div className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors">
      {/* Desktop Layout */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Thumbnail */}
          <div className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
            {isImage(file.name) ? (
              <ThumbnailImage
                file={file}
                className="w-full h-full object-cover"
                alt={file.name}
              />
            ) : (
              <span className="text-xl">{getFileIcon(file.name)}</span>
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base font-medium text-gray-900 truncate">
              {file.name}
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              {formatBytes(file.size)} • {new Date(file.lastModified).toLocaleDateString('pl-PL')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          {isImage(file.name) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onClick(file)}
              className="p-2"
              title="Podgląd"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDownload(file)}
            className="p-2"
            title="Pobierz"
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onShare(file)}
            className="p-2"
            title="Udostępnij"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onManageLinks(file)}
            className="p-2"
            title="Zarządzaj linkami"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStats(file)}
            className="p-2"
            title="Statystyki"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(file)}
            className="p-2 text-gray-400 hover:text-red-600"
            title="Usuń"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Thumbnail */}
            <div className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
              {isImage(file.name) ? (
                <ThumbnailImage
                  file={file}
                  className="w-full h-full object-cover"
                  alt={file.name}
                />
              ) : (
                <span className="text-lg">{getFileIcon(file.name)}</span>
              )}
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatBytes(file.size)} • {new Date(file.lastModified).toLocaleDateString('pl-PL')}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 ml-2"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile Actions Menu */}
        {showMobileMenu && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex gap-2 flex-wrap">
              {isImage(file.name) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onClick(file)}
                  className="flex-1 min-w-0"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Podgląd
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(file)}
                className="flex-1 min-w-0"
              >
                <Download className="h-4 w-4 mr-2" />
                Pobierz
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShare(file)}
                className="flex-1 min-w-0"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Udostępnij
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(file)}
                className="flex-1 min-w-0 text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Usuń
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Komponent do ładowania miniatur z autoryzacją
interface ThumbnailImageProps {
  file: FileItem;
  className?: string;
  alt?: string;
}

function ThumbnailImage({ file, className, alt }: ThumbnailImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);
        
        const user = auth.currentUser;
        if (!user) {
          setError(true);
          return;
        }

        const token = await user.getIdToken();
        const response = await fetch(`/api/files/presigned?key=${encodeURIComponent(file.key)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const { presignedUrl } = await response.json();
          setImageUrl(presignedUrl);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error loading thumbnail:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [file.key]);

  if (loading) {
    return (
      <div className={`${className} bg-gray-100 animate-pulse flex items-center justify-center`}>
        <div className="w-4 h-4 bg-gray-300 rounded"></div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`${className} bg-gray-50 flex items-center justify-center`}>
        <span className="text-gray-400">📄</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt || file.name}
      className={className}
      loading="lazy"
    />
  );
}
