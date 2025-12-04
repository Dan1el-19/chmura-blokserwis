import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FileItem, FolderItem } from "@/types";
import { FolderSpace } from "./useStorageNavigation";
import { SortField, SortDirection } from "./useViewPreferences";

interface StorageDataState {
  files: FileItem[];
  folders: FolderItem[];
  filesLoading: boolean;
  hasFetchedForPath: boolean;
  rootBase: string;
  sortedFiles: FileItem[];
  fetchFiles: () => Promise<void>;
  fetchFilesForPath: (parts: string[]) => Promise<void>;
  setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
  setFolders: React.Dispatch<React.SetStateAction<FolderItem[]>>;
  clearData: () => void;
}

interface UseStorageDataOptions {
  currentFolder: FolderSpace;
  path: string[];
  sortField: SortField;
  sortDir: SortDirection;
  getAuthToken: () => Promise<string | undefined>;
}

export function useStorageData({
  currentFolder,
  path,
  sortField,
  sortDir,
  getAuthToken,
}: UseStorageDataOptions): StorageDataState {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [hasFetchedForPath, setHasFetchedForPath] = useState(false);
  const [rootBase, setRootBase] = useState<string>("");

  // Guard against stale responses overwriting newer folder listings
  const requestSeqRef = useRef(0);

  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const reqId = ++requestSeqRef.current;
      const pathParam = encodeURIComponent(path.join("/"));
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
      // Silent fail
    } finally {
      setFilesLoading(false);
    }
  }, [getAuthToken, currentFolder, path]);

  // Direct fetch for a prospective path (without waiting for setState + effect)
  const fetchFilesForPath = useCallback(
    async (parts: string[]) => {
      setFilesLoading(true);
      try {
        const reqId = ++requestSeqRef.current;
        const pathParam = encodeURIComponent(parts.join("/"));
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
        // Silent fail
      } finally {
        setFilesLoading(false);
      }
    },
    [currentFolder, getAuthToken]
  );

  const clearData = useCallback(() => {
    setFiles([]);
    setFolders([]);
    setHasFetchedForPath(false);
  }, []);

  // Sorted files (memoized)
  const sortedFiles = useMemo(() => {
    const arr = [...files];
    arr.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";
      switch (sortField) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "size":
          av = a.size;
          bv = b.size;
          break;
        case "lastModified":
          av = a.lastModified ? new Date(a.lastModified).getTime() : 0;
          bv = b.lastModified ? new Date(b.lastModified).getTime() : 0;
          break;
      }
      if (av === bv) return 0;
      const dir = sortDir === "asc" ? 1 : -1;
      return av > bv ? dir : -1 * dir;
    });
    return arr;
  }, [files, sortField, sortDir]);

  return {
    files,
    folders,
    filesLoading,
    hasFetchedForPath,
    rootBase,
    sortedFiles,
    fetchFiles,
    fetchFilesForPath,
    setFiles,
    setFolders,
    clearData,
  };
}

// Hook for retro metadata backfill
export function useRetroMetadata(
  user: unknown,
  folders: FolderItem[],
  currentFolder: FolderSpace,
  path: string[],
  getAuthToken: () => Promise<string | undefined>,
  fetchFiles: () => Promise<void>
) {
  const retroAttemptRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    if (!folders.length) return;
    if (!folders.some((f) => !f.slug)) return; // all have slugs

    const key = `${currentFolder}:${path.join("/")}`;
    if (retroAttemptRef.current.has(key)) return;
    retroAttemptRef.current.add(key);

    (async () => {
      try {
        await fetch("/api/folders/retro-meta", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getAuthToken()}`,
          },
          body: JSON.stringify({ folder: currentFolder, path: path.join("/") }),
        });
        fetchFiles();
      } catch {
        // Silent fail
      }
    })();
  }, [folders, user, currentFolder, path, fetchFiles, getAuthToken]);
}
