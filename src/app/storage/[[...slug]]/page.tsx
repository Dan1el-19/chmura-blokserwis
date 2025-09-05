"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import toast from 'react-hot-toast';
import { UserRole, FileItem, FolderItem } from '@/types';
import StorageHeader from '@/components/layout/StorageHeader';
import FileGrid from '@/components/file/FileGrid';
import DragDropUpload from '@/components/file/DragDropUpload';
import { startUppyUploadWithProgress, UppyUploadHandle } from '@/lib/uppyEngine';
import { UploadProvider, useUpload } from '@/context/UploadContext';
import UnifiedUploadPanel from '@/components/file/UnifiedUploadPanel';

import ShareModal from '@/components/ui/ShareModal';
import MobileActionsFab from '../../../components/ui/MobileActionsFab';
import ShareOptionsModal from '@/components/ui/ShareOptionsModal';
import ManageLinksModal from '@/components/ui/ManageLinksModal';
import StatsModal from '@/components/ui/StatsModal';
import CostCalculatorModal from '@/components/ui/CostCalculatorModal';
import StorageUsageBars from '@/components/ui/StorageUsageBars';
import FolderLoader from '../../../components/ui/FolderLoader';

import { unifyAllUploads, hasActiveUploads } from '@/lib/uploadUnifier';
import RenameModal from '@/components/ui/RenameModal';
import NewFolderModal from '@/components/ui/NewFolderModal';
import RenameFolderModal from '@/components/ui/RenameFolderModal';
import FilePreviewModal from '@/components/ui/FilePreviewModal';

export const dynamic = 'force-dynamic';

