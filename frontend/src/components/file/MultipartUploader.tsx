"use client";
/* eslint-disable react/display-name */
import React, { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import Uppy from '@uppy/core';
import { DashboardModal } from '@uppy/react';
import AwsS3 from '@uppy/aws-s3';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { auth } from '@/lib/firebase';

interface MultipartUploaderProps {
  folder: 'personal' | 'main';
  onComplete?: () => void;
}

export type MultipartUploaderHandle = {
  openWithFiles: (files: File[]) => void;
};

const MultipartUploader = forwardRef<MultipartUploaderHandle, MultipartUploaderProps>(({ folder, onComplete }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const uppy = useMemo(() => {
    const instance = new Uppy({
      allowMultipleUploads: true,
      autoProceed: false,
      restrictions: {
        maxFileSize: null,
        maxNumberOfFiles: 50,
        allowedFileTypes: null
      }
    })
  // @ts-expect-error: using AwsS3 in non-Companion mode; types are stricter than runtime usage
  .use(AwsS3, {
        // Tryb bez Companion: pobieramy presigned PUT URL z naszego backendu
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getUploadParameters: async (file: any) => {
          const token = await auth.currentUser?.getIdToken();
          // Zbuduj docelowy klucz w buckecie
          const key = folder === 'personal'
            ? `users/${auth.currentUser?.uid}/${file.name}`
            : `main/${file.name}`;
          const urlRes = await fetch(`/api/files/presigned?op=put&key=${encodeURIComponent(key)}`, {
            headers: { 'Authorization': `Bearer ${token || ''}` }
          });
          if (!urlRes.ok) throw new Error('Failed to get presigned PUT URL');
          const { presignedUrl } = await urlRes.json();
          return {
            method: 'PUT',
            url: presignedUrl,
            fields: {} as unknown as Record<string, never>
          } as { method: 'PUT'; url: string; fields: Record<string, never> };
        }
      });

    return instance;
  }, [folder]);

  useEffect(() => {
    return () => uppy.destroy();
  }, [uppy]);

  useEffect(() => {
    const handler = () => {
      onComplete?.();
      setIsOpen(false);
    };
    uppy.on('complete', handler);
    return () => {
      try { uppy.off('complete', handler); } catch {}
    };
  }, [uppy, onComplete]);

  useImperativeHandle(ref, () => ({
    openWithFiles: (files: File[]) => {
      // remove any previously added files since uppy.reset() is not available on the typed instance
      try {
        uppy.getFiles().forEach((f) => {
          try { uppy.removeFile(f.id); } catch {}
        });
      } catch {}
      setIsOpen(true);
      // Poczekaj aż modal i dashboard się zamontują, potem dodaj pliki
      const add = () => {
        files.forEach((file) => {
          try {
            uppy.addFile({
              name: file.name,
              type: file.type || 'application/octet-stream',
              data: file,
              source: 'Local',
              meta: {}
            });
          } catch {}
        });
      };
      if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        requestAnimationFrame(() => setTimeout(add, 0));
      } else {
        setTimeout(add, 0);
      }
    }
  }), [uppy]);

  return (
    <DashboardModal
      uppy={uppy}
      open={isOpen}
      onRequestClose={() => setIsOpen(false)}
      proudlyDisplayPoweredByUppy={false}
      closeAfterFinish={true}
      theme="auto"
      note="Wspiera wznowienia i bezpośredni upload do R2"
    />
  );
});

export default MultipartUploader;

Object.defineProperty(MultipartUploader, 'displayName', { value: 'MultipartUploader' });


