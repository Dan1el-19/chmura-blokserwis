import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/apiSecurity';
import { listFiles } from '@/lib/storage';
import { FileItem } from '@/types';
import { getFirestore } from 'firebase-admin/firestore';
import { DecodedIdToken } from '@/lib/auth';

async function handleGetFiles(request: NextRequest, user?: DecodedIdToken) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder') || 'personal';
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Sprawdź uprawnienia do folderu
  if (folder === 'main') {
    const db = getFirestore();
    const userDocRef = db.doc(`users/${user.uid}`);
    const userSnap = await userDocRef.get();
    
    let userRole = 'basic';
    if (userSnap.exists) {
      const data = userSnap.data();
      if (data?.role) userRole = data.role;
    }
    
    if (userRole !== 'admin' && userRole !== 'plus') {
      return NextResponse.json({ error: 'Brak uprawnień do folderu głównego' }, { status: 403 });
    }
  }

  const prefix = folder === 'personal' ? `users/${user.uid}/` : 'main/';
  const objects = await listFiles(prefix);

  const files: FileItem[] = objects.map(obj => ({
    key: obj.Key!,
    name: obj.Key!.split('/').pop() || '',
    size: obj.Size || 0,
    lastModified: obj.LastModified || new Date(),
    contentType: 'application/octet-stream',
    owner: user.uid,
    path: obj.Key!
  }));

  // Log view action for admin insight
  try {
    const { FieldValue } = await import('firebase-admin/firestore');
    const db = getFirestore();
    await db.collection('activityLogs').add({
      userId: user.uid,
      userEmail: user.email || '',
      action: 'view',
      fileName: undefined,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch {}

  return NextResponse.json(files);
}

// Export the secured GET handler
export const GET = withSecurity(handleGetFiles);



