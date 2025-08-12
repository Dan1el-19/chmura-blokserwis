import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { listFiles } from '@/lib/storage';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Brak tokenu autoryzacji' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyToken(token);
    
    if (!decodedToken) {
      return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    }

    const db = getFirestore();
    const userDocRef = db.doc(`users/${decodedToken.uid}`);
    const userSnap = await userDocRef.get();
    
    let userRole = 'basic';
    let storageLimit = 5 * 1024 * 1024 * 1024; // 5GB default
    
    if (userSnap.exists) {
      const data = userSnap.data();
      if (data?.role) userRole = data.role;
      if (typeof data?.storageLimit === 'number') storageLimit = data.storageLimit;
    }

    // Calculate personal folder storage
    let personalStorageUsed = 0;
    try {
      const personalPrefix = `users/${decodedToken.uid}/`;
      const personalObjects = await listFiles(personalPrefix);
      personalStorageUsed = personalObjects.reduce((total, obj) => total + (obj.Size || 0), 0);
    } catch (error) {
      console.error('Error calculating personal storage:', error);
    }

    // Calculate main folder storage (only if user has access)
    let mainStorageUsed = 0;
    let mainStorageLimit = 0;
    
    if (userRole === 'admin' || userRole === 'plus') {
      try {
        const mainPrefix = 'main/';
        const mainObjects = await listFiles(mainPrefix);
        mainStorageUsed = mainObjects.reduce((total, obj) => total + (obj.Size || 0), 0);
        
        // Main folder typically has higher limits for admin/plus users
        mainStorageLimit = userRole === 'admin' ? 50 * 1024 * 1024 * 1024 : 20 * 1024 * 1024 * 1024; // 50GB for admin, 20GB for plus
      } catch (error) {
        console.error('Error calculating main storage:', error);
      }
    }

    const stats = {
      personal: {
        used: personalStorageUsed,
        limit: storageLimit,
        percentage: (personalStorageUsed / storageLimit) * 100
      },
      main: {
        used: mainStorageUsed,
        limit: mainStorageLimit,
        percentage: mainStorageLimit > 0 ? (mainStorageUsed / mainStorageLimit) * 100 : 0
      },
      total: {
        used: personalStorageUsed + mainStorageUsed,
        limit: storageLimit + mainStorageLimit,
        percentage: ((personalStorageUsed + mainStorageUsed) / (storageLimit + mainStorageLimit)) * 100
      }
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error in storage stats API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
