'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { UserRole, FileItem } from '@/types';
import Header from '@/components/layout/Header';
import UploadSection from '@/components/file/UploadSection';
import FileGrid from '@/components/file/FileGrid';
import ShareModal from '@/components/ui/ShareModal';
import ShareOptionsModal from '@/components/ui/ShareOptionsModal';
import ManageLinksModal from '@/components/ui/ManageLinksModal';
import StatsModal from '@/components/ui/StatsModal';

export default function StoragePage() {
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
  const [shareData, setShareData] = useState<{ url: string; fileName: string; expiresAt?: string } | null>(null);
  const [selectedFileForShare, setSelectedFileForShare] = useState<FileItem | null>(null);
  const [selectedFileForManage, setSelectedFileForManage] = useState<FileItem | null>(null);
  const [selectedFileForStats, setSelectedFileForStats] = useState<FileItem | null>(null);
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
    const uploadPromises = Array.from(files).map(async (file) => {
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
          return true;
        } else {
          const error = await response.json();
          toast.error(`Błąd podczas przesyłania ${file.name}: ${error.error}`);
          return false;
        }
      } catch {
        toast.error(`Błąd podczas przesyłania ${file.name}`);
        return false;
      }
    });

    await Promise.all(uploadPromises);
    setUploading(false);
    event.target.value = '';
    
    // Refresh data
    fetchUserData();
    fetchFiles();
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
      const response = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({ key: file.key })
      });

      if (response.ok) {
        toast.success('Plik został usunięty');
        fetchUserData();
        fetchFiles();
      } else {
        toast.error('Błąd podczas usuwania pliku');
      }
    } catch {
      toast.error('Błąd podczas usuwania pliku');
    }
  };

  const handleShare = async (file: FileItem) => {
    setSelectedFileForShare(file);
    setShowShareOptionsModal(true);
  };

  const handleShareConfirm = async (expiresIn?: number, expiresAt?: Date, name?: string) => {
    if (!selectedFileForShare) return;

    try {
      console.log('Sharing file:', selectedFileForShare.key);
      
      const requestBody: Record<string, unknown> = { key: selectedFileForShare.key };
      if (expiresIn) {
        requestBody.expiresIn = expiresIn;
      }
      if (expiresAt) {
        requestBody.expiresAt = expiresAt.toISOString();
      }
      if (name) {
        requestBody.name = name;
      }
      
      const response = await fetch('/api/files/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Share response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Share response data:', data);
        
        const { url, expiresAt: responseExpiresAt } = data;
        setShareData({
          url,
          fileName: selectedFileForShare.name,
          expiresAt: responseExpiresAt
        });
        setShowShareModal(true);
      } else {
        const errorData = await response.json();
        console.error('Share API error:', errorData);
        toast.error(`Błąd podczas generowania linku: ${errorData.error || 'Nieznany błąd'}`);
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Błąd podczas generowania linku');
    }
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
      <Header
        title="Chmura Blokserwis"
        userEmail={user.email || ''}
        userRole={userRole}
        storageUsed={storageUsed}
        storageLimit={storageLimit}
        currentFolder={currentFolder}
        onFolderChange={handleFolderChange}
        onLogout={handleLogout}
        onAdminPanel={handleAdminPanel}
        showMobileMenu={showMobileMenu}
        onToggleMobileMenu={() => setShowMobileMenu(!showMobileMenu)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          <UploadSection
            currentFolder={currentFolder}
            uploading={uploading}
            storagePercentage={storagePercentage}
            onFileUpload={handleFileUpload}
          />

          <FileGrid
            files={files}
            onDownload={handleFileDownload}
            onShare={handleShare}
            onManageLinks={handleManageLinks}
            onStats={handleStats}
            onDelete={handleFileDelete}
          />
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
          onConfirm={handleShareConfirm}
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
    </div>
  );
}
