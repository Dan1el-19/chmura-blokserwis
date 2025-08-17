'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { UserRole, FileItem } from '@/types';
import StorageHeader from '@/components/layout/StorageHeader';
import UploadSection from '@/components/file/UploadSection';
import FileGrid from '@/components/file/FileGrid';
import DragDropUpload from '@/components/file/DragDropUpload';
import { UploadProvider, useUpload } from '@/context/UploadContext';
import UploadProgressBadge from '@/components/file/UploadProgressBadge';
import ShareModal from '@/components/ui/ShareModal';
import ShareOptionsModal from '@/components/ui/ShareOptionsModal';
import ManageLinksModal from '@/components/ui/ManageLinksModal';
import StatsModal from '@/components/ui/StatsModal';
import CostCalculatorModal from '@/components/ui/CostCalculatorModal';
import StorageUsageBars from '@/components/ui/StorageUsageBars';

function StoragePageInner() {
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<UserRole>('basic');
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(5 * 1024 * 1024 * 1024); // 5GB
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState('personal');
  const [uploading, setUploading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showShareOptionsModal, setShowShareOptionsModal] = useState(false);
  const [showManageLinksModal, setShowManageLinksModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showCostCalculatorModal, setShowCostCalculatorModal] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; fileName: string; expiresAt?: string } | null>(null);
  const [selectedFileForShare, setSelectedFileForShare] = useState<FileItem | null>(null);
  const [selectedFileForManage, setSelectedFileForManage] = useState<FileItem | null>(null);
  const [selectedFileForStats, setSelectedFileForStats] = useState<FileItem | null>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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

  // Ochrona przed odświeżeniem/wyjściem podczas uploadu
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploading) {
        e.preventDefault();
        // Chrome wymaga ustawienia returnValue
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploading]);

  const { enqueue, uploads } = useUpload();

  // Odśwież listę plików gdy upload się zakończy
  useEffect(() => {
    const completedUploads = uploads.filter(upload => upload.status === 'completed');
    if (completedUploads.length > 0) {
      // Odśwież listę plików po krótkim opóźnieniu (żeby backend zdążył przetworzyć)
      const timer = setTimeout(() => {
        fetchFiles();
        fetchUserData(); // Odśwież też dane użytkownika (storage used)
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [uploads, fetchFiles, fetchUserData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Obsługujemy wiele plików
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Sprawdź rozmiar pliku (1MB = 1024 * 1024 bajtów)
      const MIN_SIZE_FOR_CALCULATOR = 1 * 1024 * 1024; // 1MB
      
      if (file.size >= MIN_SIZE_FOR_CALCULATOR) {
        // Pokaż kalkulator kosztów dla pierwszego dużego pliku
        if (i === 0) {
          setSelectedFileForUpload(file);
          setShowCostCalculatorModal(true);
          break; // Zatrzymaj się na pierwszym dużym pliku
        }
      } else {
        // Bezpośredni upload dla małych plików
        await enqueue(file, currentFolder as 'personal' | 'main');
      }
    }
    
    event.target.value = '';
  };

  const handleFilesSelected = async (files: File[]) => {
    // Obsługujemy wiele plików z drag&drop
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Sprawdź rozmiar pliku (1MB = 1024 * 1024 bajtów)
      const MIN_SIZE_FOR_CALCULATOR = 1 * 1024 * 1024; // 1MB
      
      if (file.size >= MIN_SIZE_FOR_CALCULATOR) {
        // Pokaż kalkulator kosztów dla pierwszego dużego pliku
        if (i === 0) {
          setSelectedFileForUpload(file);
          setShowCostCalculatorModal(true);
          break; // Zatrzymaj się na pierwszym dużym pliku
        }
      } else {
        // Bezpośredni upload dla małych plików
        await enqueue(file, currentFolder as 'personal' | 'main');
      }
    }
  };

  const performFileUpload = async (file: File) => {
    setUploading(true);
    try {
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
      } else {
        const error = await response.json();
        toast.error(`Błąd podczas przesyłania ${file.name}: ${error.error}`);
      }
    } catch {
      toast.error(`Błąd podczas przesyłania ${file.name}`);
    } finally {
      setUploading(false);
      // Refresh data
      fetchUserData();
      fetchFiles();
    }
  };

  const handleCostCalculatorConfirm = async () => {
    if (selectedFileForUpload) {
      await enqueue(selectedFileForUpload, currentFolder as 'personal' | 'main');
      setShowCostCalculatorModal(false);
      setSelectedFileForUpload(null);
    }
  };

  const handleCostCalculatorClose = () => {
    setShowCostCalculatorModal(false);
    setSelectedFileForUpload(null);
  };

  const handleFileDownload = async (file: FileItem) => {
    try {
      // Użyj nowego endpointu który zwraca plik bezpośrednio
      const response = await fetch(`/api/files/download?key=${encodeURIComponent(file.key)}`, {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`
        }
      });

      if (response.ok) {
        // Pobierz plik jako blob
        const blob = await response.blob();
        
        // Sprawdź czy jesteśmy w przeglądarce
        if (typeof window !== 'undefined') {
          // Utwórz URL dla blob
          const url = window.URL.createObjectURL(blob);
          
          // Utwórz link i wymuś pobieranie
          const link = document.createElement('a');
          link.href = url;
          link.download = file.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Wyczyść URL
          window.URL.revokeObjectURL(url);
        }
        
        toast.success('Pobieranie rozpoczęte');
      } else {
        const errorData = await response.json();
        console.error('Download API error:', errorData);
        toast.error(`Błąd podczas pobierania pliku: ${errorData.error || 'Nieznany błąd'}`);
      }
    } catch {
      toast.error('Błąd podczas pobierania pliku');
    }
  };

  const handleFileDelete = async (file: FileItem) => {
    if (!confirm(`Czy na pewno chcesz usunąć plik "${file.name}"?`)) {
      return;
    }

          try {
        const response = await fetch(`/api/files/delete?key=${encodeURIComponent(file.key)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${await user?.getIdToken()}`
          }
        });

      if (response.ok) {
        toast.success('Plik został usunięty');
        fetchUserData();
        fetchFiles();
      } else {
        const errorData = await response.json();
        toast.error(`Błąd podczas usuwania pliku: ${errorData.error || 'Nieznany błąd'}`);
      }
    } catch {
      toast.error('Błąd podczas usuwania pliku');
    }
  };

  const handleShare = async (file: FileItem) => {
    setSelectedFileForShare(file);
    setShowShareOptionsModal(true);
  };

  const handleShareConfirm = async (options: { minutes?: number; hours?: number; days?: number; months?: number; until?: string; }) => {
    if (!selectedFileForShare) return;
    try {
      const response = await fetch('/api/files/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({ key: selectedFileForShare.key, options })
      });

      if (response.ok) {
        const { url, expiresAt } = await response.json();
        setShareData({ url, fileName: selectedFileForShare.name, expiresAt });
        setShowShareModal(true);
      } else {
        toast.error('Błąd podczas tworzenia linku');
      }
    } catch {
      toast.error('Błąd podczas tworzenia linku');
    } finally {
      setShowShareOptionsModal(false);
      setSelectedFileForShare(null);
    }
  };

  // Adapter: dopasowanie do sygnatury ShareOptionsModal
  const handleShareConfirmLegacy = async (
    expiresIn?: number,
    expiresAt?: Date
  ) => {
    const options: { minutes?: number; hours?: number; days?: number; months?: number; until?: string } = {};

    if (expiresAt instanceof Date) {
      options.until = expiresAt.toISOString();
    } else if (typeof expiresIn === 'number' && expiresIn > 0) {
      // Konwertuj sekundy na minuty w górę
      options.minutes = Math.ceil(expiresIn / 60);
    }

    await handleShareConfirm(options);
  };

  const handleManageLinks = async (file: FileItem) => {
    setSelectedFileForManage(file);
    setShowManageLinksModal(true);
  };

  const handleStats = async (file: FileItem) => {
    setSelectedFileForStats(file);
    setShowStatsModal(true);
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

  const handleAdminPanel = () => {
    router.push('/admin-panel');
  };

  const handleFolderChange = (folder: string) => {
    setCurrentFolder(folder);
    setShowMobileMenu(false); // Close mobile menu when changing folders
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
      <StorageHeader
        title="Chmura Blokserwis"
        userEmail={user.email || ''}
        userRole={userRole}
        currentFolder={currentFolder}
        onFolderChange={handleFolderChange}
        onLogout={handleLogout}
        onAdminPanel={handleAdminPanel}
        showMobileMenu={showMobileMenu}
        onToggleMobileMenu={() => setShowMobileMenu(!showMobileMenu)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          {/* Storage Usage Bars */}
                    <StorageUsageBars
            onRefresh={() => {
              fetchUserData();
              fetchFiles();
            }}
          />
          
          <DragDropUpload onFilesSelected={handleFilesSelected}>
            <UploadSection
              currentFolder={currentFolder}
              uploading={uploading}
              storagePercentage={storagePercentage}
              onFileUpload={handleFileUpload}
            />

            {/* Files Section Header */}
            <div className="rounded-lg transition-all duration-200 bg-white border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Pliki</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={`inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-sm p-2 ${
                        viewMode === 'grid' 
                          ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm' 
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-grid3x3 h-4 w-4">
                        <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                        <path d="M3 9h18"></path>
                        <path d="M3 15h18"></path>
                        <path d="M9 3v18"></path>
                        <path d="M15 3v18"></path>
                      </svg>
                    </button>
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-sm p-2 ${
                        viewMode === 'list' 
                          ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm' 
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list h-4 w-4">
                        <line x1="8" x2="21" y1="6" y2="6"></line>
                        <line x1="8" x2="21" y1="12" y2="12"></line>
                        <line x1="8" x2="21" y1="18" y2="18"></line>
                        <line x1="3" x2="3.01" y1="6" y2="6"></line>
                        <line x1="3" x2="3.01" y1="12" y2="12"></line>
                        <line x1="3" x2="3.01" y1="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 p-0">
                <FileGrid
                  files={files}
                  currentFolder={currentFolder}
                  viewMode={viewMode}
                  onDownload={handleFileDownload}
                  onDelete={handleFileDelete}
                  onShare={handleShare}
                  onStats={handleStats}
                  onManageLinks={handleManageLinks}
                />
              </div>
            </div>

            {uploads.length > 0 && (
              <div className="space-y-2">
                {uploads.map(task => (
                  <UploadProgressBadge key={task.id} task={task} />
                ))}
              </div>
            )}
          </DragDropUpload>
        </div>
      </main>

      {/* Share Modal */}
      {shareData && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setShareData(null);
          }}
          shareUrl={shareData.url}
          fileName={shareData.fileName}
          expiresAt={shareData.expiresAt}
        />
      )}

      {/* Share Options Modal */}
      {selectedFileForShare && (
        <ShareOptionsModal
          isOpen={showShareOptionsModal}
          onClose={() => {
            setShowShareOptionsModal(false);
            setSelectedFileForShare(null);
          }}
                          onConfirm={(expiresIn?: number, expiresAt?: Date) => handleShareConfirmLegacy(expiresIn, expiresAt)}
          fileName={selectedFileForShare.name}
        />
      )}

      {/* Manage Links Modal */}
      {selectedFileForManage && (
        <ManageLinksModal
          isOpen={showManageLinksModal}
          onClose={() => {
            setShowManageLinksModal(false);
            setSelectedFileForManage(null);
          }}
          fileKey={selectedFileForManage.key}
          fileName={selectedFileForManage.name}
        />
      )}

      {/* Stats Modal */}
      {selectedFileForStats && (
        <StatsModal
          isOpen={showStatsModal}
          onClose={() => {
            setShowStatsModal(false);
            setSelectedFileForStats(null);
          }}
          fileKey={selectedFileForStats.key}
          fileName={selectedFileForStats.name}
        />
      )}

      {/* Cost Calculator Modal */}
      <CostCalculatorModal
        isOpen={showCostCalculatorModal}
        onClose={handleCostCalculatorClose}
        onConfirm={handleCostCalculatorConfirm}
        file={selectedFileForUpload}
      />
    </div>
  );
}

export default function StoragePage() {
  return (
    <UploadProvider onUploadComplete={() => {
      // Odśwież listę plików po zakończeniu uploadu
      // To będzie wywołane w StoragePageInner przez useEffect
    }}>
      <StoragePageInner />
    </UploadProvider>
  );
}
