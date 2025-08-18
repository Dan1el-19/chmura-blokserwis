/* eslint-disable @typescript-eslint/no-explicit-any */
import Uppy from '@uppy/core';
import Tus from '@uppy/tus';
import GoldenRetriever from '@uppy/golden-retriever';
import { auth } from '@/lib/firebase';

export type UppyUploadStatus = 'idle' | 'uploading' | 'error' | 'success';

export interface UppyUploadCallbacks {
  onProgress?: (
    progressPercent: number,
    bytesUploaded: number,
    bytesTotal: number,
    speedBps?: number
  ) => void;
  onStarted?: () => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
  onCancel?: () => void;
  onPaused?: () => void;
  onResumed?: () => void;
  onRestored?: (progressPercent: number) => void;
}

export interface UppyUploadHandle {
  id: string;
  uppy: Uppy;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  supportsPause: boolean;
  supportsResume: boolean;
}

function buildObjectKey(folder: 'personal' | 'main', fileName: string, userId?: string): string {
  if (folder === 'personal') {
    return `users/${userId || 'unknown'}/${fileName}`;
  }
  return `main/${fileName}`;
}

export async function startUppyUploadWithProgress(
  file: File,
  folder: 'personal' | 'main',
  callbacks: UppyUploadCallbacks = {}
): Promise<UppyUploadHandle> {
  const currentUser = auth.currentUser;
  // Dla TUS nie potrzebujemy presigned PUT; użyj konfigurowalnego endpointu TUS
  const tusEndpoint = process.env.NEXT_PUBLIC_TUS_ENDPOINT || '';
  if (!tusEndpoint) {
    callbacks.onError?.('Brak konfiguracji TUS: ustaw NEXT_PUBLIC_TUS_ENDPOINT');
    throw new Error('Missing NEXT_PUBLIC_TUS_ENDPOINT');
  }

  const uppy = new Uppy({ autoProceed: false, allowMultipleUploads: false, debug: false });
  // Persist client-side state for restoration after refresh
  uppy.use(GoldenRetriever);
  uppy.use(Tus, {
    endpoint: tusEndpoint,
    retryDelays: [0, 3000, 5000, 10000],
    chunkSize: 5 * 1024 * 1024
  });

  // Jeśli GoldenRetriever przywróci stare pliki z poprzedniej sesji,
  // a my startujemy nowy upload, wyczyść je by uniknąć natychmiastowego cancel/100%.
  try {
    const restored = uppy.getFiles();
    if (restored.length > 0) {
      restored.forEach((f) => { try { uppy.removeFile(f.id); } catch {} });
    }
  } catch {}

  // Płynny progress i prędkość
  let targetPercent = 0;
  let displayedPercent = 0;
  let smoothingTimer: ReturnType<typeof setInterval> | null = null;
  let lastSpeed = 0;

  const startSmoothing = () => {
    if (smoothingTimer) return;
    smoothingTimer = setInterval(() => {
      // zbliżaj się do celu (mniejsze kroki, częstsze odświeżanie)
      displayedPercent = displayedPercent + (targetPercent - displayedPercent) * 0.12;
      // clamp
      if (!isFinite(displayedPercent)) displayedPercent = 0;
      if (displayedPercent > 99.8 && targetPercent >= 100) displayedPercent = 100;
      const clamped = Math.max(0, Math.min(100, displayedPercent));
      callbacks.onProgress?.(Math.round(clamped), Math.round((clamped / 100) * file.size), file.size, lastSpeed);
    }, 100);
  };

  const stopSmoothing = () => {
    if (smoothingTimer) {
      clearInterval(smoothingTimer);
      smoothingTimer = null;
    }
  };

  uppy.on('upload-progress', (uppyFile: any, progress: any) => {
    // Tus emituje percentage i speed
    const total = (uppyFile as any)?.size ?? file.size ?? 0;
    targetPercent = typeof progress?.percentage === 'number' ? progress.percentage : 0;
    lastSpeed = typeof progress?.speed === 'number' ? progress.speed : lastSpeed;
    // tick
    // natychmiastowy pierwszy tick
    if (!smoothingTimer) {
      displayedPercent = targetPercent;
      const uploadedInstant = Math.round((displayedPercent / 100) * total);
      callbacks.onProgress?.(Math.round(displayedPercent), uploadedInstant, total, lastSpeed);
      startSmoothing();
    }
    // Wywołuj także przy każdym evencie, aby stan był zawsze świeży (jak w przykładzie)
    try {
      const uploadedNow = Math.round(((targetPercent || 0) / 100) * total);
      callbacks.onProgress?.(Math.round(targetPercent || 0), uploadedNow, total, lastSpeed);
    } catch {}
  });

  uppy.on('upload', () => {
    callbacks.onStarted?.();
  });

  uppy.on('upload-error', (_file, error) => {
    stopSmoothing();
    const msg = error?.message || 'Błąd podczas wysyłki';
    callbacks.onError?.(msg);
  });

  uppy.on('cancel-all', () => {
    // Upewnij się, że nie emitujemy 100% przy anulowaniu – tylko zatrzymujemy smoothing i raportujemy cancel
    stopSmoothing();
    callbacks.onCancel?.();
  });

  uppy.on('pause-all', () => {
    callbacks.onPaused?.();
  });

  uppy.on('resume-all', () => {
    callbacks.onResumed?.();
  });

  uppy.on('restored', () => {
    try {
      const files = uppy.getFiles();
      // Bierzemy tylko matching po nazwie; w innym wypadku czyścimy stare wpisy
      const match = files.find((f: any) => f?.name === file.name);
      if (match) {
        const percent = (match as any)?.progress?.percentage ?? 0;
        displayedPercent = percent;
        targetPercent = percent;
        callbacks.onRestored?.(Math.round(percent));
      } else {
        files.forEach((f) => { try { uppy.removeFile(f.id); } catch {} });
        displayedPercent = 0;
        targetPercent = 0;
      }
    } catch {}
  });

  uppy.on('complete', () => {
    targetPercent = 100;
    displayedPercent = 100;
    callbacks.onProgress?.(100, file.size, file.size, lastSpeed);
    stopSmoothing();
    callbacks.onSuccess?.();
  });

  uppy.addFile({
    name: file.name,
    type: file.type || 'application/octet-stream',
    data: file,
    source: 'Local',
    // provide a canonical object key so server can store the file under users/<uid>/...
    meta: {
      key: buildObjectKey(folder, file.name, currentUser?.uid)
    }
  } as any);

  void uppy.upload();

  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    uppy,
    cancel: () => { try { uppy.cancelAll(); } catch {} },
    pause: () => { try { uppy.pauseAll(); } catch {} },
    resume: () => { try { uppy.resumeAll(); } catch {} },
    destroy: () => { try { stopSmoothing(); uppy.destroy(); } catch {} },
    supportsPause: true,
    supportsResume: true
  };
}


