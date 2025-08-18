import * as React from 'react';
import { useState, useEffect, useRef } from 'react';

// Importy MUI...
import { LinearProgress, Typography, Box, Button, Paper, Stack } from '@mui/material';

// Importy Uppy
import Uppy from '@uppy/core';
import Tus from '@uppy/tus';
import GoldenRetriever from '@uppy/golden-retriever'; // <-- 1. NOWY IMPORT
import '@uppy/core/dist/style.min.css';
import '@uppy/golden-retriever/dist/style.min.css'; // Opcjonalne, przydatne do komunikatów

// ... (funkcje formatSpeed, LinearProgressWithLabel, typ UploadState bez zmian)
// ...

type UploadState = 'idle' | 'uploading' | 'paused' | 'complete' | 'error';

export default function UppyWithMuiProgress() {
  const [uppy] = useState(() => new Uppy({ 
      autoProceed: false, 
      debug: true,
    // GoldenRetriever options are passed when installing the plugin below
    }));

  // ... (stany bez zmian)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // === 2. DODANIE PLUGINU GOLDEN RETRIEVER ===
    // Najlepiej dodać go przed pluginem do wysyłania (Tus).
  uppy.use(GoldenRetriever, {});

    uppy.use(Tus, {
      endpoint: process.env.NEXT_PUBLIC_TUS_ENDPOINT || 'https://tusd.tusdemo.net/files/',
      retryDelays: [0, 3000, 5000, 10000, 20000],
    });

    // ... (reszta listenerów bez zmian)
    uppy.on('upload', () => setUploadState('uploading'));
    uppy.on('pause-all', () => setUploadState('paused'));
    uppy.on('resume-all', () => setUploadState('uploading'));
    uppy.on('cancel-all', () => setUploadState('idle'));
    uppy.on('complete', () => setUploadState('complete'));
    uppy.on('upload-error', () => setUploadState('error'));
    
    uppy.on('upload-progress', (file, progress) => {
      setUploadProgress(progress.percentage ?? 0);
      // progress.speed isn't always present depending on plugin; guard it
      // Using number | undefined is fine for the example UI
  setUploadSpeed(((progress as unknown) as { speed?: number }).speed ?? 0);
    });

    // Gdy GoldenRetriever odtworzy pliki, zaktualizuj stan UI
    uppy.on('restored', () => {
        const files = uppy.getFiles();
        if (files.length > 0) {
            // Zakładamy scenariusz z jednym plikiem
            const restoredFile = files[0];
            setSelectedFile(restoredFile.data as File);
            setUploadProgress(restoredFile.progress?.percentage || 0);
            
            // Jeśli wysyłanie było w trakcie, ustaw stan na 'paused'
            // aby użytkownik mógł je wznowić.
            if (!restoredFile.progress?.uploadComplete) {
                setUploadState('paused');
            } else {
                setUploadState('complete');
            }
        }
        console.log('Restore complete!');
    });


  return () => uppy.destroy();
  }, [uppy]);

  // ... (reszta komponentu, handlery i JSX bez zmian)
  // ...
  const handleSelectFileClick = () => {
    try {
      fileInputRef.current?.click();
    } catch {}
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    // remove any previous files from uppy instance (reset() is not available on the typed instance)
    try {
      uppy.getFiles().forEach((f) => {
        try { uppy.removeFile(f.id); } catch {}
      });
    } catch {}
    uppy.addFile({
      name: file.name,
      type: file.type || 'application/octet-stream',
      data: file,
      source: 'Local'
    });
    setSelectedFile(file);
    setUploadProgress(0);
    setUploadSpeed(0);
    // clear input value so same file can be selected again
    event.currentTarget.value = '';
  };

  const handleStartUpload = async () => {
    try {
      setUploadState('uploading');
      await uppy.upload();
      // Uppy emits 'complete' which will update state; ensure final values
      setUploadProgress(100);
    } catch (err) {
      console.error('Uppy upload error', err);
      setUploadState('error');
    }
  };
  const handlePause = () => uppy.pauseAll();
  const handleResume = () => uppy.resumeAll();
  const handleCancel = () => uppy.cancelAll();
  const handleRetry = () => uppy.retryAll();

  return (
    <Paper sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Stack spacing={2}>
        <Typography variant="h6">Uppy (example) — Resumable upload</Typography>

        <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button variant="contained" onClick={handleSelectFileClick}>Wybierz plik</Button>
          <Button variant="outlined" onClick={handleStartUpload} disabled={!selectedFile || uploadState === 'uploading'}>Start</Button>
          <Button variant="outlined" onClick={handlePause} disabled={uploadState !== 'uploading'}>Pauza</Button>
          <Button variant="outlined" onClick={handleResume} disabled={uploadState !== 'paused'}>Wznów</Button>
          <Button variant="outlined" color="error" onClick={handleCancel} disabled={uploadState === 'idle'}>Anuluj</Button>
          <Button variant="text" onClick={handleRetry}>Retry</Button>
        </Box>

        {selectedFile && (
          <Box>
            <Typography variant="body2">Plik: {selectedFile.name} — {Math.round(selectedFile.size / (1024*1024))} MB</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 10, borderRadius: 6 }} />
              </Box>
              <Box sx={{ minWidth: 80 }}>
                <Typography variant="body2">{Math.round(uploadProgress)}%</Typography>
              </Box>
              <Box sx={{ minWidth: 100 }}>
                <Typography variant="body2">{uploadSpeed > 0 ? `${(uploadSpeed / (1024*1024)).toFixed(2)} MB/s` : '—'}</Typography>
              </Box>
            </Box>
          </Box>
        )}

        {selectedFile && uploadState === 'paused' && (
          <Typography sx={{ mt: 1, fontStyle: 'italic' }}>Wysyłanie spauzowane. Możesz je teraz wznowić.</Typography>
        )}
      </Stack>
    </Paper>
  );
}