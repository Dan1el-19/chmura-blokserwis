import { uploadSessionDB, UploadSession } from './indexedDB';

export interface ExportedSession {
	version: string;
	exportedAt: string;
	sessions: UploadSession[];
	metadata: {
		totalSessions: number;
		totalSize: number;
		description?: string;
	};
}

export class SessionExportManager {
	private static readonly VERSION = '1.0.0';

	/**
	 * Eksportuje wszystkie sesje uploadu do pliku JSON
	 */
	public static async exportSessions(description?: string): Promise<ExportedSession> {
		try {
			const sessions = await uploadSessionDB.getAllSessions();
			
			const totalSize = sessions.reduce((sum, session) => sum + session.size, 0);
			
			const exportData: ExportedSession = {
				version: this.VERSION,
				exportedAt: new Date().toISOString(),
				sessions,
				metadata: {
					totalSessions: sessions.length,
					totalSize,
					description
				}
			};

			return exportData;
		} catch (error) {
			console.error('Błąd podczas eksportu sesji:', error);
			throw new Error('Nie udało się wyeksportować sesji');
		}
	}

	/**
	 * Eksportuje sesje do pliku i pobiera go
	 */
	public static async downloadSessions(description?: string): Promise<void> {
		try {
			const exportData = await this.exportSessions(description);
			
			const blob = new Blob([JSON.stringify(exportData, null, 2)], {
				type: 'application/json'
			});
			
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `upload-sessions-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Błąd podczas pobierania sesji:', error);
			throw new Error('Nie udało się pobrać sesji');
		}
	}

	/**
	 * Importuje sesje z pliku JSON
	 */
	public static async importSessions(file: File): Promise<{ imported: number; errors: number }> {
		try {
			const text = await file.text();
			const importData: ExportedSession = JSON.parse(text);

			// Sprawdź wersję
			if (importData.version !== this.VERSION) {
				console.warn(`Wersja pliku (${importData.version}) różni się od obsługiwanej (${this.VERSION})`);
			}

			// Sprawdź strukturę
			if (!importData.sessions || !Array.isArray(importData.sessions)) {
				throw new Error('Nieprawidłowy format pliku - brak sesji');
			}

			let imported = 0;
			let errors = 0;

			for (const session of importData.sessions) {
				try {
					// Sprawdź czy sesja już istnieje
					const existing = await uploadSessionDB.getSession(session.id);
					if (existing) {
						console.warn(`Sesja ${session.id} już istnieje, pomijam`);
						continue;
					}

					// Zapisz sesję
					await uploadSessionDB.saveSession(session);
					imported++;
				} catch (error) {
					console.error(`Błąd podczas importu sesji ${session.id}:`, error);
					errors++;
				}
			}

			return { imported, errors };
		} catch (error) {
			console.error('Błąd podczas importu sesji:', error);
			throw new Error('Nie udało się zaimportować sesji');
		}
	}

	/**
	 * Sprawdza czy plik jest prawidłowym plikiem eksportu sesji
	 */
	public static async validateImportFile(file: File): Promise<{ valid: boolean; error?: string }> {
		try {
			const text = await file.text();
			const importData = JSON.parse(text);

			if (!importData.version || !importData.sessions || !Array.isArray(importData.sessions)) {
				return { valid: false, error: 'Nieprawidłowy format pliku' };
			}

			if (importData.sessions.length === 0) {
				return { valid: false, error: 'Plik nie zawiera żadnych sesji' };
			}

			// Sprawdź strukturę pierwszej sesji
			const firstSession = importData.sessions[0];
			if (!firstSession.id || !firstSession.fileName || !firstSession.uploadId) {
				return { valid: false, error: 'Nieprawidłowa struktura sesji' };
			}

			return { valid: true };
		} catch (error) {
			return { valid: false, error: 'Nieprawidłowy plik JSON' };
		}
	}

	/**
	 * Pobiera statystyki sesji
	 */
	public static async getSessionStats(): Promise<{
		totalSessions: number;
		totalSize: number;
		oldestSession: Date | null;
		newestSession: Date | null;
	}> {
		try {
			const sessions = await uploadSessionDB.getAllSessions();
			
			if (sessions.length === 0) {
				return {
					totalSessions: 0,
					totalSize: 0,
					oldestSession: null,
					newestSession: null
				};
			}

			const totalSize = sessions.reduce((sum, session) => sum + session.size, 0);
			const dates = sessions.map(s => new Date(s.createdAt)).sort((a, b) => a.getTime() - b.getTime());

			return {
				totalSessions: sessions.length,
				totalSize,
				oldestSession: dates[0],
				newestSession: dates[dates.length - 1]
			};
		} catch {
			throw new Error('Nie udało się pobrać statystyk sesji');
		}
	}
}
