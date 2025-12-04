import { useState, useEffect } from 'react';

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'size' | 'lastModified';
export type SortDirection = 'asc' | 'desc';

interface ViewPreferences {
  viewMode: ViewMode;
  sortField: SortField;
  sortDir: SortDirection;
  setViewMode: (mode: ViewMode) => void;
  setSortField: (field: SortField) => void;
  setSortDir: (dir: SortDirection) => void;
  setSorting: (field: SortField, dir: SortDirection) => void;
}

const STORAGE_KEY_VIEW = 'cb_view_mode';
const STORAGE_KEY_SORT = 'cb_sort';

export function useViewPreferences(): ViewPreferences {
  const [viewMode, setViewModeState] = useState<ViewMode>('grid');
  const [sortField, setSortFieldState] = useState<SortField>('name');
  const [sortDir, setSortDirState] = useState<SortDirection>('asc');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(STORAGE_KEY_VIEW);
      if (savedView === 'grid' || savedView === 'list') {
        setViewModeState(savedView);
      }

      const savedSort = localStorage.getItem(STORAGE_KEY_SORT);
      if (savedSort) {
        const parsed = JSON.parse(savedSort) as {
          field: SortField;
          dir: SortDirection;
        };
        if (parsed.field && parsed.dir) {
          setSortFieldState(parsed.field);
          setSortDirState(parsed.dir);
        }
      }
    } catch {
      // Silent fail - use defaults
    }
  }, []);

  // Persist viewMode
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VIEW, viewMode);
    } catch {
      // Silent fail
    }
  }, [viewMode]);

  // Persist sort preferences
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_SORT,
        JSON.stringify({ field: sortField, dir: sortDir })
      );
    } catch {
      // Silent fail
    }
  }, [sortField, sortDir]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
  };

  const setSortField = (field: SortField) => {
    setSortFieldState(field);
  };

  const setSortDir = (dir: SortDirection) => {
    setSortDirState(dir);
  };

  const setSorting = (field: SortField, dir: SortDirection) => {
    setSortFieldState(field);
    setSortDirState(dir);
  };

  return {
    viewMode,
    sortField,
    sortDir,
    setViewMode,
    setSortField,
    setSortDir,
    setSorting,
  };
}
