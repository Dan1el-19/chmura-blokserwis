"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  File, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Archive, 
  FileText, 
  HardDrive,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  BarChart3
} from 'lucide-react';
import { FileItem, FolderItem } from '@/types';
import toast from 'react-hot-toast';

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-amber-500"><path d="M4 4h5l2 3h9v11a2 2 0 0 1-2 2H4Z"/></svg>
);
import { formatBytes } from '@/lib/utils';

import { auth } from '@/lib/firebase';

interface FileGridProps {
  files: FileItem[];
  folders?: FolderItem[];
  currentFolder: string;
  viewMode: 'grid' | 'list';
  onDownload: (file: FileItem) => void;
  onPreview?: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onManageLinks: (file: FileItem) => void;
  onStats: (file: FileItem) => void;
  uploads?: Array<{
    id: string;
    fileName: string;
    folder: string;
    uploadedBytes: number;
    size: number;
  }>;
  onEnterFolder?: (folder: FolderItem) => void;
  onMoved?: () => void;
  multiSelect?: boolean;
  selectedKeys?: string[];
  onToggleSelect?: (key: string) => void;
  // Show pseudo 'Storage' root entry when inside a subfolder
  showRootEntry?: boolean;
  onGoRoot?: () => void;
  rootTargetPath?: string; // base path for drops to root
}

