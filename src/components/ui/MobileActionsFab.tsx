"use client";
import React, { useState, useEffect, useRef } from 'react';

interface MobileActionsFabProps {
  isUploading: boolean;
  onUploadClick: () => void;
  onNewFolder: () => void;
  multiSelectMode?: boolean;
  onToggleMultiSelect?: () => void;
  selectedCount?: number;
  hidden?: boolean;
}

export default function MobileActionsFab({ 
  isUploading, 
  onUploadClick, 
  onNewFolder,
  multiSelectMode = false,
  onToggleMultiSelect,
  selectedCount = 0,
  hidden = false
}: MobileActionsFabProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  
  // Outside click close
  useEffect(()=>{
    const handler = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  },[open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close menu when hidden
  useEffect(() => {
    if (hidden && open) setOpen(false);
  }, [hidden, open]);

  // Don't render if hidden
  if (hidden) return null;

  return (
  <div className="md:hidden fixed bottom-4 right-4 z-[10000] flex flex-col items-end pb-safe" ref={panelRef} style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      {/* Expanded panel */}
      <div className={`origin-bottom-right transition-all duration-200 ${open ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'} mb-3 w-44 sm:w-48 rounded-xl bg-white/95 fab-blur fab-shadow border border-gray-200 p-2.5 sm:p-3 space-y-2`}>
        {open && (
          <>
            <button
              onClick={()=>{ onUploadClick(); setOpen(false); }}
              disabled={isUploading}
              className={`w-full h-10 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors ${isUploading ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              Plik
            </button>
            <button
              onClick={()=>{ onNewFolder(); setOpen(false); }}
              className="w-full h-10 rounded-md text-sm font-medium flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h5l2 3h9v11a2 2 0 0 1-2 2H4Z"/></svg>
              Folder
            </button>
            {onToggleMultiSelect && (
              <button
                onClick={()=>{ onToggleMultiSelect(); setOpen(false); }}
                className={`w-full h-10 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors ${multiSelectMode ? 'bg-blue-100 border border-blue-500 text-blue-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                {multiSelectMode ? 'Wyjdź z zaznaczania' : 'Zaznacz pliki'}
              </button>
            )}
          </>
        )}
      </div>
      
      {/* Main FAB button - shows selection count when in multi-select mode */}
      <button
        onClick={() => setOpen(o=>!o)}
        aria-label={open ? 'Zamknij menu akcji' : 'Otwórz menu akcji'}
        className={`relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-white fab-shadow fab-blur rounded-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${multiSelectMode ? 'bg-blue-700' : open ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {/* Selection count badge */}
        {multiSelectMode && selectedCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {selectedCount > 99 ? '99+' : selectedCount}
          </span>
        )}
        <span className={`block transition-transform duration-200 ${open ? 'rotate-45' : 'rotate-0'}`}>
          {open ? (
            <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12"/><path d="M6 18L18 6"/></svg>
          ) : multiSelectMode ? (
            <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <path d="M17 14v6m-3-3h6"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          )}
        </span>
      </button>
    </div>
  );
}
