"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FolderItem } from '@/types';

// Layout & UI Components
import StorageHeader from '@/components/layout/StorageHeader';
import FileGrid from '@/components/file/FileGrid';
import DragDropUpload from '@/components/file/DragDropUpload';
import UnifiedUploadPanel from '@/components/file/UnifiedUploadPanel';
import StorageUsageBars from '@/components/ui/StorageUsageBars';
import FolderLoader from '@/components/ui/FolderLoader';
import MobileActionsFab from '@/components/ui/MobileActionsFab';

// Storage components
import {
  StorageToolbar,
  SelectionBar,
  StorageModals,
  StorageLoadingScreen,
} from '@/components/storage';

// Hooks
import {
  useStorageAuth,
  useStorageNavigation,
  useStorageData,
  useRetroMetadata,
  useFileOperations,
  useFileUpload,
  useFileSelection,
  useViewPreferences,
} from '@/hooks/storage';

// Context
import { UploadProvider } from '@/context/UploadContext';

export const dynamic = 'force-dynamic';

function StoragePageInner() {
  const router = useRouter();

  // =============================
  // Auth Hook
  // =============================
  const {
    user,
    loading,
    userRole,
    getAuthToken,
    logout,
  } = useStorageAuth();

  // Fetch user data callback for operations
  const fetchUserData = useCallback(async () => {
    // This is now handled inside useStorageAuth
  }, []);

  // =============================
  // View Preferences Hook
  // =============================
  const {
    viewMode,
    sortField,
    sortDir,
    setViewMode,
    setSorting,
  } = useViewPreferences();

  // =============================
  // Navigation Hook
  // =============================
  const {
    currentFolder,
    path,
    slugSegments,
    setPath,
    setSlugSegments,
    pushSlugPath,
    handleFolderChange,
    enterFolder,
  } = useStorageNavigation(user);

  // =============================
  // Storage Data Hook
  // =============================
  const {
    files,
    folders,
    filesLoading,
    hasFetchedForPath,
    rootBase,
    sortedFiles,
    fetchFiles,
    fetchFilesForPath,
    setFolders,
    clearData,
  } = useStorageData({
    currentFolder,
    path,
    sortField,
    sortDir,
    getAuthToken,
  });

  // Retro metadata backfill
  useRetroMetadata(user, folders, currentFolder, path, getAuthToken, fetchFiles);

  // Re-fetch when path changes
  const pathKey = path.join('/');
  useEffect(() => {
    if (!user) return;
    clearData();
    fetchFiles();
  }, [user, currentFolder, pathKey, fetchFiles, clearData]);

  // =============================
  // File Selection Hook
  // =============================
  const {
    multiSelectMode,
    selectedKeys,
    toggleMultiSelectMode,
    toggleSelect,
    clearSelection,
  } = useFileSelection();

  // =============================
  // File Operations Hook
  // =============================
  const fileOperations = useFileOperations({
    getAuthToken,
    fetchFiles,
    fetchUserData,
    clearSelection,
  });

  // =============================
  // File Upload Hook
  // =============================
  const fileUpload = useFileUpload({
    currentFolder,
    path,
    fetchFiles,
    fetchUserData,
  });

  // =============================
  // Event Listeners (rename, delete folder)
  // =============================
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { file: { key: string; name: string } };
      fileOperations.handleRenameRequest(detail.file as any);
    };
    const folderRenameHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { folder: FolderItem };
      fileOperations.handleRenameFolderRequest(detail.folder);
    };
    const folderDeleteHandler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { folder: FolderItem };
      const folder = detail.folder;
      if (!confirm(`Usunąć folder "${folder.name}" wraz z zawartością?`)) return;
      try {
        const res = await fetch(
          `/api/files/delete-folder?path=${encodeURIComponent(folder.path)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${await getAuthToken()}` },
          }
        );
        if (res.ok) {
          toast.success('Folder usunięty');
          fetchFiles();
          fileOperations.bumpStorageUsage();
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || 'Błąd usuwania folderu');
        }
      } catch {
        toast.error('Błąd sieci usuwania');
      }
    };

    window.addEventListener('cb:rename-request', handler as EventListener);
    window.addEventListener('cb:rename-folder-request', folderRenameHandler as EventListener);
    window.addEventListener('cb:delete-folder-request', folderDeleteHandler as EventListener);

    return () => {
      window.removeEventListener('cb:rename-request', handler as EventListener);
      window.removeEventListener('cb:rename-folder-request', folderRenameHandler as EventListener);
      window.removeEventListener('cb:delete-folder-request', folderDeleteHandler as EventListener);
    };
  }, [fetchFiles, getAuthToken, fileOperations]);

  // =============================
  // Handlers
  // =============================
  const handleEnterFolder = (folder: FolderItem) => {
    const slug = folder.slug || folder.name;
    const nextPath = enterFolder(slug, folder.name);
    fetchFilesForPath(nextPath);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Wylogowano pomyślnie');
    } catch {
      toast.error('Błąd podczas wylogowywania');
    }
  };

  const handleAdminPanel = () => router.push('/admin-panel');

  const handleFolderCreated = ({ slug, name }: { slug?: string; name: string }) => {
    if (slug) {
      const nextSlug = [...slugSegments, slug];
      const nextPath = [...path, name];
      setSlugSegments(nextSlug);
      setPath(nextPath);
      pushSlugPath(nextSlug, currentFolder);
      fetchFilesForPath(nextPath);
    } else {
      fetchFiles();
    }
  };

  const handleFolderRenamed = (info?: { newName: string; newPath: string; slug?: string }) => {
    fetchFiles();
    if (!info || !fileOperations.renameFolderTarget) return;

    const oldSlug = fileOperations.renameFolderTarget.slug || fileOperations.renameFolderTarget.name;
    const newSlug = info.slug || info.newName;

    setFolders((prev) =>
      prev.map((f) =>
        f.path === fileOperations.renameFolderTarget!.path
          ? { ...f, name: info.newName, path: info.newPath, slug: info.slug || f.slug }
          : f
      )
    );

    if (slugSegments[slugSegments.length - 1] === oldSlug) {
      const nextSlugSegs = [...slugSegments.slice(0, -1), newSlug];
      const nextPathNames = [...path.slice(0, -1), info.newName];
      setSlugSegments(nextSlugSegs);
      setPath(nextPathNames);
      pushSlugPath(nextSlugSegs, currentFolder);
    }
  };

  // Mobile menu state
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // =============================
  // Loading / Guard
  // =============================
  if (loading) return <StorageLoadingScreen />;
  if (!user) return null;

  // Check if any modal is open (for hiding FAB)
  const anyModalOpen =
    fileOperations.showShareModal ||
    fileOperations.showShareOptionsModal ||
    fileOperations.showManageLinksModal ||
    fileOperations.showStatsModal ||
    fileUpload.showCostCalculatorModal ||
    fileOperations.showRenameModal ||
    fileOperations.showNewFolderModal ||
    fileOperations.showRenameFolderModal ||
    fileOperations.showPreviewModal;

  // =============================
  // Render
  // =============================
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
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

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 pb-24 md:pb-8 overflow-hidden">
        <div className="space-y-3 sm:space-y-4">
          <StorageUsageBars refreshToken={fileOperations.storageRefreshTick} />

          <DragDropUpload onFilesSelected={fileUpload.handleFilesSelected}>
            <input
              id="file-upload-hidden"
              type="file"
              multiple
              className="hidden"
              onChange={fileUpload.handleFileUpload}
              disabled={fileUpload.hasActiveUploadsState}
            />

            {/* Unified Upload Panel */}
            <UnifiedUploadPanel
              uploads={fileUpload.allUnifiedUploads}
              onPause={fileUpload.pause}
              onResume={fileUpload.resume}
              onCancel={fileUpload.cancel}
              onRemove={fileUpload.remove}
            />

            {/* Main File Section */}
            <div className="mt-4 sm:mt-6 rounded-lg transition-all duration-200 glass-card bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl overflow-hidden">
              <StorageToolbar
                filesCount={files.length}
                viewMode={viewMode}
                sortField={sortField}
                sortDir={sortDir}
                multiSelectMode={multiSelectMode}
                selectedCount={selectedKeys.length}
                hasActiveUploads={fileUpload.hasActiveUploadsState}
                onViewModeChange={setViewMode}
                onSortChange={setSorting}
                onToggleMultiSelect={toggleMultiSelectMode}
                onUploadClick={() => document.getElementById('file-upload-hidden')?.click()}
                onNewFolder={fileOperations.handleNewFolder}
              />

              {multiSelectMode && (
                <SelectionBar
                  selectedCount={selectedKeys.length}
                  onClear={clearSelection}
                />
              )}

              <div className="px-4 sm:px-6 py-4 p-0">
                {filesLoading || !hasFetchedForPath ? (
                  <FolderLoader />
                ) : (
                  <FileGrid
                    files={sortedFiles}
                    folders={folders}
                    currentFolder={currentFolder}
                    viewMode={viewMode}
                    onDownload={fileOperations.handleFileDownload}
                    onPreview={fileOperations.handleFilePreview}
                    onDelete={fileOperations.handleFileDelete}
                    onShare={fileOperations.handleShare}
                    onStats={fileOperations.handleStats}
                    onManageLinks={fileOperations.handleManageLinks}
                    onEnterFolder={handleEnterFolder}
                    multiSelect={multiSelectMode}
                    selectedKeys={selectedKeys}
                    onToggleSelect={toggleSelect}
                    onMoved={() => {
                      fetchFiles();
                      fileOperations.bumpStorageUsage();
                    }}
                    showRootEntry={path.length > 0}
                    onGoRoot={() => {
                      pushSlugPath([], currentFolder);
                      setPath([]);
                      setSlugSegments([]);
                      fetchFilesForPath([]);
                    }}
                    rootTargetPath={rootBase}
                  />
                )}
              </div>
            </div>
          </DragDropUpload>
        </div>
      </main>

      {/* All Modals */}
      <StorageModals
        // Share modal
        shareData={fileOperations.shareData}
        showShareModal={fileOperations.showShareModal}
        onCloseShareModal={fileOperations.closeShareModal}
        // Share options modal
        selectedFileForShare={fileOperations.selectedFileForShare}
        showShareOptionsModal={fileOperations.showShareOptionsModal}
        onCloseShareOptionsModal={fileOperations.closeShareOptionsModal}
        onShareConfirm={fileOperations.handleShareConfirmLegacy}
        // Manage links modal
        selectedFileForManage={fileOperations.selectedFileForManage}
        showManageLinksModal={fileOperations.showManageLinksModal}
        onCloseManageLinksModal={fileOperations.closeManageLinksModal}
        // Stats modal
        selectedFileForStats={fileOperations.selectedFileForStats}
        showStatsModal={fileOperations.showStatsModal}
        onCloseStatsModal={fileOperations.closeStatsModal}
        // Cost calculator modal
        showCostCalculatorModal={fileUpload.showCostCalculatorModal}
        selectedFileForUpload={fileUpload.selectedFileForUpload}
        onCostCalculatorClose={fileUpload.handleCostCalculatorClose}
        onCostCalculatorConfirm={fileUpload.handleCostCalculatorConfirm}
        // Rename modal
        renameTarget={fileOperations.renameTarget}
        showRenameModal={fileOperations.showRenameModal}
        onCloseRenameModal={fileOperations.closeRenameModal}
        onRenamed={fetchFiles}
        // New folder modal
        showNewFolderModal={fileOperations.showNewFolderModal}
        onCloseNewFolderModal={fileOperations.closeNewFolderModal}
        currentFolder={currentFolder}
        pathSegments={path}
        onFolderCreated={handleFolderCreated}
        // Rename folder modal
        renameFolderTarget={fileOperations.renameFolderTarget}
        showRenameFolderModal={fileOperations.showRenameFolderModal}
        onCloseRenameFolderModal={fileOperations.closeRenameFolderModal}
        onFolderRenamed={handleFolderRenamed}
        // Preview modal
        previewFile={fileOperations.previewFile}
        showPreviewModal={fileOperations.showPreviewModal}
        onClosePreviewModal={fileOperations.closePreviewModal}
        onDownload={fileOperations.handleFileDownload}
        // Overwrite confirm modal
        showOverwriteConfirm={fileOperations.showOverwriteConfirm}
        onConfirmOverwrite={fileOperations.confirmOverwrite}
        onCancelOverwrite={fileOperations.cancelOverwrite}
      />

      {/* Mobile FAB */}
      <MobileActionsFab
        isUploading={fileUpload.hasActiveUploadsState}
        onUploadClick={() => document.getElementById('file-upload-hidden')?.click()}
        onNewFolder={fileOperations.handleNewFolder}
        multiSelectMode={multiSelectMode}
        onToggleMultiSelect={toggleMultiSelectMode}
        selectedCount={selectedKeys.length}
        hidden={anyModalOpen}
      />
    </div>
  );
}

export default function StoragePage() {
  return (
    <UploadProvider onUploadComplete={() => {}}>
      <StoragePageInner />
    </UploadProvider>
  );
}