export default function FileGrid({ 
  files, 
  folders = [],
  currentFolder, 
  viewMode,
  onDownload, 
  onPreview,
  onShare, 
  onDelete, 
  onManageLinks, 
  onStats,
  onEnterFolder,
  onMoved,
  multiSelect = false,
  selectedKeys = [],
  onToggleSelect,
  uploads = [],
  showRootEntry = false,
  onGoRoot,
  rootTargetPath
}: FileGridProps) {

  const [showActions, setShowActions] = useState<string | null>(null); // file menu
  const [showFolderActions, setShowFolderActions] = useState<string | null>(null); // folder menu
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderItem | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const clickAnchorRef = useRef<DOMRect | null>(null);

  // Ładuj thumbnail URL-e dla obrazów
  useEffect(() => {
    const loadThumbnailUrls = async () => {
      const newThumbnailUrls: Record<string, string> = {};
      
      for (const file of files) {
        if (isImageFile(file.name) && !file.publicUrl) {
          try {
            const response = await fetch(`/api/files/presigned?key=${encodeURIComponent(file.key)}`, {
              headers: {
                'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              newThumbnailUrls[file.key] = data.presignedUrl;
            }
          } catch (error) {
            console.error('Error getting presigned URL for', file.key, error);
          }
        }
      }
      
      setThumbnailUrls(newThumbnailUrls);
    };

    if (files.length > 0) {
      loadThumbnailUrls();
    }
  }, [files]);

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return <File className="h-8 w-8" />;
    
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
    
  if (imageExts.includes(extension)) return <ImageIcon className="h-8 w-8" />;
    if (videoExts.includes(extension)) return <Video className="h-8 w-8" />;
    if (audioExts.includes(extension)) return <Music className="h-8 w-8" />;
    if (archiveExts.includes(extension)) return <Archive className="h-8 w-8" />;
    if (docExts.includes(extension)) return <FileText className="h-8 w-8" />;
    
    return <File className="h-8 w-8" />;
  };

  const isImageFile = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    return extension ? imageExts.includes(extension) : false;
  };

  const getThumbnailUrl = (file: FileItem) => {
    // Jeśli plik ma publicUrl, użyj go jako miniaturki
    if (file.publicUrl) return file.publicUrl;
    
    // Jeśli to obraz, użyj presigned URL z cache
    if (isImageFile(file.name)) {
      return thumbnailUrls[file.key] || null;
    }
    
    return null;
  };

  const formatDate = (date: Date) => {
    try {
      if (!date || isNaN(date.getTime())) {
        return 'Nieznana data';
      }
      return new Intl.DateTimeFormat('pl-PL', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return 'Nieznana data';
    }
  };

  const handleFileClick = (file: FileItem) => {
    if (onPreview) {
      onPreview(file);
    }
  };

  const handleActionClick = (fileId: string, file: FileItem, event: React.MouseEvent) => {
    event.stopPropagation();
    if (showActions === fileId) {
      setShowActions(null);
      setMenuPosition(null);
      setActiveFile(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    clickAnchorRef.current = rect;
    // Wstępna pozycja (poniżej i wyrównanie do prawej krawędzi przycisku)
    setMenuPosition({ top: rect.bottom + 6, left: rect.right - 192 });
    setShowActions(fileId);
    setActiveFile(file);
  };

  const closeMenu = useCallback(() => {
    setShowActions(null);
  setShowFolderActions(null);
    setMenuPosition(null);
    setActiveFile(null);
  setActiveFolder(null);
  }, []);

  const handleAction = (action: string, file: FileItem) => {
    closeMenu();
    switch (action) {
      case 'download':
        onDownload(file); break;
      case 'share':
        onShare(file); break;
      case 'delete':
        onDelete(file); break;
      case 'manage':
        onManageLinks(file); break;
      case 'stats':
        onStats(file); break;
      case 'rename': {
        // Delegated to external modal via custom event
        const custom = new CustomEvent('cb:rename-request', { detail: { file } });
        window.dispatchEvent(custom);
        break; }
    }
  };

  const handleFolderActionClick = (folder: FolderItem, event: React.MouseEvent) => {
    event.stopPropagation();
    const id = folder.path;
    if (showFolderActions === id) {
      setShowFolderActions(null);
      setMenuPosition(null);
      setActiveFolder(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    clickAnchorRef.current = rect;
    setMenuPosition({ top: rect.bottom + 6, left: rect.right - 192 });
    setShowFolderActions(id);
    setActiveFolder(folder);
  };

  const handleFolderAction = (action: string, folder: FolderItem) => {
    closeMenu();
    switch(action){
      case 'rename': {
        const custom = new CustomEvent('cb:rename-folder-request', { detail: { folder } });
        window.dispatchEvent(custom);
        break;
      }
      case 'delete': {
        const custom = new CustomEvent('cb:delete-folder-request', { detail: { folder } });
        window.dispatchEvent(custom);
        break;
      }
      case 'download': {
        toast('Pobieranie folderu jako ZIP wkrótce');
        break;
      }
      case 'share': {
        toast('Udostępnianie folderów wkrótce');
        break;
      }
    }
  };

  // Close on click outside / escape / resize / scroll
  useEffect(() => {
    if (!showActions && !showFolderActions) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-file-menu]')) return;
      closeMenu();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    const handleWindowChange = () => closeMenu();
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [showActions, showFolderActions, closeMenu]);

  // Reposition after render & on size/position change
  useEffect(() => {
    if (!showActions && !showFolderActions) return;
    requestAnimationFrame(() => {
      const el = menuRef.current;
      const anchor = clickAnchorRef.current;
      if (!el || !anchor) return;
      const rect = el.getBoundingClientRect();
      let { top, left } = menuPosition || { top: anchor.bottom + 6, left: anchor.right - rect.width };
      if (left < 8) left = 8;
      if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
      if (top + rect.height > window.innerHeight - 8) {
        const aboveTop = anchor.top - rect.height - 6;
        if (aboveTop >= 8) top = aboveTop;
      }
      if (!menuPosition || top !== menuPosition.top || left !== menuPosition.left) {
        setMenuPosition({ top, left });
      }
    });
  }, [showActions, showFolderActions, menuPosition]);

  const filteredUploads = uploads.filter(upload => upload.folder === currentFolder);

  return (
    <div className="space-y-6">
      {/* Upload Progress Section */}
      {filteredUploads.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">
            Uploady w toku ({filteredUploads.length})
          </h3>
          <div className="space-y-2">
            {filteredUploads.map((upload) => (
              <div key={upload.id} className="flex items-center justify-between text-sm">
                <span className="text-blue-800 truncate">{upload.fileName}</span>
                <span className="text-blue-600">
                  {Math.round((upload.uploadedBytes / upload.size) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Grid */}
      {files.length === 0 && folders.length === 0 ? (
        <div className="text-center py-12">
          <HardDrive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2 font-roboto">
            Brak plików w tym folderze
          </h3>
          <p className="text-gray-500">
            {currentFolder === 'personal' ? 'Twój folder jest pusty' : 'Folder główny jest pusty'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
  <div className="grid gap-4 sm:gap-5 file-grid-mobile sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 grid-cols-2">
          {showRootEntry && (
            <div
              className="group relative glass-card bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg p-3 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer file-tile-animate"
              role="button"
              tabIndex={0}
              aria-label="Powrót do root"
              onClick={() => onGoRoot?.()}
              onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); onGoRoot?.(); } }}
              onDragOver={(e)=>{e.preventDefault(); e.currentTarget.classList.add('ring','ring-blue-400');}}
              onDragLeave={(e)=>{e.currentTarget.classList.remove('ring','ring-blue-400');}}
              onDrop={async (e)=>{
                e.preventDefault();
                e.currentTarget.classList.remove('ring','ring-blue-400');
                const key = e.dataTransfer.getData('application/x-file-key');
                if (!key) return;
                const selectedAttr = e.dataTransfer.getData('application/x-selected-keys');
                let keys: string[] = [];
                if (selectedAttr) { try { keys = JSON.parse(selectedAttr); } catch { keys = []; } }
                if (!keys.length && multiSelect && selectedKeys.includes(key)) { keys = selectedKeys; }
                try {
                  const bodyPayload = keys.length > 1 ? { keys, targetFolderPath: rootTargetPath } : { key, targetFolderPath: rootTargetPath };
                  const res = await fetch('/api/files/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}` },
                    body: JSON.stringify(bodyPayload)
                  });
                  if (res.ok) { toast.success(keys.length>1?`Przeniesiono ${keys.length} pliki`:'Przeniesiono'); onMoved?.(); } else { const { error } = await res.json().catch(()=>({error:'Błąd przenoszenia'})); toast.error(error||'Błąd przenoszenia'); }
                } catch { toast.error('Błąd przenoszenia'); }
              }}
            >
              <div className="aspect-square mb-3 flex items-center justify-center bg-slate-50 rounded-lg overflow-hidden">
                <HardDrive className="h-8 w-8 text-slate-500" />
              </div>
              <div className="mt-1">
                <p className="text-sm font-medium text-gray-900 truncate" title="Storage">Storage</p>
                <p className="text-xs text-gray-500">Root</p>
              </div>
            </div>
          )}
          {folders.map((folder, idx) => (
            <div
              key={folder.path}
              className="group relative glass-card bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg p-3 sm:p-4 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer file-tile-animate text-[13px]"
              style={{ animationDelay: `${idx * 40}ms` }}
              role="button"
              tabIndex={0}
              aria-label={`Folder: ${folder.name}`}
  onClick={() => onEnterFolder?.(folder)}
  onKeyDown={(e) => { if (e.key==='Enter') { e.preventDefault(); onEnterFolder?.(folder);} }}
              onDragOver={(e)=>{e.preventDefault(); e.currentTarget.classList.add('ring','ring-blue-400');}}
              onDragLeave={(e)=>{e.currentTarget.classList.remove('ring','ring-blue-400');}}
              onDrop={async (e)=>{
                e.preventDefault();
                e.currentTarget.classList.remove('ring','ring-blue-400');
                const key = e.dataTransfer.getData('application/x-file-key');
                if (!key) return;
                // If multi-select active and dragged key is among selection, move all selected
                const selectedAttr = e.dataTransfer.getData('application/x-selected-keys');
                let keys: string[] = [];
                if (selectedAttr) {
                  try { keys = JSON.parse(selectedAttr); } catch { keys = []; }
                }
                if (!keys.length) {
                  // fallback: if key is part of selectedKeys (closure), group them
                  if (multiSelect && selectedKeys.includes(key)) {
                    keys = selectedKeys;
                  }
                }
                try {
                  const bodyPayload = keys.length > 1 ? { keys, targetFolderPath: folder.path } : { key, targetFolderPath: folder.path };
                  const res = await fetch('/api/files/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}` },
                    body: JSON.stringify(bodyPayload)
                  });
                  if (res.ok) { toast.success(keys.length>1?`Przeniesiono ${keys.length} pliki`:'Przeniesiono'); onMoved?.(); } else { const { error } = await res.json().catch(()=>({error:'Błąd przenoszenia'})); toast.error(error||'Błąd przenoszenia'); }
                } catch { toast.error('Błąd przenoszenia'); }
              }}
            >
              <div data-square className="aspect-square mb-3 flex items-center justify-center bg-amber-50 rounded-lg overflow-hidden">
                <FolderIcon />
              </div>
              <div className="mt-1 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={folder.name}>{folder.name}</p>
                  <p className="text-xs text-gray-500">Folder</p>
                </div>
                <button
                  onClick={(e)=>handleFolderActionClick(folder,e)}
                  aria-label="Opcje folderu"
                  className="mt-0.5 inline-flex items-center justify-center rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 p-1 transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {files.map((file, idx) => {
            const thumbnailUrl = thumbnailUrls[file.key] || getThumbnailUrl(file);
            
            return (
              <div
                key={file.key}
                className={`group relative glass-card bg-white/80 backdrop-blur-sm border ${selectedKeys.includes(file.key) && multiSelect ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200/50'} rounded-lg p-3 sm:p-4 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer file-tile-animate text-[13px]`}
                style={{ animationDelay: `${idx * 40}ms` }}
                onClick={() => { if (multiSelect) { onToggleSelect?.(file.key); return; } handleFileClick(file); }}
                role="button"
                tabIndex={0}
                aria-label={`Plik: ${file.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (multiSelect) { onToggleSelect?.(file.key); } else { handleFileClick(file); } }
                }}
                draggable
                onDragStart={(e)=>{ 
                  e.dataTransfer.setData('application/x-file-key', file.key); 
                  if (multiSelect && selectedKeys.includes(file.key)) {
                    try { e.dataTransfer.setData('application/x-selected-keys', JSON.stringify(selectedKeys)); } catch {}
                  }
                  e.dataTransfer.effectAllowed='move'; 
                }}
              >
                {/* Selection checkbox */}
                {multiSelect && (
                  <button
                    type="button"
                    aria-label={selectedKeys.includes(file.key)?'Odznacz plik':'Zaznacz plik'}
                    onClick={(e)=>{ e.stopPropagation(); onToggleSelect?.(file.key); }}
                    className={`absolute top-2 left-2 z-10 h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-semibold border transition-colors ${selectedKeys.includes(file.key) ? 'bg-blue-600 border-blue-600 text-white shadow' : 'bg-white/80 border-gray-300 text-gray-400 hover:text-gray-600'}`}
                  >
                    {selectedKeys.includes(file.key) ? '✓' : ''}
                  </button>
                )}
                {/* Thumbnail/Icon */}
                <div data-square className="aspect-square mb-3 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                  {thumbnailUrl && isImageFile(file.name) ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        src={thumbnailUrl}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          // Fallback do ikony jeśli obraz się nie załaduje
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    </>
                  ) : null}
                  <div className={`${thumbnailUrl && isImageFile(file.name) ? 'hidden' : ''} flex items-center justify-center`}>
                    {getFileIcon(file.name)}
                  </div>
                </div>

                {/* File Info + Actions (inline) */}
                <div className="mt-1">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight min-h-[2.4em]" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                    </div>
                    <button
                      onClick={(e) => handleActionClick(file.key, file, e)}
                      className="mt-0.5 inline-flex items-center justify-center rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 p-1 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                      aria-label="Opcje pliku"
                      aria-haspopup={true}
                      aria-expanded={showActions === file.key}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // List View
  <div className="space-y-2 relative overflow-visible">
          {showRootEntry && (
            <div
              className="group relative flex items-center space-x-4 p-4 glass-card bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer overflow-visible"
              role="button"
              tabIndex={0}
              aria-label="Powrót do root"
              onClick={() => onGoRoot?.()}
              onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); onGoRoot?.(); } }}
              onDragOver={(e)=>{e.preventDefault(); e.currentTarget.classList.add('ring','ring-blue-400');}}
              onDragLeave={(e)=>{e.currentTarget.classList.remove('ring','ring-blue-400');}}
              onDrop={async (e)=>{
                e.preventDefault();
                e.currentTarget.classList.remove('ring','ring-blue-400');
                const key = e.dataTransfer.getData('application/x-file-key');
                if (!key) return;
                const selectedAttr = e.dataTransfer.getData('application/x-selected-keys');
                let keys: string[] = [];
                if (selectedAttr) { try { keys = JSON.parse(selectedAttr); } catch { keys = []; } }
                if (!keys.length && multiSelect && selectedKeys.includes(key)) { keys = selectedKeys; }
                try {
                  const bodyPayload = keys.length > 1 ? { keys, targetFolderPath: rootTargetPath } : { key, targetFolderPath: rootTargetPath };
                  const res = await fetch('/api/files/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}` },
                    body: JSON.stringify(bodyPayload)
                  });
                  if (res.ok) { toast.success(keys.length>1?`Przeniesiono ${keys.length} pliki`:'Przeniesiono'); onMoved?.(); } else { const { error } = await res.json().catch(()=>({error:'Błąd przenoszenia'})); toast.error(error||'Błąd przenoszenia'); }
                } catch { toast.error('Błąd przenoszenia'); }
              }}
            >
              <div className="flex-shrink-0"><HardDrive className="h-8 w-8 text-slate-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate" title="Storage">Storage</p>
                <p className="text-xs text-gray-500">Root</p>
              </div>
            </div>
          )}
          {folders.map(folder => (
            <div
              key={folder.path}
              className="group relative flex items-center space-x-4 p-4 glass-card bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer overflow-visible"
              role="button"
              tabIndex={0}
              aria-label={`Folder: ${folder.name}`}
  onClick={() => onEnterFolder?.(folder)}
  onKeyDown={(e) => { if (e.key==='Enter') { e.preventDefault(); onEnterFolder?.(folder);} }}
              onDragOver={(e)=>{e.preventDefault(); e.currentTarget.classList.add('ring','ring-blue-400');}}
              onDragLeave={(e)=>{e.currentTarget.classList.remove('ring','ring-blue-400');}}
              onDrop={async (e)=>{
                e.preventDefault();
                e.currentTarget.classList.remove('ring','ring-blue-400');
                const key = e.dataTransfer.getData('application/x-file-key');
                if (!key) return;
                const selectedAttr = e.dataTransfer.getData('application/x-selected-keys');
                let keys: string[] = [];
                if (selectedAttr) { try { keys = JSON.parse(selectedAttr); } catch { keys = []; } }
                if (!keys.length && multiSelect && selectedKeys.includes(key)) { keys = selectedKeys; }
                try {
                  const bodyPayload = keys.length > 1 ? { keys, targetFolderPath: folder.path } : { key, targetFolderPath: folder.path };
                  const res = await fetch('/api/files/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}` },
                    body: JSON.stringify(bodyPayload)
                  });
                  if (res.ok) { toast.success(keys.length>1?`Przeniesiono ${keys.length} pliki`:'Przeniesiono'); onMoved?.(); } else { const { error } = await res.json().catch(()=>({error:'Błąd przenoszenia'})); toast.error(error||'Błąd przenoszenia'); }
                } catch { toast.error('Błąd przenoszenia'); }
              }}
            >
              <div className="flex-shrink-0"><FolderIcon /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate" title={folder.name}>{folder.name}</p>
                <p className="text-xs text-gray-500">Folder</p>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={(e)=>handleFolderActionClick(folder,e)}
                  className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500 px-3 py-1.5 text-sm p-1"
                  aria-label="Opcje folderu"
                  aria-haspopup={true}
                  aria-expanded={showFolderActions === folder.path}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {files.map((file) => (
            <div
              key={file.key}
                            className={`group relative flex items-center space-x-3 sm:space-x-4 p-3 sm:p-4 glass-card bg-white/80 backdrop-blur-sm border ${selectedKeys.includes(file.key) && multiSelect ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-200/50'} rounded-lg hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer overflow-visible`}
                              onClick={() => { if (multiSelect) { onToggleSelect?.(file.key); return; } handleFileClick(file); }}
              role="button"
              tabIndex={0}
              aria-label={`Plik: ${file.name}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (multiSelect) { onToggleSelect?.(file.key); } else { handleFileClick(file); } }
              }}
        draggable
        onDragStart={(e)=>{ 
          e.dataTransfer.setData('application/x-file-key', file.key); 
          if (multiSelect && selectedKeys.includes(file.key)) {
            try { e.dataTransfer.setData('application/x-selected-keys', JSON.stringify(selectedKeys)); } catch {}
          }
          e.dataTransfer.effectAllowed='move'; 
        }}
            >
              {/* Selection checkbox */}
              {multiSelect && (
                <button
                  type="button"
                  aria-label={selectedKeys.includes(file.key)?'Odznacz plik':'Zaznacz plik'}
                  onClick={(e)=>{ e.stopPropagation(); onToggleSelect?.(file.key); }}
                  className={`flex-shrink-0 h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-semibold border transition-colors ${selectedKeys.includes(file.key) ? 'bg-blue-600 border-blue-600 text-white shadow' : 'bg-white/80 border-gray-300 text-gray-400 hover:text-gray-600'}`}
                >
                  {selectedKeys.includes(file.key) ? '✓' : ''}
                </button>
              )}
              {/* File Icon */}
              <div className="flex-shrink-0">
                {getFileIcon(file.name)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatBytes(file.size)} • {formatDate(file.lastModified)}
                </p>
              </div>

              {/* Actions Menu (always visible) */}
              <div className="flex-shrink-0">
                <button
                  onClick={(e) => handleActionClick(file.key, file, e)}
                  className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500 px-2 sm:px-3 py-1.5 text-sm p-1"
                  aria-label="Opcje pliku"
                  aria-haspopup={true}
                  aria-expanded={showActions === file.key}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Portal dla menu akcji */}
      {(showActions || showFolderActions) && menuPosition && (activeFile || activeFolder) && createPortal(
        <div
          data-file-menu
          ref={menuRef}
          className="fixed z-[9999] w-48 bg-white border border-gray-200 rounded-lg shadow-lg animate-in fade-in data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 will-change-transform"
          role="menu"
          aria-label={showFolderActions ? 'Opcje folderu' : 'Opcje pliku'}
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div className="py-1">
            {showFolderActions && activeFolder ? (
              <>
                <button onClick={(e)=>{e.stopPropagation(); handleFolderAction('download', activeFolder);}} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center" role="menuitem"><Download className="h-4 w-4 mr-2"/>Pobierz</button>
                <button onClick={(e)=>{e.stopPropagation(); handleFolderAction('share', activeFolder);}} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center" role="menuitem"><Share2 className="h-4 w-4 mr-2"/>Udostępnij</button>
                <button onClick={(e)=>{e.stopPropagation(); handleFolderAction('rename', activeFolder);}} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center" role="menuitem"><FileText className="h-4 w-4 mr-2"/>Zmień nazwę</button>
                <hr className="my-1" />
                <button onClick={(e)=>{e.stopPropagation(); handleFolderAction('delete', activeFolder);}} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center" role="menuitem"><Trash2 className="h-4 w-4 mr-2"/>Usuń</button>
              </>
            ) : activeFile ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); handleAction('download', activeFile); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center" role="menuitem"><Download className="h-4 w-4 mr-2" />Pobierz</button>
                <button onClick={(e) => { e.stopPropagation(); handleAction('share', activeFile); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center" role="menuitem"><Share2 className="h-4 w-4 mr-2" />Udostępnij</button>
                <button onClick={(e) => { e.stopPropagation(); handleAction('manage', activeFile); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center" role="menuitem"><Share2 className="h-4 w-4 mr-2" />Zarządzaj linkami</button>
                <button onClick={(e) => { e.stopPropagation(); handleAction('stats', activeFile); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center" role="menuitem"><BarChart3 className="h-4 w-4 mr-2" />Statystyki</button>
                <button onClick={(e) => { e.stopPropagation(); handleAction('rename', activeFile); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center" role="menuitem"><FileText className="h-4 w-4 mr-2" />Zmień nazwę</button>
                <hr className="my-1" />
                <button onClick={(e) => { e.stopPropagation(); handleAction('delete', activeFile); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center" role="menuitem"><Trash2 className="h-4 w-4 mr-2" />Usuń</button>
              </>
            ) : null}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
