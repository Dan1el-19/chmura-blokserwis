import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

function initializeAdminApp(): void {
  // Unikamy ponownej inicjalizacji aplikacji, co powodowałoby błąd
  if (getApps().length > 0) {
    return;
  }

  // Odczytujemy zmienne środowiskowe. Będą one dostępne lokalnie dzięki bibliotece 'dotenv',
  // a na platformach hostingowych dzięki ich konfiguracji.
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Sprawdzamy, czy mamy komplet danych do ręcznego uwierzytelnienia
  if (projectId && clientEmail && privateKey) {
    console.log('Initializing Firebase Admin with explicit credentials.');
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        // Klucz prywatny w zmiennej środowiskowej wymaga zamiany znaków nowej linii
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // Jeśli brak zmiennych, zakładamy, że jesteśmy w środowisku Google Cloud
    console.log('Initializing Firebase Admin with default credentials.');
    initializeApp();
  }
}

// Inicjalizujemy aplikację od razu przy pierwszym imporcie tego modułu
initializeAdminApp();

export type DecodedIdToken = {
  uid: string;
  email?: string;
  role?: 'basic' | 'plus' | 'admin';
  [key: string]: unknown;
};

// --- Eksportowane funkcje ---

export async function verifyToken(token: string): Promise<DecodedIdToken | null> {
  try {
    // Nie ma już potrzeby wywoływania ensureAdminInitialized() tutaj.
    // Aplikacja jest już zainicjalizowana.
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken as unknown as DecodedIdToken;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export async function getUserRole(uid: string): Promise<'basic' | 'admin'> {
  try {
    // Przykładowa logika - można tu odpytać Firestore lub Custom Claims
    const user = await getAuth().getUser(uid);
    // Sprawdzamy, czy użytkownik ma niestandardową rolę 'admin'
    if (user.customClaims?.role === 'admin') {
      return 'admin';
    }
    return 'basic';
  } catch (error) {
    console.error(`Error getting user role for UID: ${uid}`, error);
    // Domyślnie zwracamy najniższe uprawnienia w razie błędu
    return 'basic';
  }
}