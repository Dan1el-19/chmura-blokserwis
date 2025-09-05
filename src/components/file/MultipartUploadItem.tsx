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
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-medium text-gray-900 truncate max-w-xs">
              {upload.fileName}
            </h3>
            <p className="text-sm text-gray-500">
              {formatFileSize(upload.fileSize)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor()}>
            {getStatusText()}
          </Badge>
          
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(upload.id)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="space-y-3">
        {/* Main Progress */}
        <div>
          <SmoothProgressBar 
            progress={upload.progress} 
            className="h-2"
          />
        </div>

        {/* Progress Details */}
        <div className="grid grid-cols-1 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Wgranych:</span>
            <span className="ml-2 font-medium">
              {formatFileSize(upload.bytesUploaded)} / {formatFileSize(upload.fileSize)}
            </span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {upload.errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">{upload.errorMessage}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {canPause && onPause && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPause(upload.id)}
              className="flex items-center space-x-2"
            >
              <Pause className="w-4 h-4" />
              <span>Wstrzymaj</span>
            </Button>
          )}
          
          {canResume && onResume && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResume(upload.id)}
              className="flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Wznów</span>
            </Button>
          )}
          
          {canCancel && onCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCancel(upload.id)}
              className="flex items-center space-x-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <X className="w-4 h-4" />
              <span>Anuluj</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
