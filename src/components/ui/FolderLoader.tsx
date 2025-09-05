"use client";
import * as React from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

interface FolderLoaderProps { label?: string }

// Prosty loader pokazywany podczas ładowania listy plików / folderów
export default function FolderLoader({ label = 'Ładowanie plików...' }: FolderLoaderProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, gap: 2 }}>
      <CircularProgress />
      <span className="text-sm text-gray-600 font-medium">{label}</span>
    </Box>
  );
}
