'use client';

import { FileItem, FolderItem } from '@/types';

// Modal imports
import ShareModal from '@/components/ui/ShareModal';
import ShareOptionsModal from '@/components/ui/ShareOptionsModal';
import ManageLinksModal from '@/components/ui/ManageLinksModal';
import StatsModal from '@/components/ui/StatsModal';
import CostCalculatorModal from '@/components/ui/CostCalculatorModal';
import RenameModal from '@/components/ui/RenameModal';
import NewFolderModal from '@/components/ui/NewFolderModal';
import RenameFolderModal from '@/components/ui/RenameFolderModal';
import FilePreviewModal from '@/components/ui/FilePreviewModal';
import OverwriteConfirmModal from './OverwriteConfirmModal';

import { FolderSpace } from '@/hooks/storage';

interface ShareData {
  url: string;
  fileName: string;
  expiresAt?: string;
}

interface StorageModalsProps {
  // Share modal
  shareData: ShareData | null;
  showShareModal: boolean;
  onCloseShareModal: () => void;

  // Share options modal
  selectedFileForShare: FileItem | null;
  showShareOptionsModal: boolean;
  onCloseShareOptionsModal: () => void;
  onShareConfirm: (
    expiresIn?: number,
    expiresAt?: Date,
    name?: string,
    customSlug?: string
  ) => Promise<void>;

  // Manage links modal
  selectedFileForManage: FileItem | null;
  showManageLinksModal: boolean;
  onCloseManageLinksModal: () => void;

  // Stats modal
  selectedFileForStats: FileItem | null;
  showStatsModal: boolean;
  onCloseStatsModal: () => void;

  // Cost calculator modal
  showCostCalculatorModal: boolean;
  selectedFileForUpload: File | null;
  onCostCalculatorClose: () => void;
  onCostCalculatorConfirm: () => Promise<void>;

  // Rename modal
  renameTarget: FileItem | null;
  showRenameModal: boolean;
  onCloseRenameModal: () => void;
  onRenamed: () => void;

  // New folder modal
  showNewFolderModal: boolean;
  onCloseNewFolderModal: () => void;
  currentFolder: FolderSpace;
  pathSegments: string[];
  onFolderCreated: (info: { slug?: string; name: string }) => void;

  // Rename folder modal
  renameFolderTarget: FolderItem | null;
  showRenameFolderModal: boolean;
  onCloseRenameFolderModal: () => void;
  onFolderRenamed: (info?: { newName: string; newPath: string; slug?: string }) => void;

  // Preview modal
  previewFile: FileItem | null;
  showPreviewModal: boolean;
  onClosePreviewModal: () => void;
  onDownload: (file: FileItem) => Promise<void>;

  // Overwrite confirm modal
  showOverwriteConfirm: boolean;
  onConfirmOverwrite: () => Promise<void>;
  onCancelOverwrite: () => void;
}

export default function StorageModals({
  // Share modal
  shareData,
  showShareModal,
  onCloseShareModal,

  // Share options modal
  selectedFileForShare,
  showShareOptionsModal,
  onCloseShareOptionsModal,
  onShareConfirm,

  // Manage links modal
  selectedFileForManage,
  showManageLinksModal,
  onCloseManageLinksModal,

  // Stats modal
  selectedFileForStats,
  showStatsModal,
  onCloseStatsModal,

  // Cost calculator modal
  showCostCalculatorModal,
  selectedFileForUpload,
  onCostCalculatorClose,
  onCostCalculatorConfirm,

  // Rename modal
  renameTarget,
  showRenameModal,
  onCloseRenameModal,
  onRenamed,

  // New folder modal
  showNewFolderModal,
  onCloseNewFolderModal,
  currentFolder,
  pathSegments,
  onFolderCreated,

  // Rename folder modal
  renameFolderTarget,
  showRenameFolderModal,
  onCloseRenameFolderModal,
  onFolderRenamed,

  // Preview modal
  previewFile,
  showPreviewModal,
  onClosePreviewModal,
  onDownload,

  // Overwrite confirm modal
  showOverwriteConfirm,
  onConfirmOverwrite,
  onCancelOverwrite,
}: StorageModalsProps) {
  return (
    <>
      <ShareModal
        isOpen={!!shareData && showShareModal}
        onClose={onCloseShareModal}
        shareUrl={shareData?.url || ''}
        fileName={shareData?.fileName || ''}
        expiresAt={shareData?.expiresAt}
      />

      {selectedFileForShare && (
        <ShareOptionsModal
          isOpen={showShareOptionsModal}
          onClose={onCloseShareOptionsModal}
          onConfirm={onShareConfirm}
          fileName={selectedFileForShare.name}
        />
      )}

      {selectedFileForManage && (
        <ManageLinksModal
          isOpen={showManageLinksModal}
          onClose={onCloseManageLinksModal}
          fileKey={selectedFileForManage.key}
          fileName={selectedFileForManage.name}
        />
      )}

      {selectedFileForStats && (
        <StatsModal
          isOpen={showStatsModal}
          onClose={onCloseStatsModal}
          fileKey={selectedFileForStats.key}
          fileName={selectedFileForStats.name}
        />
      )}

      <CostCalculatorModal
        isOpen={showCostCalculatorModal}
        onClose={onCostCalculatorClose}
        onConfirm={onCostCalculatorConfirm}
        file={selectedFileForUpload}
      />

      <RenameModal
        isOpen={showRenameModal}
        onClose={onCloseRenameModal}
        fileKey={renameTarget?.key || null}
        currentName={renameTarget?.name || null}
        onRenamed={onRenamed}
      />

      <NewFolderModal
        isOpen={showNewFolderModal}
        onClose={onCloseNewFolderModal}
        currentSpace={currentFolder}
        pathSegments={pathSegments}
        onCreated={onFolderCreated}
      />

      <RenameFolderModal
        isOpen={showRenameFolderModal}
        onClose={onCloseRenameFolderModal}
        folderPath={renameFolderTarget?.path || null}
        currentName={renameFolderTarget?.name || null}
        onRenamed={onFolderRenamed}
      />

      <FilePreviewModal
        isOpen={showPreviewModal}
        onClose={onClosePreviewModal}
        file={previewFile}
        onDownload={onDownload}
      />

      <OverwriteConfirmModal
        isOpen={showOverwriteConfirm}
        onConfirm={onConfirmOverwrite}
        onCancel={onCancelOverwrite}
      />
    </>
  );
}
