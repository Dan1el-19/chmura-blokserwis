import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { FileItem, FolderItem } from '@/types';

interface ShareData {
  url: string;
  fileName: string;
  expiresAt?: string;
}

interface ShareOptions {
  minutes?: number;
  hours?: number;
  days?: number;
  months?: number;
  until?: string;
  name?: string;
  customSlug?: string;
}

interface FileOperationsState {
  // Share state
  shareData: ShareData | null;
  selectedFileForShare: FileItem | null;
  selectedFileForManage: FileItem | null;
  selectedFileForStats: FileItem | null;
  showShareModal: boolean;
  showShareOptionsModal: boolean;
  showManageLinksModal: boolean;
  showStatsModal: boolean;

  // Preview state
  previewFile: FileItem | null;
  showPreviewModal: boolean;

  // Rename state
  renameTarget: FileItem | null;
  showRenameModal: boolean;
  renameFolderTarget: FolderItem | null;
  showRenameFolderModal: boolean;

  // New folder state
  showNewFolderModal: boolean;

  // Move/Overwrite state
  moveTargetFolder: FolderItem | null;
  pendingMoveKeys: string[];
  showOverwriteConfirm: boolean;

  // Storage refresh
  storageRefreshTick: number;

  // Actions
  handleFileDownload: (file: FileItem) => Promise<void>;
  handleFilePreview: (file: FileItem) => void;
  handleFileDelete: (file: FileItem) => Promise<void>;
  handleShare: (file: FileItem) => void;
  handleShareConfirm: (options: ShareOptions) => Promise<void>;
  handleShareConfirmLegacy: (
    expiresIn?: number,
    expiresAt?: Date,
    name?: string,
    customSlug?: string
  ) => Promise<void>;
  handleManageLinks: (file: FileItem) => void;
  handleStats: (file: FileItem) => void;
  handleNewFolder: () => void;
  handleRenameRequest: (file: FileItem) => void;
  handleRenameFolderRequest: (folder: FolderItem) => void;

  // Close handlers
  closeShareModal: () => void;
  closeShareOptionsModal: () => void;
  closeManageLinksModal: () => void;
  closeStatsModal: () => void;
  closePreviewModal: () => void;
  closeRenameModal: () => void;
  closeRenameFolderModal: () => void;
  closeNewFolderModal: () => void;

  // Overwrite handlers
  confirmOverwrite: () => Promise<void>;
  cancelOverwrite: () => void;
  setMoveTargetFolder: (folder: FolderItem | null) => void;
  setPendingMoveKeys: (keys: string[]) => void;
  setShowOverwriteConfirm: (show: boolean) => void;

  // Utility
  bumpStorageUsage: () => void;
}

interface UseFileOperationsOptions {
  getAuthToken: () => Promise<string | undefined>;
  fetchFiles: () => Promise<void>;
  fetchUserData: () => Promise<void>;
  clearSelection: () => void;
}

