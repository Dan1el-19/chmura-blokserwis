'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { 
  Upload, 
  Download, 
  Trash2, 
  Share2, 
  Folder, 
  File, 
  LogOut, 
  Settings,
  User,
  HardDrive
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatBytes } from '@/lib/utils';
import { UserRole, FileItem } from '@/types';

export default function StoragePage() {
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<UserRole>('basic');
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(5 * 1024 * 1024 * 1024); // 5GB
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState('personal');
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const refreshIdToken = useCallback(async () => {
    try {
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true); // force refresh to get latest claims
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      await refreshIdToken();
      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        setUserRole(userData.role);
        setStorageUsed(userData.storageUsed);
        setStorageLimit(userData.storageLimit);
      } else if (response.status === 401) {
        // try once more after refresh
        await refreshIdToken();
        const retry = await fetch('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${await user?.getIdToken()}` }
        });
        if (retry.ok) {
          const userData = await retry.json();
          setUserRole(userData.role);
          setStorageUsed(userData.storageUsed);
          setStorageLimit(userData.storageLimit);
        }
      }
    } catch {
      console.error('Error fetching user data');
    }
  }, [user, refreshIdToken]);

  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/files?folder=${currentFolder}`, {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`
        }
      });
      if (response.ok) {
        const filesData = await response.json();
        setFiles(filesData);
      }
    } catch {
      console.error('Error fetching files');
    }
  }, [user, currentFolder]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchFiles();
    }
  }, [user, fetchUserData, fetchFiles]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Sprawdź limit przestrzeni
        if (storageUsed + file.size > storageLimit) {
          toast.error(`Plik ${file.name} przekracza dostępny limit przestrzeni`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', currentFolder);

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await user?.getIdToken()}`
          },
          body: formData
        });

        if (response.ok) {
          toast.success(`Plik ${file.name} został przesłany`);
          fetchFiles();
          fetchUserData();
        } else {
          toast.error(`Błąd podczas przesyłania ${file.name}`);
        }
      }
    } catch {
      toast.error('Błąd podczas przesyłania plików');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDownload = async (file: FileItem) => {
    try {
      const response = await fetch(`/api/files/download?key=${file.key}`, {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`
        }
      });
      
      if (response.ok) {
        const url = await response.text();
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Pobieranie rozpoczęte');
      }
    } catch {
      toast.error('Błąd podczas pobierania pliku');
    }
  };

  const handleFileDelete = async (file: FileItem) => {
    if (!confirm(`Czy na pewno chcesz usunąć plik ${file.name}?`)) return;

    try {
      const response = await fetch(`/api/files/delete?key=${file.key}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`
        }
      });

      if (response.ok) {
        toast.success('Plik został usunięty');
        fetchFiles();
        fetchUserData();
      } else {
        toast.error('Błąd podczas usuwania pliku');
      }
    } catch {
      toast.error('Błąd podczas usuwania pliku');
    }
  };

  const handleShare = async (file: FileItem) => {
    try {
      const response = await fetch('/api/files/share', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: file.key, expiresIn: 24 * 60 * 60 }) // 24 godziny
      });

      if (response.ok) {
        const { url } = await response.json();
        navigator.clipboard.writeText(url);
        toast.success('Link do udostępnienia skopiowany do schowka');
      }
    } catch {
      toast.error('Błąd podczas generowania linku');
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/');
      toast.success('Wylogowano pomyślnie');
    } catch {
      toast.error('Błąd podczas wylogowywania');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const storagePercentage = (storageUsed / storageLimit) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Chmura Blokserwis</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentFolder('personal')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentFolder === 'personal'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Mój folder
                </button>
                {userRole !== 'basic' && (
                  <button
                    onClick={() => setCurrentFolder('main')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      currentFolder === 'main'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Folder główny
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {formatBytes(storageUsed)} / {formatBytes(storageLimit)}
                </span>
              </div>
              
              <div className="w-28 sm:w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    storagePercentage > 90 ? 'bg-red-500' : 
                    storagePercentage > 70 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                ></div>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">{user.email}</span>
              </div>

              {userRole === 'admin' && (
                <button
                  onClick={() => router.push('/admin-panel')}
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  <Settings className="h-5 w-5" />
                </button>
              )}

              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {currentFolder === 'personal' ? 'Mój folder' : 'Folder główny'}
            </h2>
            <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 text-center">
              <Upload className="h-4 w-4 inline mr-2" />
              {uploading ? 'Przesyłanie...' : 'Wybierz pliki'}
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          
          {storagePercentage > 90 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-red-800 text-sm">
                Uwaga: Wykorzystujesz {storagePercentage.toFixed(1)}% dostępnej przestrzeni. 
                Rozważ usunięcie niepotrzebnych plików.
              </p>
            </div>
          )}
        </div>

        {/* Files List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Pliki</h3>
          </div>
          
          {files.length === 0 ? (
            <div className="p-6 sm:p-8 text-center">
              <Folder className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Brak plików w tym folderze</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {files.map((file) => (
                <div key={file.key} className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <File className="h-7 w-7 sm:h-8 sm:w-8 text-blue-500" />
                    <div>
                      <p className="text-sm sm:text-base font-medium text-gray-900 break-all">{file.name}</p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {formatBytes(file.size)} • {new Date(file.lastModified).toLocaleDateString('pl-PL')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button
                      onClick={() => handleFileDownload(file)}
                      className="text-gray-400 hover:text-gray-600 p-2"
                      title="Pobierz"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => handleShare(file)}
                      className="text-gray-400 hover:text-gray-600 p-2"
                      title="Udostępnij"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => handleFileDelete(file)}
                      className="text-gray-400 hover:text-red-600 p-2"
                      title="Usuń"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
