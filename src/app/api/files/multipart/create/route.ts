import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebaseAdmin';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3';

export async function POST(request: NextRequest) {
  try {
    // Sprawdź autoryzację
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decodedToken;
    
    try {
      if (!auth) {
        return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
      }
      decodedToken = await auth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Sprawdź czy użytkownik jest zalogowany
    if (!decodedToken.uid) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Parsuj body
    const body = await request.json();
    const { fileName, fileSize, key, folder, subPath } = body;

    // Walidacja
    if (!fileName || !fileSize || !key || !folder) {
      return NextResponse.json({ 
        error: 'Missing required fields: fileName, fileSize, key, folder' 
      }, { status: 400 });
    }

    // Sprawdź rozmiar pliku (minimum 50MB dla multipart)
    const MIN_MULTIPART_SIZE = 50 * 1024 * 1024; // 50MB
    if (fileSize < MIN_MULTIPART_SIZE) {
      return NextResponse.json({ 
        error: `File size must be at least ${MIN_MULTIPART_SIZE / (1024 * 1024)}MB for multipart upload` 
      }, { status: 400 });
    }

    // Sprawdź folder
    if (!['personal', 'main'].includes(folder)) {
      return NextResponse.json({ error: 'Invalid folder. Must be "personal" or "main"' }, { status: 400 });
    }

    // Zbuduj pełny klucz obiektu
    const fullKey = buildObjectKey(folder, fileName, decodedToken.uid, subPath);

    // Inicjalizuj multipart upload na R2
    const s3Client = initializeS3Client();
    const bucketName = getBucketName();

    const createMultipartCommand = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: fullKey,
      Metadata: {
        'uploaded-by': decodedToken.uid,
        'upload-time': new Date().toISOString(),
        'file-size': fileSize.toString(),
        'folder': folder,
        'sub-path': subPath || '',
        'content-type': getContentType(fileName)
      }
    });

    const result = await s3Client.send(createMultipartCommand);

    if (!result.UploadId) {
      throw new Error('Failed to get upload ID from R2');
    }

    // Zapisz informacje o uploadzie w systemie (można dodać Firestore)
    // await saveMultipartUploadInfo({
    //   uploadId: result.UploadId,
    //   key: fullKey,
    //   userId: decodedToken.uid,
    //   fileName,
    //   fileSize,
    //   folder,
    //   subPath,
    //   status: 'initializing',
    //   createdAt: new Date()
    // });

    // Zwróć odpowiedź
    return NextResponse.json({
      uploadId: result.UploadId,
      key: fullKey,
      status: 'created',
      message: 'Multipart upload initialized successfully',
      bucket: bucketName,
      region: 'auto'
    });

  } catch {
    console.error('Error creating multipart upload');
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Helper functions

function buildObjectKey(folder: 'personal' | 'main', fileName: string, userId: string, subPath?: string): string {
  const cleanSub = (subPath || '').replace(/^[\/]+/, '').replace(/\.\./g,'').replace(/\/+/g,'/').replace(/\s+$/,'').replace(/^\s+/,'');
  const nested = cleanSub ? `${cleanSub.replace(/\/$/,'')}/` : '';
  
  if (folder === 'personal') {
    return `users/${userId}/${nested}${fileName}`;
  }
  return `main/${nested}${fileName}`;
}

function getContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac'
  };

  return mimeTypes[extension || ''] || 'application/octet-stream';
}
