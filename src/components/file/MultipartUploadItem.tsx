import React from 'react';
import { MultipartUploadState } from '@/types/multipart';
import SmoothProgressBar from '@/components/ui/SmoothProgressBar';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { 
  Pause, 
  Play, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Upload,
  HardDrive
} from 'lucide-react';

interface MultipartUploadItemProps {
  upload: MultipartUploadState;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function MultipartUploadItem({ 
  upload, 
  onPause, 
  onResume, 
  onCancel, 
  onRemove 
}: MultipartUploadItemProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    switch (upload.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'uploading':
        return <Upload className="w-4 h-4 text-blue-500" />;
      case 'initializing':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <HardDrive className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (upload.status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'uploading':
        return 'bg-blue-100 text-blue-800';
      case 'initializing':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (upload.status) {
      case 'completed':
        return 'Ukończono';
      case 'error':
        return 'Błąd';
      case 'paused':
        return 'Wstrzymano';
      case 'uploading':
        return 'Wgrywanie';
      case 'initializing':
        return 'Inicjalizacja';
      case 'aborted':
        return 'Anulowano';
      default:
        return upload.status;
    }
  };

  const canPause = upload.status === 'uploading';
  const canResume = upload.status === 'paused';
  const canCancel = ['uploading', 'paused', 'initializing'].includes(upload.status);

  return (
    <Card className="p-2.5 sm:p-4 space-y-2.5 sm:space-y-4">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          {getStatusIcon()}
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-gray-900 truncate text-xs sm:text-sm">
              {upload.fileName}
            </h3>
            <p className="text-[10px] sm:text-sm text-gray-500">
              {formatFileSize(upload.fileSize)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          <Badge className={`${getStatusColor()} text-[10px] sm:text-xs px-1.5 sm:px-2`}>
            {getStatusText()}
          </Badge>
          
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(upload.id)}
              className="no-min-touch text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="space-y-2 sm:space-y-3">
        {/* Main Progress */}
        <div>
          <SmoothProgressBar 
            progress={upload.progress} 
            className="h-1.5 sm:h-2"
          />
        </div>

        {/* Progress Details */}
        <div className="text-[10px] sm:text-sm">
          <span className="text-gray-500">Wgranych:</span>
          <span className="ml-1 sm:ml-2 font-medium">
            {formatFileSize(upload.bytesUploaded)} / {formatFileSize(upload.fileSize)}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {upload.errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-2 sm:p-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 shrink-0" />
            <span className="text-[10px] sm:text-sm text-red-700">{upload.errorMessage}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {canPause && onPause && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPause(upload.id)}
              className="flex items-center space-x-1 sm:space-x-2 text-[10px] sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
            >
              <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Wstrzymaj</span>
            </Button>
          )}
          
          {canResume && onResume && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResume(upload.id)}
              className="flex items-center space-x-1 sm:space-x-2 text-[10px] sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
            >
              <Play className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Wznów</span>
            </Button>
          )}
          
          {canCancel && onCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCancel(upload.id)}
              className="flex items-center space-x-1 sm:space-x-2 text-[10px] sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 text-red-600 border-red-200 hover:bg-red-50"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Anuluj</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