export function useFileOperations({
  getAuthToken,
  fetchFiles,
  fetchUserData,
  clearSelection,
}: UseFileOperationsOptions): FileOperationsState {
  // Share state
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [selectedFileForShare, setSelectedFileForShare] = useState<FileItem | null>(null);
  const [selectedFileForManage, setSelectedFileForManage] = useState<FileItem | null>(null);
  const [selectedFileForStats, setSelectedFileForStats] = useState<FileItem | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showShareOptionsModal, setShowShareOptionsModal] = useState(false);
  const [showManageLinksModal, setShowManageLinksModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Preview state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Rename state
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] = useState<FolderItem | null>(null);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);

  // New folder state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);

  // Move/Overwrite state
  const [moveTargetFolder, setMoveTargetFolder] = useState<FolderItem | null>(null);
  const [pendingMoveKeys, setPendingMoveKeys] = useState<string[]>([]);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  // Storage usage refresh tick
  const [storageRefreshTick, setStorageRefreshTick] = useState(0);
  const bumpStorageUsage = useCallback(() => setStorageRefreshTick((t) => t + 1), []);

  // Download
  const handleFileDownload = useCallback(
    async (file: FileItem) => {
      try {
        const response = await fetch(
          `/api/files/presigned?key=${encodeURIComponent(file.key)}&op=get`,
          {
            headers: {
              Authorization: `Bearer ${await getAuthToken()}`,
            },
          }
        );

        if (!response.ok) {
          toast.error('Błąd generowania linku do pobierania');
          return;
        }

        const { presignedUrl } = await response.json();
        window.location.href = presignedUrl;
        toast.success('Pobieranie rozpoczęte');
      } catch {
        toast.error('Błąd pobierania');
      }
    },
    [getAuthToken]
  );

  // Preview
  const handleFilePreview = useCallback((file: FileItem) => {
    setPreviewFile(file);
    setShowPreviewModal(true);
  }, []);

  // Delete
  const handleFileDelete = useCallback(
    async (file: FileItem) => {
      if (!confirm(`Czy na pewno chcesz usunąć plik "${file.name}"?`)) return;
      try {
        const response = await fetch(
          `/api/files/delete?key=${encodeURIComponent(file.key)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${await getAuthToken()}` } }
        );
        if (response.ok) {
          toast.success('Plik został usunięty');
          fetchUserData();
          fetchFiles();
          bumpStorageUsage();
        } else {
          const errorData = await response.json();
          toast.error(
            `Błąd podczas usuwania pliku: ${errorData.error || 'Nieznany błąd'}`
          );
        }
      } catch {
        toast.error('Błąd podczas usuwania pliku');
      }
    },
    [getAuthToken, fetchFiles, fetchUserData, bumpStorageUsage]
  );

  // Share
  const handleShare = useCallback((file: FileItem) => {
    setSelectedFileForShare(file);
    setShowShareOptionsModal(true);
  }, []);

  const handleShareConfirm = useCallback(
    async (options: ShareOptions) => {
      if (!selectedFileForShare) return;
      try {
        const response = await fetch('/api/files/share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getAuthToken()}`,
          },
          body: JSON.stringify({
            key: selectedFileForShare.key,
            expiresIn: options.minutes ? options.minutes * 60 : undefined,
            expiresAt: options.until,
            name: options.name,
            customSlug: options.customSlug,
          }),
        });
        if (response.ok) {
          const { url, expiresAt } = await response.json();
          setShareData({ url, fileName: selectedFileForShare.name, expiresAt });
          setShowShareModal(true);
        } else {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 409) {
            toast.error(errorData.error || 'Ten niestandardowy link jest już zajęty');
          } else {
            toast.error('Błąd podczas tworzenia linku');
          }
        }
      } catch {
        toast.error('Błąd podczas tworzenia linku');
      } finally {
        setShowShareOptionsModal(false);
        setSelectedFileForShare(null);
      }
    },
    [selectedFileForShare, getAuthToken]
  );

  const handleShareConfirmLegacy = useCallback(
    async (expiresIn?: number, expiresAt?: Date, name?: string, customSlug?: string) => {
      const options: ShareOptions = {};
      if (expiresAt instanceof Date) {
        options.until = expiresAt.toISOString();
      } else if (typeof expiresIn === 'number' && expiresIn > 0) {
        options.minutes = Math.ceil(expiresIn / 60);
      }
      if (name) options.name = name;
      if (customSlug) options.customSlug = customSlug;
      await handleShareConfirm(options);
    },
    [handleShareConfirm]
  );

  // Manage links
  const handleManageLinks = useCallback((file: FileItem) => {
    setSelectedFileForManage(file);
    setShowManageLinksModal(true);
  }, []);

  // Stats
  const handleStats = useCallback((file: FileItem) => {
    setSelectedFileForStats(file);
    setShowStatsModal(true);
  }, []);

  // New folder
  const handleNewFolder = useCallback(() => {
    setShowNewFolderModal(true);
  }, []);

  // Rename requests
  const handleRenameRequest = useCallback((file: FileItem) => {
    setRenameTarget(file);
    setShowRenameModal(true);
  }, []);

  const handleRenameFolderRequest = useCallback((folder: FolderItem) => {
    setRenameFolderTarget(folder);
    setShowRenameFolderModal(true);
  }, []);

  // Close handlers
  const closeShareModal = useCallback(() => {
    setShowShareModal(false);
    setShareData(null);
  }, []);

  const closeShareOptionsModal = useCallback(() => {
    setShowShareOptionsModal(false);
    setSelectedFileForShare(null);
  }, []);

  const closeManageLinksModal = useCallback(() => {
    setShowManageLinksModal(false);
    setSelectedFileForManage(null);
  }, []);

  const closeStatsModal = useCallback(() => {
    setShowStatsModal(false);
    setSelectedFileForStats(null);
  }, []);

  const closePreviewModal = useCallback(() => {
    setShowPreviewModal(false);
    setPreviewFile(null);
  }, []);

  const closeRenameModal = useCallback(() => {
    setShowRenameModal(false);
    setRenameTarget(null);
  }, []);

  const closeRenameFolderModal = useCallback(() => {
    setShowRenameFolderModal(false);
    setRenameFolderTarget(null);
  }, []);

  const closeNewFolderModal = useCallback(() => {
    setShowNewFolderModal(false);
  }, []);

  // Overwrite handlers
  const confirmOverwrite = useCallback(async () => {
    if (!moveTargetFolder || pendingMoveKeys.length === 0) {
      setShowOverwriteConfirm(false);
      return;
    }
    try {
      const res = await fetch('/api/files/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          keys: pendingMoveKeys,
          targetFolderPath: moveTargetFolder.path,
          overwrite: true,
        }),
      });
      if (res.ok) {
        toast.success('Nadpisano i przeniesiono');
        clearSelection();
        fetchFiles();
        bumpStorageUsage();
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Błąd przenoszenia' }));
        toast.error(error || 'Błąd przenoszenia');
      }
    } catch {
      toast.error('Błąd przenoszenia');
    } finally {
      setShowOverwriteConfirm(false);
      setPendingMoveKeys([]);
      setMoveTargetFolder(null);
    }
  }, [moveTargetFolder, pendingMoveKeys, getAuthToken, clearSelection, fetchFiles, bumpStorageUsage]);

  const cancelOverwrite = useCallback(() => {
    setShowOverwriteConfirm(false);
    setPendingMoveKeys([]);
    setMoveTargetFolder(null);
  }, []);

  return {
    // Share state
    shareData,
    selectedFileForShare,
    selectedFileForManage,
    selectedFileForStats,
    showShareModal,
    showShareOptionsModal,
    showManageLinksModal,
    showStatsModal,

    // Preview state
    previewFile,
    showPreviewModal,

    // Rename state
    renameTarget,
    showRenameModal,
    renameFolderTarget,
    showRenameFolderModal,

    // New folder state
    showNewFolderModal,

    // Move/Overwrite state
    moveTargetFolder,
    pendingMoveKeys,
    showOverwriteConfirm,

    // Storage refresh
    storageRefreshTick,

    // Actions
    handleFileDownload,
    handleFilePreview,
    handleFileDelete,
    handleShare,
    handleShareConfirm,
    handleShareConfirmLegacy,
    handleManageLinks,
    handleStats,
    handleNewFolder,
    handleRenameRequest,
    handleRenameFolderRequest,

    // Close handlers
    closeShareModal,
    closeShareOptionsModal,
    closeManageLinksModal,
    closeStatsModal,
    closePreviewModal,
    closeRenameModal,
    closeRenameFolderModal,
    closeNewFolderModal,

    // Overwrite handlers
    confirmOverwrite,
    cancelOverwrite,
    setMoveTargetFolder,
    setPendingMoveKeys,
    setShowOverwriteConfirm,

    // Utility
    bumpStorageUsage,
  };
}
