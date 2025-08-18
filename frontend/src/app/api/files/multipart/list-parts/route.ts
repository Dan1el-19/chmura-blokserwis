import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { listMultipartUploadParts } from '@/lib/storage';

export async function POST(request: NextRequest) {
	try {
		// Sprawdź autoryzację
		const authHeader = request.headers.get('authorization');
		if (!authHeader?.startsWith('Bearer ')) {
			return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
		}

		const token = authHeader.substring(7);
		const decodedToken = await verifyToken(token);
		if (!decodedToken) {
			return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
		}
		const userId = decodedToken.uid;

		// Parsuj dane z body
		const { key, uploadId } = await request.json();

		if (!key || !uploadId) {
			return NextResponse.json({ error: 'Brak wymaganych parametrów: key, uploadId' }, { status: 400 });
		}

		// Sprawdź czy użytkownik ma dostęp do tego pliku
		// (klucz powinien zawierać userId w nazwie)
		if (!key.includes(userId)) {
			return NextResponse.json({ error: 'Brak dostępu do tego uploadu' }, { status: 403 });
		}

		// Pobierz listę części z R2
		const parts = await listMultipartUploadParts(key, uploadId);

		// Loguj akcję
		console.log(`[${new Date().toISOString()}] User ${userId} listed parts for upload ${uploadId}, key: ${key}, parts count: ${parts.length}`);

		return NextResponse.json({ parts });
	} catch (error: unknown) {
		console.error('Błąd podczas listowania części multipart:', error);
		
		if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchUpload') {
			return NextResponse.json({ error: 'Upload nie istnieje lub został już zakończony' }, { status: 404 });
		}
		
		return NextResponse.json({ error: 'Błąd serwera podczas listowania części' }, { status: 500 });
	}
}
