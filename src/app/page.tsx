// Strona główna: warunkowe przekierowanie zależnie od stanu logowania Firebase
'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function RootRedirectDecider() {
  const router = useRouter();
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    // Subskrybujemy stan auth i natychmiast przekierowujemy
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/storage');
      } else {
        router.replace('/login');
      }
      setDecided(true);
    });
    return () => unsub();
  }, [router]);

  // Proste, lekkie UI (nie migamy starą stroną informacyjną)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-4" />
        <p className="text-sm text-gray-600">
          {decided ? 'Przekierowywanie...' : 'Sprawdzanie stanu logowania...'}
        </p>
      </div>
    </div>
  );
}
