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

export default function StoragePage() {
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<UserRole>('basic');
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(5 * 1024 * 1024 * 1024); // 5GB
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState('personal');
  const [uploading, setUploading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
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
      } catch (error) {
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
      const response = await fetch(`/api/files/download?key=${encodeURIComponent(file.key)}`, {
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
      } else {
        toast.error('Błąd podczas pobierania pliku');
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
    try {
      const response = await fetch('/api/files/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({ key: file.key })
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
            currentFolder={currentFolder}
            onDownload={handleFileDownload}
            onShare={handleShare}
            onDelete={handleFileDelete}
          />
        </div>
      </main>
    </div>
  );
}
