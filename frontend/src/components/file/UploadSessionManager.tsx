"use client";
import React, { useState, useRef } from 'react';
import { Download, Upload, Trash2, Settings } from 'lucide-react';
import { useUpload } from '@/context/UploadContext';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

export default function UploadSessionManager() {
	const { exportSessions, importSessions, cleanupOldSessions } = useUpload();
	const [isExporting, setIsExporting] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [isCleaning, setIsCleaning] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleExport = async () => {
		setIsExporting(true);
		try {
			const exportData = await exportSessions();
			
			// Utwórz plik do pobrania
			const blob = new Blob([exportData], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `upload-sessions-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			
			toast.success('Sesje uploadu zostały wyeksportowane');
		} catch (error) {
			console.error('Błąd eksportu:', error);
			toast.error('Nie udało się wyeksportować sesji');
		} finally {
			setIsExporting(false);
		}
	};

	const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		setIsImporting(true);
		try {
			const text = await file.text();
			const result = await importSessions(text);
			
			if (result.imported > 0) {
				toast.success(`Zaimportowano ${result.imported} sesji`);
			}
			
			if (result.errors.length > 0) {
				console.warn('Błędy importu:', result.errors);
				toast.error(`Import zakończony z błędami: ${result.errors.length} błędów`);
			}
		} catch (error) {
			console.error('Błąd importu:', error);
			toast.error('Nie udało się zaimportować sesji');
		} finally {
			setIsImporting(false);
			// Reset input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	const handleCleanup = async () => {
		setIsCleaning(true);
		try {
			const cleaned = await cleanupOldSessions(24); // 24 godziny
			if (cleaned > 0) {
				toast.success(`Usunięto ${cleaned} starych sesji`);
			} else {
				toast.success('Brak starych sesji do usunięcia');
			}
		} catch (error) {
			console.error('Błąd czyszczenia:', error);
			toast.error('Nie udało się wyczyścić starych sesji');
		} finally {
			setIsCleaning(false);
		}
	};

	return (
		<div className="bg-white border border-gray-200 rounded-lg p-4">
			<div className="flex items-center gap-2 mb-4">
				<Settings className="h-5 w-5 text-gray-600" />
				<h3 className="text-lg font-medium text-gray-900">Zarządzanie sesjami uploadu</h3>
			</div>
			
			<div className="space-y-3">
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleExport}
						disabled={isExporting}
						className="flex-1"
					>
						<Download className="h-4 w-4 mr-2" />
						{isExporting ? 'Eksportowanie...' : 'Eksportuj sesje'}
					</Button>
					
					<Button
						variant="outline"
						size="sm"
						onClick={() => fileInputRef.current?.click()}
						disabled={isImporting}
						className="flex-1"
					>
						<Upload className="h-4 w-4 mr-2" />
						{isImporting ? 'Importowanie...' : 'Importuj sesje'}
					</Button>
				</div>
				
				<Button
					variant="outline"
					size="sm"
					onClick={handleCleanup}
					disabled={isCleaning}
					className="w-full"
				>
					<Trash2 className="h-4 w-4 mr-2" />
					{isCleaning ? 'Czyszczenie...' : 'Wyczyść stare sesje (>24h)'}
				</Button>
			</div>
			
			{/* Ukryty input dla importu */}
			<input
				ref={fileInputRef}
				type="file"
				accept=".json"
				onChange={handleImport}
				className="hidden"
			/>
			
			<div className="mt-4 text-xs text-gray-500">
				<p>• <strong>Eksport:</strong> Zapisz sesje uploadu do pliku JSON</p>
				<p>• <strong>Import:</strong> Przywróć sesje z wcześniejszego eksportu</p>
				<p>• <strong>Czyszczenie:</strong> Usuń sesje starsze niż 24 godziny</p>
			</div>
		</div>
	);
}

