import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type FolderSpace = 'personal' | 'main';

interface StorageNavigationState {
  currentFolder: FolderSpace;
  path: string[];
  slugSegments: string[];
  setCurrentFolder: (folder: FolderSpace) => void;
  setPath: (path: string[]) => void;
  setSlugSegments: (segments: string[]) => void;
  pushSlugPath: (segments: string[], space?: FolderSpace) => void;
  handleBreadcrumbClick: (index: number) => void;
  handleFolderChange: (folder: string) => void;
  enterFolder: (folderSlug: string, folderName: string) => string[];
  navigatingSlugRef: React.MutableRefObject<string | null>;
}

export function useStorageNavigation(
  user: unknown,
  onNavigate?: (newPath: string[]) => void
): StorageNavigationState {
  const router = useRouter();
  const pathname = usePathname();

  const [currentFolder, setCurrentFolderState] = useState<FolderSpace>('personal');
  const [path, setPathState] = useState<string[]>([]);
  const [slugSegments, setSlugSegmentsState] = useState<string[]>([]);

  // Guard against rapid double navigation causing duplicate slug segments
  const navigatingSlugRef = useRef<string | null>(null);

  const pushSlugPath = useCallback(
    (segments: string[], space: FolderSpace = currentFolder) => {
      const base = '/storage';
      const segs = space === 'main' ? ['main', ...segments] : segments;
      const full = segs.length
        ? base + '/' + segs.join('/')
        : space === 'main'
        ? base + '/main'
        : base;
      if (full !== pathname) router.push(full);
    },
    [currentFolder, pathname, router]
  );

  // Parse slug segments from pathname
  useEffect(() => {
    if (!user) return;
    const pn = pathname || '';
    const parts = pn.split('/').filter(Boolean);
    const storageIndex = parts.indexOf('storage');
    const remainder = storageIndex >= 0 ? parts.slice(storageIndex + 1) : [];

    if (remainder[0] === 'main') {
      if (currentFolder !== 'main') setCurrentFolderState('main');
      const inner = remainder.slice(1);
      setSlugSegmentsState(inner);
      setPathState(
        inner.map((seg) =>
          seg.replace(/-[a-z0-9]{4}$/i, '').replace(/%20/g, ' ')
        )
      );
    } else {
      if (currentFolder !== 'personal') setCurrentFolderState('personal');
      setSlugSegmentsState(remainder);
      setPathState(
        remainder.map((seg) =>
          seg.replace(/-[a-z0-9]{4}$/i, '').replace(/%20/g, ' ')
        )
      );
    }
  }, [pathname, user, currentFolder]);

  // Guard: if state says main but URL is bare /storage, ensure URL reflects /storage/main
  useEffect(() => {
    if (!user) return;
    if (currentFolder === 'main' && pathname === '/storage') {
      router.replace('/storage/main');
    }
  }, [currentFolder, pathname, router, user]);

  // Clear navigation guard when slugSegments reflect navigation
  useEffect(() => {
    if (!navigatingSlugRef.current) return;
    const last = slugSegments[slugSegments.length - 1];
    if (last === navigatingSlugRef.current) {
      navigatingSlugRef.current = null;
    }
  }, [slugSegments]);

  const setCurrentFolder = useCallback((folder: FolderSpace) => {
    setCurrentFolderState(folder);
  }, []);

  const setPath = useCallback((newPath: string[]) => {
    setPathState(newPath);
  }, []);

  const setSlugSegments = useCallback((segments: string[]) => {
    setSlugSegmentsState(segments);
  }, []);

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      if (index < 0) {
        pushSlugPath([], currentFolder);
        return;
      }
      const next = slugSegments.slice(0, index + 1);
      pushSlugPath(next, currentFolder);
    },
    [slugSegments, currentFolder, pushSlugPath]
  );

  const handleFolderChange = useCallback(
    (folder: string) => {
      const target: FolderSpace = folder === 'main' ? 'main' : 'personal';
      setCurrentFolderState(target);
      pushSlugPath([], target);
    },
    [pushSlugPath]
  );

  const enterFolder = useCallback(
    (folderSlug: string, folderName: string): string[] => {
      // Prevent rapid double clicks causing duplicate slug segments
      if (navigatingSlugRef.current === folderSlug) return path;
      const alreadyInside = slugSegments[slugSegments.length - 1] === folderSlug;
      if (alreadyInside) return path;

      navigatingSlugRef.current = folderSlug;
      const nextSlug = [...slugSegments, folderSlug];
      const nextPath = [...path, folderName];

      setSlugSegmentsState(nextSlug);
      setPathState(nextPath);
      pushSlugPath(nextSlug, currentFolder);

      if (onNavigate) {
        onNavigate(nextPath);
      }

      return nextPath;
    },
    [slugSegments, path, currentFolder, pushSlugPath, onNavigate]
  );

  return {
    currentFolder,
    path,
    slugSegments,
    setCurrentFolder,
    setPath,
    setSlugSegments,
    pushSlugPath,
    handleBreadcrumbClick,
    handleFolderChange,
    enterFolder,
    navigatingSlugRef,
  };
}