function StoragePageInner() {
	// =============================
	// Auth & Basic State
	// =============================
	const [user, loading] = useAuthState(auth);
	const [userRole, setUserRole] = useState<UserRole>('basic');
	const router = useRouter();
	const pathname = usePathname();

	// =============================
	// File / Folder Data
	// =============================
	const [files, setFiles] = useState<FileItem[]>([]);
	const [folders, setFolders] = useState<FolderItem[]>([]);
	const [filesLoading, setFilesLoading] = useState(false);
	// Track whether current path has completed at least one fetch to avoid empty flicker
	const [hasFetchedForPath, setHasFetchedForPath] = useState(false);
	const [rootBase, setRootBase] = useState<string>('');
	const [currentFolder, setCurrentFolder] = useState('personal'); // space / root folder scope
	const [path, setPath] = useState<string[]>([]); // display names chain (without shortId suffixes)
	const [slugSegments, setSlugSegments] = useState<string[]>([]); // actual slug segments in URL

	// =============================
	// UI State (menus, dialogs, modals)
	// =============================
	const [showMobileMenu, setShowMobileMenu] = useState(false);
	const [showShareModal, setShowShareModal] = useState(false);
	const [showShareOptionsModal, setShowShareOptionsModal] = useState(false);
	const [showManageLinksModal, setShowManageLinksModal] = useState(false);
	const [showStatsModal, setShowStatsModal] = useState(false);
	const [showCostCalculatorModal, setShowCostCalculatorModal] = useState(false);
	const [showRenameModal, setShowRenameModal] = useState(false);
	const [showNewFolderModal, setShowNewFolderModal] = useState(false);
	const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
	const [renameFolderTarget, setRenameFolderTarget] = useState<FolderItem | null>(null);
	const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

	// Native browser download - no tracking needed

	// =============================
	// Target / Selection State
	// =============================
	const [shareData, setShareData] = useState<{ url: string; fileName: string; expiresAt?: string } | null>(null);
	const [selectedFileForShare, setSelectedFileForShare] = useState<FileItem | null>(null);
	const [selectedFileForManage, setSelectedFileForManage] = useState<FileItem | null>(null);
	const [selectedFileForStats, setSelectedFileForStats] = useState<FileItem | null>(null);
	const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
	const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
	const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
	const [showPreviewModal, setShowPreviewModal] = useState(false);
	const [moveTargetFolder, setMoveTargetFolder] = useState<FolderItem | null>(null);
	const [pendingMoveKeys, setPendingMoveKeys] = useState<string[]>([]);

	// =============================
	// Selection / View / Sorting
	// =============================
	const [multiSelectMode, setMultiSelectMode] = useState(false);
	const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const [sortField, setSortField] = useState<'name' | 'size' | 'lastModified'>('name');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

	// =============================
	// Upload (Uppy) State
	// =============================
	const useUppy = true; // ENABLED - Now using XHR upload with presigned URLs instead of TUS
	const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB threshold for special large file flow
	const [uppyJob, setUppyJob] = useState<{
		progress: number;
		status: 'uploading' | 'success' | 'error' | 'paused' | 'restored';
		speedBps?: number;
		handle: UppyUploadHandle | null;
		fileName?: string;
		fileSize?: number;
		bytesUploaded?: number;
	} | null>(null);

	// =============================
	// Helpers
	// =============================
	const getAuthToken = useCallback(async () => {
		return await user?.getIdToken();
	}, [user]);

	const refreshIdToken = useCallback(async () => {
		try {
			if (auth.currentUser) {
				await auth.currentUser.getIdToken(true);
			}
		} catch {
			// silent
		}
	}, []);

	// =============================
	// Data Fetchers
	// =============================
	// Guard against stale responses overwriting newer folder listings
	const requestSeqRef = useRef(0);
	// Guard against rapid double navigation causing duplicate slug segments
	const navigatingSlugRef = useRef<string | null>(null);
	const fetchUserData = useCallback(async () => {
		try {
			await refreshIdToken();
			const response = await fetch('/api/user/profile', {
				headers: { Authorization: `Bearer ${await getAuthToken()}` },
			});
			if (response.ok) {
				const userData = await response.json();
				setUserRole(userData.role);
			}
		} catch {
			// optional toast here
		}
	}, [getAuthToken, refreshIdToken]);

	const fetchFiles = useCallback(async () => {
		setFilesLoading(true);
		try {
			const reqId = ++requestSeqRef.current; // bump sequence
			const pathParam = encodeURIComponent(path.join('/'));
			const response = await fetch(
				`/api/files/list2?folder=${currentFolder}&path=${pathParam}`,
				{ headers: { Authorization: `Bearer ${await getAuthToken()}` } }
			);
			if (!response.ok) return;
			const data = await response.json();
			// Ignore if a newer request has been issued meanwhile
			if (reqId !== requestSeqRef.current) return;
			const normalized = (data.files as FileItem[]).map((f) => ({
				...f,
				lastModified: f.lastModified ? new Date(f.lastModified) : new Date(),
			}));
			setFiles(normalized);
			setFolders(data.folders || []);
			if (data.base) setRootBase(data.base as string);
			setHasFetchedForPath(true);
		} catch {
			// silent
		} finally { setFilesLoading(false); }
	}, [getAuthToken, currentFolder, path]);

		// Direct fetch for a prospective path (without waiting for setState + effect)
		const fetchFilesForPath = useCallback(async (parts: string[]) => {
			setFilesLoading(true);
			try {
				const reqId = ++requestSeqRef.current;
				const pathParam = encodeURIComponent(parts.join('/'));
				const response = await fetch(
					`/api/files/list2?folder=${currentFolder}&path=${pathParam}`,
					{ headers: { Authorization: `Bearer ${await getAuthToken()}` } }
				);
				if (!response.ok) return;
				const data = await response.json();
				if (reqId !== requestSeqRef.current) return; // stale
				const normalized = (data.files as FileItem[]).map((f) => ({
					...f,
					lastModified: f.lastModified ? new Date(f.lastModified) : new Date(),
				}));
				setFiles(normalized);
				setFolders(data.folders || []);
				if (data.base) setRootBase(data.base as string);
				setHasFetchedForPath(true);
			} catch {
				// ignore
			} finally { setFilesLoading(false); }
		}, [currentFolder, getAuthToken]);

	// =============================
	// Retro Metadata (backfill slug docs)
	// =============================
	const retroAttemptRef = useRef<Set<string>>(new Set());
	useEffect(() => {
		if (!user) return;
		if (!folders.length) return;
		if (!folders.some((f) => !f.slug)) return; // all have slugs
		const key = `${currentFolder}:${path.join('/')}`;
		if (retroAttemptRef.current.has(key)) return;
		retroAttemptRef.current.add(key);
		(async () => {
			try {
				await fetch('/api/folders/retro-meta', {
					method: 'POST',
						headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${await getAuthToken()}`,
					},
					body: JSON.stringify({ folder: currentFolder, path: path.join('/') }),
				});
				fetchFiles();
			} catch {
				// silent
			}
		})();
	}, [folders, user, currentFolder, path, fetchFiles, getAuthToken]);

	// =============================
	// Auth Redirect
	// =============================
	useEffect(() => {
		if (!loading && !user) {
			router.push('/login');
		}
	}, [user, loading, router]);

	// =============================
	// Parse slug segments from path (support /storage/main/... for main space)
	// =============================
	useEffect(() => {
		if (!user) return;
		const pn = pathname || '';
		const parts = pn.split('/').filter(Boolean);
		const storageIndex = parts.indexOf('storage');
		const remainder = storageIndex >= 0 ? parts.slice(storageIndex + 1) : [];
		if (remainder[0] === 'main') {
			if (currentFolder !== 'main') setCurrentFolder('main');
			const inner = remainder.slice(1);
			setSlugSegments(inner);
			setPath(inner.map(seg => seg.replace(/-[a-z0-9]{4}$/i,'').replace(/%20/g,' ')));
		} else {
			if (currentFolder !== 'personal') setCurrentFolder('personal');
			setSlugSegments(remainder);
			setPath(remainder.map(seg => seg.replace(/-[a-z0-9]{4}$/i,'').replace(/%20/g,' ')));
		}
	}, [pathname, user, currentFolder]);

	// Guard: if state says main but URL is bare /storage, ensure URL reflects /storage/main
	useEffect(() => {
		if (!user) return;
		if (currentFolder === 'main' && pathname === '/storage') {
			router.replace('/storage/main');
		}
	}, [currentFolder, pathname, router, user]);

	// Initial data load on user change (delay file listing until path parsed to avoid root overwrite race)
	useEffect(() => {
		if (user) {
			fetchUserData();
		}
	}, [user, fetchUserData]);

		// Re-fetch when folder path (slugSegments/path) changes
			const pathKey = path.join('/');
			useEffect(() => {
				if (!user) return;
				setFiles([]); // clear previous listing (avoid showing stale files from previous folder)
				setFolders([]);
				setHasFetchedForPath(false); // mark pending for this path
				fetchFiles();
			}, [user, currentFolder, pathKey, fetchFiles]);

	// slugSegments effect placeholder (kept to mirror previous logic)
	useEffect(() => {
		void slugSegments.length;
	}, [slugSegments]);

	// =============================
	// Navigation Helpers
	// =============================
		const pushSlugPath = (segments: string[], space: 'personal' | 'main' = currentFolder as 'personal' | 'main') => {
			const base = '/storage';
			const segs = space === 'main' ? ['main', ...segments] : segments;
			const full = segs.length ? base + '/' + segs.join('/') : (space === 'main' ? base + '/main' : base);
			if (full !== pathname) router.push(full);
		};

	// =============================
	// Event Listeners
	// =============================
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail as { file: FileItem };
			setRenameTarget(detail.file);
			setShowRenameModal(true);
		};
		window.addEventListener('cb:rename-request', handler as EventListener);
		const folderRenameHandler = (e: Event) => {
			const detail = (e as CustomEvent).detail as { folder: FolderItem };
			setRenameFolderTarget(detail.folder);
			setShowRenameFolderModal(true);
		};
		const folderDeleteHandler = async (e: Event) => {
			const detail = (e as CustomEvent).detail as { folder: FolderItem };
			const folder = detail.folder;
			if (!confirm(`Usunąć folder "${folder.name}" wraz z zawartością?`)) return;
			try {
				// Call backend delete (to implement) placeholder -> for now hit move/delete is absent
				const res = await fetch(`/api/files/delete-folder?path=${encodeURIComponent(folder.path)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${await getAuthToken()}` }});
				if (res.ok) { toast.success('Folder usunięty'); fetchFiles(); bumpStorageUsage(); }
				else { const err = await res.json().catch(()=>({})); toast.error(err.error||'Błąd usuwania folderu'); }
			} catch { toast.error('Błąd sieci usuwania'); }
		};
		window.addEventListener('cb:rename-folder-request', folderRenameHandler as EventListener);
		window.addEventListener('cb:delete-folder-request', folderDeleteHandler as EventListener);
		return () =>
			{
				window.removeEventListener('cb:rename-request', handler as EventListener);
				window.removeEventListener('cb:rename-folder-request', folderRenameHandler as EventListener);
				window.removeEventListener('cb:delete-folder-request', folderDeleteHandler as EventListener);
			};
	}, [fetchFiles, getAuthToken]);

	// =============================
	// Local Storage (persist view & sort)
	// =============================
	useEffect(() => {
		try {
			const saved = localStorage.getItem('cb_view_mode');
			if (saved === 'grid' || saved === 'list') setViewMode(saved);
			const savedSort = localStorage.getItem('cb_sort');
			if (savedSort) {
				const parsed = JSON.parse(savedSort) as {
					field: typeof sortField;
					dir: typeof sortDir;
				};
				if (parsed.field && parsed.dir) {
					setSortField(parsed.field);
					setSortDir(parsed.dir);
				}
			}
		} catch {
			// silent
		}
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem('cb_view_mode', viewMode);
		} catch {}
	}, [viewMode]);

	useEffect(() => {
		try {
			localStorage.setItem('cb_sort', JSON.stringify({ field: sortField, dir: sortDir }));
		} catch {}
	}, [sortField, sortDir]);

	// =============================
	// Upload Context
	// =============================
	const { enqueue, enqueueMultipart, uploads, multipartUploads, pause, resume, cancel, remove } = useUpload();
	const allUnifiedUploads = unifyAllUploads(uploads, uppyJob, multipartUploads);
	const hasActiveUploadsState = hasActiveUploads(uploads, uppyJob, multipartUploads);

	// Store current handle for cleanup on unmount only
	const currentHandleRef = useRef<UppyUploadHandle | null>(null);
	
	// Update ref when handle changes
	useEffect(() => {
		currentHandleRef.current = uppyJob?.handle || null;
	}, [uppyJob?.handle]);

	// Cleanup only on unmount - let the upload callbacks handle state transitions
	useEffect(() => {
		return () => {
			try {
				// Only cleanup on component unmount
				const currentHandle = currentHandleRef.current;
				if (currentHandle) {
					currentHandle.destroy();
				}
			} catch {}
		};
	}, []);

	// Warn before unload if active uploads
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const before = (e: BeforeUnloadEvent) => {
			if (hasActiveUploadsState) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', before);
		return () => window.removeEventListener('beforeunload', before);
	}, [hasActiveUploadsState]);

	// After uploads complete, refresh data
	useEffect(() => {
		const completed = uploads.filter((u) => u.status === 'completed');
		if (completed.length) {
			const t = setTimeout(() => {
				fetchFiles();
				fetchUserData();
			}, 1000);
			return () => clearTimeout(t);
		}
	}, [uploads, fetchFiles, fetchUserData]);

	// After multipart uploads complete, refresh data
	useEffect(() => {
		const completedMultipart = multipartUploads.filter((u) => u.status === 'completed');
		if (completedMultipart.length) {
			const t = setTimeout(() => {
				fetchFiles();
				fetchUserData();
			}, 1000);
			return () => clearTimeout(t);
		}
	}, [multipartUploads, fetchFiles, fetchUserData]);

	// =============================
	// Handlers - Upload
	// =============================
	const handleFileUpload = async (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const filesSel = e.target.files;
		if (!filesSel) return;
		
		const files = Array.from(filesSel);
		await handleFilesSelected(files);
		
		e.target.value = '';
	};

	const handleFilesSelected = async (sel: File[]) => {
		// 🚨 MOCNE ZABEZPIECZENIE: Sprawdź czy są aktywne uploady
		if (hasActiveUploadsState || (uppyJob && (uppyJob.status === 'uploading' || uppyJob.status === 'paused'))) {
			toast.error('Upload już trwa! Poczekaj aż zakończy się obecny upload.', {
				icon: '⚠️',
				duration: 4000,
			});
			return;
		}

		// Sprawdź czy użytkownik wybrał więcej niż 1 plik
		if (sel.length > 1) {
			toast('MultiUpload - Wkrótce', {
				icon: '⏳',
				duration: 3000,
			});
			return;
		}

		const subPath = path.join('/');
		
		// Process only the first file for now
		const firstFile = sel[0];
		if (!firstFile) return;
		
		// Multipart upload dla plików ≥50MB
		const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB - zgodne z API
		if (firstFile.size >= MULTIPART_THRESHOLD) {
			setSelectedFileForUpload(firstFile);
			setShowCostCalculatorModal(true);
		} else if (useUppy && firstFile.size >= LARGE_FILE_THRESHOLD) {
			setSelectedFileForUpload(firstFile);
			setShowCostCalculatorModal(true);
		} else {
			await enqueue(firstFile, currentFolder as 'personal' | 'main', subPath || undefined);
		}
	};

	const handleCostCalculatorConfirm = async () => {
		if (!selectedFileForUpload) return;
		
		// 🚨 DODATKOWE ZABEZPIECZENIE: Sprawdź czy nie rozpoczął się już jakiś upload
		if (hasActiveUploadsState || (uppyJob && uppyJob.status === 'uploading')) {
			toast.error('Upload już trwa! MultiUpload - Wkrótce', {
				icon: '⚠️',
				duration: 4000,
			});
			setShowCostCalculatorModal(false);
			setSelectedFileForUpload(null);
			return;
		}

		const f = selectedFileForUpload;
		const subPath = path.join('/');
		
		// Multipart upload dla plików ≥50MB
		const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB - zgodne z API
		const isMultipart = f.size >= MULTIPART_THRESHOLD;
		const isLarge = useUppy && f.size >= LARGE_FILE_THRESHOLD;
		
		if (isMultipart) {
			// Multipart upload - użyj enqueueMultipart
			try {
				await enqueueMultipart(f, currentFolder as 'personal' | 'main', subPath || undefined);
				toast.success('Rozpoczęto multipart upload');
			} catch (e) {
				toast.error(
					e instanceof Error ? e.message : 'Nie udało się rozpocząć multipart uploadu'
				);
			}
			setShowCostCalculatorModal(false);
			setSelectedFileForUpload(null);
		} else if (isLarge) {
			try {
				const handle = await startUppyUploadWithProgress(
					f,
					currentFolder as 'personal' | 'main',
					subPath || undefined,
					{
						onStarted: () =>
							setUppyJob((p) =>
								p
									? { ...p, status: 'uploading' }
									: {
											status: 'uploading',
											progress: 0,
											handle: null,
											fileName: f.name,
											fileSize: f.size,
										}
							),
						onProgress: (
							percent: number,
							bytesUploaded: number,
							bytesTotal: number,
							speedBps?: number
						) =>
							setUppyJob((p) => ({
								...(p || { status: 'uploading', progress: 0, handle: null }),
								progress: percent,
								speedBps,
								bytesUploaded,
								fileSize: bytesTotal,
							})),
						onSuccess: () => {
							setUppyJob((p) =>
								p
									? { ...p, status: 'success', progress: 100 }
									: { status: 'success', progress: 100, handle: null }
							);
							setTimeout(() => {
								setUppyJob(null);
							}, 1500);
							fetchFiles();
							fetchUserData();
						},
						onError: (msg: string) => {
							toast.error(msg);
							setUppyJob((p) =>
								p
									? { ...p, status: 'error' }
									: { status: 'error', progress: 0, handle: null }
							);
						},
						onCancel: () => {
							setUppyJob((p) =>
								p
									? { ...p, status: 'error' }
									: { status: 'error', progress: 0, handle: null }
							);
							toast('Anulowano upload');
						},
						onPaused: () =>
							setUppyJob((p) => (p ? { ...p, status: 'paused' } : p)),
						onResumed: () =>
							setUppyJob((p) => (p ? { ...p, status: 'uploading' } : p)),
						onRestored: (percent: number) =>
							setUppyJob({ progress: percent, status: 'restored', handle: null }),
					}
				);
				setUppyJob({
					progress: 0,
						status: 'uploading',
					handle,
					fileName: f.name,
					fileSize: f.size,
				});
			} catch (e) {
				toast.error(
					e instanceof Error ? e.message : 'Nie udało się rozpocząć uploadu'
				);
			}
			setShowCostCalculatorModal(false);
			setSelectedFileForUpload(null);
		} else {
			setShowCostCalculatorModal(false);
			setSelectedFileForUpload(null);
			await enqueue(f, currentFolder as 'personal' | 'main', subPath || undefined);
		}
	};

	const handleCostCalculatorClose = () => {
		setShowCostCalculatorModal(false);
		setSelectedFileForUpload(null);
	};

	// =============================
	// Handlers - Folder & Navigation
	// =============================
		const handleNewFolder = () => {
			setShowNewFolderModal(true);
		};

			const handleEnterFolder = (folder: FolderItem) => {
				const slug = folder.slug || folder.name;
				// Prevent rapid double clicks causing duplicate slug segments
				if (navigatingSlugRef.current === slug) return;
				const alreadyInside = slugSegments[slugSegments.length - 1] === slug;
				if (alreadyInside) return;
				navigatingSlugRef.current = slug;
				const nextSlug = [...slugSegments, slug];
				const nextPath = [...path, folder.name];
				setSlugSegments(nextSlug);
				setPath(nextPath);
				pushSlugPath(nextSlug, currentFolder as 'personal' | 'main');
				// Fetch new folder listing immediately
				fetchFilesForPath(nextPath);
			};

		// Clear navigation guard when slugSegments reflect navigation
		useEffect(() => {
			if (!navigatingSlugRef.current) return;
			const last = slugSegments[slugSegments.length - 1];
			if (last === navigatingSlugRef.current) {
				navigatingSlugRef.current = null;
			}
		}, [slugSegments]);

		const handleBreadcrumbClick = (index: number) => {
			if (index < 0) {
				pushSlugPath([], currentFolder as 'personal' | 'main');
				return;
			}
			const next = slugSegments.slice(0, index + 1);
			pushSlugPath(next, currentFolder as 'personal' | 'main');
		};

	const handleFolderChange = (folder: string) => {
		const target = folder === 'main' ? 'main' : 'personal';
		setCurrentFolder(target);
		setShowMobileMenu(false);
		pushSlugPath([], target as 'personal' | 'main');
	};

	// =============================
	// Handlers - Files (CRUD-ish)
	// =============================
	const handleFileDownload = async (file: FileItem) => {
		try {
			const response = await fetch(`/api/files/presigned?key=${encodeURIComponent(file.key)}&op=get`, {
				headers: {
					Authorization: `Bearer ${await getAuthToken()}`
				}
			});

			if (!response.ok) {
				toast.error('Błąd generowania linku do pobierania');
				return;
			}

			const { presignedUrl } = await response.json();

			// Native browser download - browser handles progress, resume, etc.
			window.location.href = presignedUrl;
			toast.success('Pobieranie rozpoczęte');
		} catch {
			toast.error('Błąd pobierania');
		}
	};

	const handleFilePreview = (file: FileItem) => {
		setPreviewFile(file);
		setShowPreviewModal(true);
	};


	// Storage usage refresh tick (updated after size-affecting operations)
	const [storageRefreshTick, setStorageRefreshTick] = useState(0);
	const bumpStorageUsage = () => setStorageRefreshTick(t=>t+1);

	const handleFileDelete = async (file: FileItem) => {
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
	};

	// =============================
	// Handlers - Sharing & Stats
	// =============================
	const handleShare = (file: FileItem) => {
		setSelectedFileForShare(file);
		setShowShareOptionsModal(true);
	};

	const handleShareConfirm = async (options: {
		minutes?: number;
		hours?: number;
		days?: number;
		months?: number;
		until?: string;
	}) => {
		if (!selectedFileForShare) return;
		try {
			const response = await fetch('/api/files/share', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${await getAuthToken()}`,
				},
				body: JSON.stringify({ key: selectedFileForShare.key, options }),
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

	interface LegacyShareOptions { minutes?: number; until?: string }
	const handleShareConfirmLegacy = async (
		expiresIn?: number,
		expiresAt?: Date
	) => {
		const options: LegacyShareOptions = {};
		if (expiresAt instanceof Date) {
			options.until = expiresAt.toISOString();
		} else if (typeof expiresIn === 'number' && expiresIn > 0) {
			options.minutes = Math.ceil(expiresIn / 60);
		}
		await handleShareConfirm(options);
	};

	const handleManageLinks = (file: FileItem) => {
		setSelectedFileForManage(file);
		setShowManageLinksModal(true);
	};
	const handleStats = (file: FileItem) => {
		setSelectedFileForStats(file);
		setShowStatsModal(true);
	};

	// =============================
	// Handlers - Session & Misc
	// =============================
	const handleLogout = async () => {
		try {
			await auth.signOut();
			router.push('/');
			toast.success('Wylogowano pomyślnie');
		} catch {
			toast.error('Błąd podczas wylogowywania');
		}
	};
	const handleAdminPanel = () => router.push('/admin-panel');

	// =============================
	// Selection Helpers
	// =============================
	const toggleSelect = (key: string) =>
		setSelectedKeys((prev) =>
			prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
		);
	const clearSelection = () => setSelectedKeys([]);

	// =============================
	// Move / Overwrite
	// =============================
	const confirmOverwrite = async () => {
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
				const { error } = await res
					.json()
					.catch(() => ({ error: 'Błąd przenoszenia' }));
				toast.error(error || 'Błąd przenoszenia');
			}
		} catch {
			toast.error('Błąd przenoszenia');
		} finally {
			setShowOverwriteConfirm(false);
			setPendingMoveKeys([]);
			setMoveTargetFolder(null);
		}
	};
	const cancelOverwrite = () => {
		setShowOverwriteConfirm(false);
		setPendingMoveKeys([]);
		setMoveTargetFolder(null);
	};

	// =============================
	// Derived Data
	// =============================
	const sortedFiles = useMemo(() => {
		const arr = [...files];
		arr.sort((a, b) => {
			let av: number | string = '';
			let bv: number | string = '';
			switch (sortField) {
				case 'name':
					av = a.name.toLowerCase();
					bv = b.name.toLowerCase();
					break;
				case 'size':
					av = a.size;
					bv = b.size;
					break;
				case 'lastModified':
					av = a.lastModified ? new Date(a.lastModified).getTime() : 0;
					bv = b.lastModified ? new Date(b.lastModified).getTime() : 0;
					break;
			}
			if (av === bv) return 0;
			const dir = sortDir === 'asc' ? 1 : -1;
			return av > bv ? dir : -1 * dir;
		});
		return arr;
	}, [files, sortField, sortDir]);

	// =============================


	// =============================
	// Loading / Guard
	// =============================
	if (loading)
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
					<p className="mt-4 text-gray-600">Ładowanie...</p>
				</div>
			</div>
		);
	if (!user) return null;

	// =============================
	// Render
	// =============================
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
				<div className="space-y-4">
					{path.length > 0 && (
						<nav
							className="text-sm text-gray-600 flex items-center gap-1 overflow-x-auto no-scrollbar flex-nowrap -mx-1 px-1"
							aria-label="Ścieżka"
						>
							<button
								className="hover:underline"
								onClick={() => handleBreadcrumbClick(-1)}
							>
								{currentFolder === 'main' ? 'main' : 'root'}
							</button>
							{path.map((seg, idx) => (
								<span key={idx} className="flex items-center gap-1">
									<span>/</span>
									<button
										className="hover:underline"
										onClick={() => handleBreadcrumbClick(idx)}
									>
										{seg}
									</button>
								</span>
							))}
						</nav>
					)}

					<StorageUsageBars refreshToken={storageRefreshTick} />

					{/* Usunięto niepotrzebne ostrzeżenie o aktywnych upload-ach */}

						<DragDropUpload onFilesSelected={handleFilesSelected}>
						<input
							id="file-upload-hidden"
							type="file"
							multiple
							className="hidden"
							onChange={handleFileUpload}
							disabled={hasActiveUploadsState}
						/>

						{/* Unified Upload Panel - zastępuje stary Uppy Panel */}
						<UnifiedUploadPanel 
								uploads={allUnifiedUploads}
								onPause={(id) => {
									pause(id);
								}}
								onResume={(id) => {
									resume(id);
								}}
								onCancel={(id) => {
									cancel(id);
								}}
								onRemove={(id) => {
									remove(id);
								}}
							/>

						{/* Main File Section */}
						<div className="mt-6 rounded-lg transition-all duration-200 glass-card bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl overflow-hidden">
							<div className="px-4 sm:px-6 py-3 border-b border-gray-200">
								<div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
									<h3 className="text-base sm:text-lg font-medium text-gray-900 leading-none h-9 flex items-center">Pliki</h3>
									<span className="hidden sm:inline-flex items-center h-9 text-xs text-gray-500 leading-none">{files.length} pozycji</span>
									<div className="ml-auto flex items-center gap-2">
										<select
											aria-label="Sortowanie"
											className="control-size rounded-md border border-gray-300 bg-white px-2 text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
											value={`${sortField}:${sortDir}`}
											onChange={(e) => { const [f,d]= e.target.value.split(':') as [typeof sortField, typeof sortDir]; setSortField(f); setSortDir(d); }}
										>
											<option value="name:asc">Nazwa A→Z</option>
											<option value="name:desc">Nazwa Z→A</option>
											<option value="size:asc">Rozmiar ↑</option>
											<option value="size:desc">Rozmiar ↓</option>
											<option value="lastModified:desc">Najnowsze</option>
											<option value="lastModified:asc">Najstarsze</option>
										</select>
										<div className="flex items-center gap-1">
											<button
												onClick={() => setViewMode('grid')}
												aria-label="Widok siatki"
												className={`control-icon-btn rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 text-gray-600 ${viewMode === 'grid' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}
											>
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" /></svg>
											</button>
											<button
												onClick={() => setViewMode('list')}
												aria-label="Widok listy"
												className={`control-icon-btn rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 text-gray-600 ${viewMode === 'list' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}
											>
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><rect x="4" y="5" width="16" height="2" rx="1" /><rect x="4" y="11" width="16" height="2" rx="1" /><rect x="4" y="17" width="16" height="2" rx="1" /></svg>
											</button>
										</div>
										<button
											onClick={() => { setMultiSelectMode(m=>!m); if (multiSelectMode) clearSelection(); }}
											aria-label="Tryb zaznaczania"
											className={`h-9 px-3 hidden md:inline-flex items-center gap-2 rounded-md border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${multiSelectMode ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
										>
											{multiSelectMode ? 'Zaznaczanie' : 'Zaznacz'}
											{multiSelectMode && selectedKeys.length>0 && (<span className="ml-1 text-xs bg-blue-600 text-white px-1 rounded">{selectedKeys.length}</span>)}
										</button>
										<button
											onClick={() => document.getElementById('file-upload-hidden')?.click()}
											disabled={hasActiveUploadsState}
											aria-label="Dodaj plik"
											className={`h-9 px-4 hidden md:inline-flex items-center gap-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm ${hasActiveUploadsState ? 'bg-blue-400 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
										>
											+ Plik
										</button>
										<button
											onClick={handleNewFolder}
											aria-label="Dodaj folder"
											className="h-9 px-4 hidden md:inline-flex items-center gap-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
										>
											+ Folder
										</button>
									</div>
								</div>
							</div>

							{multiSelectMode && selectedKeys.length > 0 && (
								<div className="px-4 sm:px-6 py-2 border-b border-gray-100 bg-blue-50 flex items-center justify-between text-sm">
									<span className="text-blue-700 font-medium">
										Zaznaczone: {selectedKeys.length}
									</span>
									<div className="flex gap-2">
										<button
											onClick={clearSelection}
											className="px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-white"
										>
											Wyczyść
										</button>
									</div>
								</div>
							)}

							<div className="px-4 sm:px-6 py-4 p-0">
								{(filesLoading || !hasFetchedForPath) ? <FolderLoader /> : 								<FileGrid
									files={sortedFiles}
									folders={folders}
									currentFolder={currentFolder}
									viewMode={viewMode}
									onDownload={handleFileDownload}
									onPreview={handleFilePreview}
									onDelete={handleFileDelete}
									onShare={handleShare}
									onStats={handleStats}
									onManageLinks={handleManageLinks}
									onEnterFolder={handleEnterFolder}
									multiSelect={multiSelectMode}
									selectedKeys={selectedKeys}
									onToggleSelect={toggleSelect}
									onMoved={() => { fetchFiles(); bumpStorageUsage(); }}
									showRootEntry={path.length>0}
									onGoRoot={() => { pushSlugPath([], currentFolder as 'personal' | 'main'); setPath([]); setSlugSegments([]); fetchFilesForPath([]); }}
									rootTargetPath={rootBase}
								/>}
							</div>
					</div>
				</DragDropUpload>
				</div>{/* end space-y-4 */}
			</main>
			<ShareModal
				isOpen={!!shareData && showShareModal}
				onClose={() => {
					setShowShareModal(false);
					setShareData(null);
				}}
				shareUrl={shareData?.url || ''}
				fileName={shareData?.fileName || ''}
				expiresAt={shareData?.expiresAt}
			/>
			{selectedFileForShare && (
				<ShareOptionsModal
					isOpen={showShareOptionsModal}
					onClose={() => {
						setShowShareOptionsModal(false);
						setSelectedFileForShare(null);
					}}
					onConfirm={(expiresIn?: number, expiresAt?: Date) =>
						handleShareConfirmLegacy(expiresIn, expiresAt)
					}
					fileName={selectedFileForShare.name}
				/>
			)}
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
			<CostCalculatorModal
				isOpen={showCostCalculatorModal}
				onClose={handleCostCalculatorClose}
				onConfirm={handleCostCalculatorConfirm}
				file={selectedFileForUpload}
			/>
			<RenameModal
				isOpen={showRenameModal}
				onClose={() => {
					setShowRenameModal(false);
					setRenameTarget(null);
				}}
				fileKey={renameTarget?.key || null}
				currentName={renameTarget?.name || null}
				onRenamed={() => {
					fetchFiles();
				}}
			/>
			<NewFolderModal
				isOpen={showNewFolderModal}
				onClose={()=>setShowNewFolderModal(false)}
				currentSpace={currentFolder as 'personal' | 'main'}
				pathSegments={path}
				onCreated={({ slug, name })=>{
					if (slug) {
						const nextSlug = [...slugSegments, slug];
						const nextPath = [...path, name];
						setSlugSegments(nextSlug);
						setPath(nextPath);
						pushSlugPath(nextSlug, currentFolder as 'personal' | 'main');
						fetchFilesForPath(nextPath);
					} else { fetchFiles(); }
				}}
			/>
			<RenameFolderModal
				isOpen={showRenameFolderModal}
				onClose={()=>{ setShowRenameFolderModal(false); setRenameFolderTarget(null); }}
				folderPath={renameFolderTarget?.path || null}
				currentName={renameFolderTarget?.name || null}
					onRenamed={(info)=>{
						fetchFiles();
						if (!info || !renameFolderTarget) return;
						// If we are currently inside this folder (it is the last segment), update path & slug segments and URL
						const oldSlug = renameFolderTarget.slug || renameFolderTarget.name;
						const newSlug = info.slug || `${info.newName}`;
						setFolders(prev=> prev.map(f=> f.path===renameFolderTarget.path ? { ...f, name: info.newName, path: info.newPath, slug: info.slug || f.slug } : f));
						if (slugSegments[slugSegments.length-1] === oldSlug) {
							const nextSlugSegs = [...slugSegments.slice(0,-1), newSlug];
							const nextPathNames = [...path.slice(0,-1), info.newName];
							setSlugSegments(nextSlugSegs);
							setPath(nextPathNames);
							pushSlugPath(nextSlugSegs, currentFolder as 'personal' | 'main');
						}
					}}
			/>
			{showOverwriteConfirm && (
				<div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4">
					<div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
						<h4 className="text-lg font-semibold">Nadpisać istniejące pliki?</h4>
						<p className="text-sm text-gray-600">
							Niektóre pliki istnieją w folderze docelowym. Kontynuacja spowoduje
							ich nadpisanie.
						</p>
						<div className="flex justify-end gap-2 pt-2">
							<button
								onClick={cancelOverwrite}
								className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
							>
								Anuluj
							</button>
							<button
								onClick={confirmOverwrite}
								className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
							>
								Nadpisz
							</button>
						</div>
					</div>
				</div>
			)}
		{/* Mobile Single FAB Action Menu */}
		<MobileActionsFab
			isUploading={hasActiveUploadsState}
			onUploadClick={()=> document.getElementById('file-upload-hidden')?.click()}
			onNewFolder={handleNewFolder}
		/>
		
		<FilePreviewModal
			isOpen={showPreviewModal}
			onClose={() => {
				setShowPreviewModal(false);
				setPreviewFile(null);
			}}
			file={previewFile}
			onDownload={handleFileDownload}
		/>
		</div>
	);
}

export default function StoragePage() {
	return <UploadProvider onUploadComplete={()=>{}}><StoragePageInner /></UploadProvider>;
}