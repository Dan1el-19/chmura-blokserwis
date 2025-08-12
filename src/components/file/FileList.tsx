import React from 'react';
import { 
  Download, 
  Trash2, 
  Share2, 
  File, 
  Folder,
  MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatBytes } from '@/lib/utils';
import type { FileItem } from '@/types';

interface FileListProps {
  files: FileItem[];
  onDownload: (file: FileItem) => void;
  onPreview?: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
}

export default function FileList({
  files,
  onDownload,
  onPreview,
  onShare,
  onDelete
}: FileListProps) {
  return (
    <Card>
      <CardHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Pliki</h3>
      </CardHeader>
      
      {files.length === 0 ? (
        <CardContent className="p-6 sm:p-8 text-center">
          <Folder className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Brak plików w tym folderze</p>
        </CardContent>
      ) : (
        <div className="divide-y divide-gray-200">
          {files.map((file) => (
            <FileItem
              key={file.key}
              file={file}
              onDownload={onDownload}
              onPreview={onPreview}
              onShare={onShare}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface FileItemProps {
  file: FileItem;
  onDownload: (file: FileItem) => void;
  onPreview?: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
}

function FileItem({ file, onDownload, onPreview, onShare, onDelete }: FileItemProps) {
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);

  return (
    <div className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors">
      {/* Desktop Layout */}
      <div className="hidden sm:flex items-center justify-between">
        <div 
          className="flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-gray-100 rounded-md p-2 -m-2 transition-colors"
          onClick={() => onPreview?.(file)}
        >
          <File className="h-7 w-7 sm:h-8 sm:w-8 text-blue-500" />
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
          <div 
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:bg-gray-100 rounded-md p-2 -m-2 transition-colors"
            onClick={() => onPreview?.(file)}
          >
            <File className="h-6 w-6 text-blue-500 flex-shrink-0" />
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(file)}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Pobierz
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShare(file)}
                className="flex-1"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Udostępnij
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(file)}
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
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
