import React, { useEffect, useRef, useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { X, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { startUppyMultipartUpload, UppyMultipartHandle } from '@/lib/uppyMultipartEngine';

interface UppyDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  folder: 'personal' | 'main';
  subPath?: string;
  onUploadComplete?: () => void;
  onUploadError?: (error: string) => void;
}

export function UppyDashboardModal({
  isOpen,
  onClose,
  file,
  folder,
  subPath,
  onUploadComplete,
  onUploadError
}: UppyDashboardModalProps) {
  const [uploadHandle, setUploadHandle] = useState<UppyMultipartHandle | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  	const initializeUppy = useCallback(async () => {
		if (!file) return;

		setIsInitializing(true);
		setError(null);

		try {
			const handle = await startUppyMultipartUpload(file, folder, subPath, {
				onProgress: (progress, bytesUploaded, speed) => {
					console.log('Upload progress:', progress, bytesUploaded, speed);
				},
				onStatusChange: (status) => {
					console.log('Upload status changed:', status);
				},
				onError: (errorMessage) => {
					setError(errorMessage);
					onUploadError?.(errorMessage);
				},
				onComplete: () => {
					onUploadComplete?.();
					// Automatycznie zamknij modal po ukończeniu
					setTimeout(() => {
						onClose();
					}, 2000);
				}
			});

			setUploadHandle(handle);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Nie udało się zainicjalizować Uppy';
			setError(errorMessage);
			onUploadError?.(errorMessage);
		} finally {
			setIsInitializing(false);
		}
	}, [file, folder, subPath, onUploadComplete, onUploadError, onClose]);

	// Inicjalizacja Uppy po potwierdzeniu
	useEffect(() => {
		if (isOpen && file && !uploadHandle && !isInitializing) {
			initializeUppy();
		}
	}, [isOpen, file, uploadHandle, isInitializing, initializeUppy]);

	// Handle click outside modal
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen, onClose]);

	// Handle escape key
	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener('keydown', handleEscape);
		}

		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
		}, [isOpen, onClose]);

  const handleClose = () => {
    if (uploadHandle) {
      uploadHandle.destroy();
      setUploadHandle(null);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Upload className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Multipart Upload
              </h2>
              {file && (
                <p className="text-sm text-gray-500">
                  {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isInitializing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Inicjalizacja Uppy...</p>
            </div>
          )}

          {error && (
            <Card className="p-4 mb-4 border-red-200 bg-red-50">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <h3 className="font-medium text-red-800">Błąd inicjalizacji</h3>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={initializeUppy}
                className="mt-3"
              >
                Spróbuj ponownie
              </Button>
            </Card>
          )}

          {uploadHandle && !error && (
            <div className="space-y-4">
              {/* Upload Status */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      uploadHandle.status === 'uploading' ? 'bg-blue-500 animate-pulse' :
                      uploadHandle.status === 'completed' ? 'bg-green-500' :
                      uploadHandle.status === 'error' ? 'bg-red-500' :
                      uploadHandle.status === 'paused' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`} />
                    <span className="font-medium">
                      Status: {uploadHandle.status}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    Postęp: {uploadHandle.progress.toFixed(1)}%
                  </div>
                </div>
                
                {/* Resume capability info */}
                {uploadHandle.status === 'paused' && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Upload może być wznowiony - stan jest zapisany w przeglądarce</span>
                    </div>
                  </div>
                )}
              </Card>

              {/* Uppy Dashboard Container */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-center text-gray-500 mb-4">
                  <p>Uppy Dashboard będzie wyświetlony tutaj</p>
                  <p className="text-sm">Dashboard jest inicjalizowany automatycznie</p>
                </div>
                
                {/* Placeholder dla Uppy Dashboard */}
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="font-medium text-gray-700 mb-2">
                    Uppy Dashboard
                  </h3>
                  <p className="text-sm text-gray-500">
                    Interfejs Uppy jest inicjalizowany w tle
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center space-x-3">
                {uploadHandle.status === 'uploading' && (
                  <Button
                    variant="outline"
                    onClick={() => uploadHandle.pause()}
                    className="flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Wstrzymaj</span>
                  </Button>
                )}
                
                {uploadHandle.status === 'paused' && (
                  <Button
                    variant="outline"
                    onClick={() => uploadHandle.resume()}
                    className="flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Wznów</span>
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  onClick={() => uploadHandle.cancel()}
                  className="flex items-center space-x-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                  <span>Anuluj</span>
                </Button>
              </div>
            </div>
          )}

          {!uploadHandle && !isInitializing && !error && (
            <div className="text-center py-8">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Gotowy do inicjalizacji
              </h3>
              <p className="text-gray-500 mb-4">
                Kliknij poniżej, aby rozpocząć multipart upload
              </p>
              <Button
                onClick={initializeUppy}
                className="flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Rozpocznij Upload</span>
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              <span className="font-medium">Folder:</span> {folder}
              {subPath && <span className="ml-2">/ {subPath}</span>}
            </div>
            <div>
              <span className="font-medium">Engine:</span> Multipart Upload
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
