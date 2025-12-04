'use client';

import { SortField, SortDirection, ViewMode } from '@/hooks/storage';

interface StorageToolbarProps {
  filesCount: number;
  viewMode: ViewMode;
  sortField: SortField;
  sortDir: SortDirection;
  multiSelectMode: boolean;
  selectedCount: number;
  hasActiveUploads: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onSortChange: (field: SortField, dir: SortDirection) => void;
  onToggleMultiSelect: () => void;
  onUploadClick: () => void;
  onNewFolder: () => void;
}

export default function StorageToolbar({
  filesCount,
  viewMode,
  sortField,
  sortDir,
  multiSelectMode,
  selectedCount,
  hasActiveUploads,
  onViewModeChange,
  onSortChange,
  onToggleMultiSelect,
  onUploadClick,
  onNewFolder,
}: StorageToolbarProps) {
  return (
    <div className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 border-b border-gray-200">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
        <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900 leading-none flex items-center">
          Pliki
        </h3>
        <span className="hidden sm:inline-flex items-center text-[10px] sm:text-xs text-gray-500 leading-none">
          {filesCount} pozycji
        </span>
        <div className="ml-auto flex items-center gap-2 sm:gap-2">
          {/* Sort Select */}
          <select
            aria-label="Sortowanie"
            className="h-9 sm:h-8 rounded-md border border-gray-300 bg-white px-2 sm:px-2 text-xs sm:text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={`${sortField}:${sortDir}`}
            onChange={(e) => {
              const [f, d] = e.target.value.split(':') as [SortField, SortDirection];
              onSortChange(f, d);
            }}
          >
            <option value="name:asc">A→Z</option>
            <option value="name:desc">Z→A</option>
            <option value="size:asc">Rozmiar ↑</option>
            <option value="size:desc">Rozmiar ↓</option>
            <option value="lastModified:desc">Najnowsze</option>
            <option value="lastModified:asc">Najstarsze</option>
          </select>

          {/* View Mode Buttons */}
          <div className="flex items-center gap-1 sm:gap-1">
            <button
              onClick={() => onViewModeChange('grid')}
              aria-label="Widok siatki"
              className={`no-min-touch h-9 w-9 sm:h-8 sm:w-8 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 text-gray-600 inline-flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 sm:h-4 sm:w-4"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M3 15h18" />
                <path d="M9 3v18" />
                <path d="M15 3v18" />
              </svg>
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              aria-label="Widok listy"
              className={`no-min-touch h-9 w-9 sm:h-8 sm:w-8 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 text-gray-600 inline-flex items-center justify-center ${
                viewMode === 'list'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4 sm:h-4 sm:w-4"
              >
                <rect x="4" y="5" width="16" height="2" rx="1" />
                <rect x="4" y="11" width="16" height="2" rx="1" />
                <rect x="4" y="17" width="16" height="2" rx="1" />
              </svg>
            </button>
          </div>

          {/* Multi-select Button (desktop only) */}
          <button
            onClick={onToggleMultiSelect}
            aria-label="Tryb zaznaczania"
            className={`h-9 px-3 hidden md:inline-flex items-center gap-2 rounded-md border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              multiSelectMode
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {multiSelectMode ? 'Zaznaczanie' : 'Zaznacz'}
            {multiSelectMode && selectedCount > 0 && (
              <span className="ml-1 text-xs bg-blue-600 text-white px-1 rounded">
                {selectedCount}
              </span>
            )}
          </button>

          {/* Upload Button (desktop only) */}
          <button
            onClick={onUploadClick}
            disabled={hasActiveUploads}
            aria-label="Dodaj plik"
            className={`h-9 px-4 hidden md:inline-flex items-center gap-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm ${
              hasActiveUploads
                ? 'bg-blue-400 text-white cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            + Plik
          </button>

          {/* New Folder Button (desktop only) */}
          <button
            onClick={onNewFolder}
            aria-label="Dodaj folder"
            className="h-9 px-4 hidden md:inline-flex items-center gap-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            + Folder
          </button>
        </div>
      </div>
    </div>
  );
}
