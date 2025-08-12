"use client";
import React, { useState, useEffect, useRef } from 'react';

interface MobileActionsFabProps {
  isUploading: boolean;
  onUploadClick: () => void;
  onNewFolder: () => void;
}

// (outside click handled inline)

export default function MobileActionsFab({ isUploading, onUploadClick, onNewFolder }: MobileActionsFabProps) {
  const [open, setOpen] = useState(false);
  // removed extra menus
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

  // removed sort/view logic

  return (
  <div className="md:hidden fixed bottom-4 right-4 z-[10000] flex flex-col items-end" ref={panelRef}>
      {/* Expanded panel */}
      <div className={`origin-bottom-right transition-all duration-200 ${open ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'} mb-3 w-48 rounded-xl bg-white/95 fab-blur fab-shadow border border-gray-200 p-3 space-y-2`}>
        {open && (
          <>
            <button
              onClick={onUploadClick}
              disabled={isUploading}
              className={`w-full h-10 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors ${isUploading ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              Plik
            </button>
            <button
              onClick={onNewFolder}
              className="w-full h-10 rounded-md text-sm font-medium flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h5l2 3h9v11a2 2 0 0 1-2 2H4Z"/></svg>
              Folder
            </button>
          </>
        )}
      </div>
      <button
        onClick={() => setOpen(o=>!o)}
        aria-label={open ? 'Zamknij menu akcji' : 'Otwórz menu akcji'}
        className={`w-14 h-14 flex items-center justify-center text-white fab-shadow fab-blur rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${open ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        <span className={`block transition-transform duration-200 ${open ? 'rotate-22.5' : 'rotate-0'}`}>
          {open ? (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12"/><path d="M6 18L18 6"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          )}
        </span>
      </button>
    </div>
  );
}
