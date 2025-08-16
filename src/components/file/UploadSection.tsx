import React from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface UploadSectionProps {
  currentFolder: string;
  uploading: boolean;
  storagePercentage: number;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function UploadSection({
  currentFolder,
  uploading,
  storagePercentage,
  onFileUpload
}: UploadSectionProps) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {currentFolder === 'personal' ? 'Mój folder' : 'Folder główny'}
          </h2>
          
          <label className="cursor-pointer">
            <Button
              variant="primary"
              size="md"
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Przesyłanie...' : 'Wybierz pliki'}
            </Button>
            <input
              type="file"
              multiple
              onChange={onFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
        
        {storagePercentage > 90 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-800 text-sm font-medium">
                  Uwaga: Wykorzystujesz {storagePercentage.toFixed(1)}% dostępnej przestrzeni
                </p>
                <p className="text-red-700 text-sm mt-1">
                  Rozważ usunięcie niepotrzebnych plików przed dodaniem nowych.
                </p>
              </div>
            </div>
          </div>
        )}

        {storagePercentage > 70 && storagePercentage <= 90 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-yellow-800 text-sm font-medium">
                  Wykorzystujesz {storagePercentage.toFixed(1)}% dostępnej przestrzeni
                </p>
                <p className="text-yellow-700 text-sm mt-1">
                  Rozważ uporządkowanie plików w najbliższym czasie.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
