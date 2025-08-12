"use client";
import React from 'react';
import { UnifiedUploadState } from '@/types/upload';
import SmoothProgressBar from '@/components/ui/SmoothProgressBar';

interface UploadItemProps {
	upload: UnifiedUploadState;
	onPause?: (id: string) => void;
	onResume?: (id: string) => void;
	onCancel?: (id: string) => void;
	onRemove?: (id: string) => void;
}

export default function UploadItem({ 
	upload, 
	onPause, 
	onResume, 
	onCancel, 
	onRemove 
}: UploadItemProps) {
	const percent = Math.min(100, Math.max(0, upload.progress));

	const getStatusText = () => {
		switch (upload.status) {
			case 'uploading': return 'Wysyłanie...';
			case 'paused': return 'Wstrzymane';
			case 'error': return 'Błąd';
			case 'completed': return 'Zakończone';
			case 'canceled': return 'Anulowane';
			case 'queued': return `W kolejce (${upload.queuePosition || 0})`;
			case 'success': return 'Zakończone';
			case 'restored': return 'Przywrócone';
			default: return 'W kolejce';
		}
	};

	const formatWaitTime = (seconds: number) => {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
		return `${Math.round(seconds / 3600)}h`;
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	return (
		<div className="w-full bg-gray-100 rounded-md p-2 text-xs">
			<div className="mb-1">
				<span className="font-medium text-gray-700">{upload.fileName}</span>
				<span className="ml-2 text-gray-500">({formatFileSize(upload.fileSize)})</span>
			</div>
			
			<SmoothProgressBar 
				progress={percent}
				className="mb-2"
			/>
			
			<div className="flex justify-between items-center mt-1 text-gray-600">
				<span>
					{upload.speed > 0 ? `${upload.speed.toFixed(2)} MB/s` : '—'}
				</span>
				<div className="flex items-center gap-2">
					{upload.status === 'uploading' && upload.etaSec !== null && (
						<span>~{formatWaitTime(upload.etaSec)}</span>
					)}
					{upload.status === 'queued' && upload.estimatedWaitTime && (
						<span>~{formatWaitTime(upload.estimatedWaitTime)}</span>
					)}
					{upload.status === 'uploading' && onPause && (
						<button 
							onClick={() => onPause(upload.id)} 
							className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
						>
							Pauza
						</button>
					)}
					{upload.status === 'paused' && onResume && (
						<button 
							onClick={() => onResume(upload.id)} 
							className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
						>
							Wznów
						</button>
					)}

					{(upload.status === 'uploading' || upload.status === 'queued' || upload.status === 'paused') && onCancel && (
						<button 
							onClick={() => onCancel(upload.id)} 
							className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
						>
							Anuluj
						</button>
					)}
					{upload.status === 'error' && onRemove && (
						<button 
							onClick={() => onRemove(upload.id)} 
							className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
						>
							Usuń
						</button>
					)}
				</div>
			</div>

			{upload.errorMessage && (
				<div className="mt-1 text-red-600 text-xs">
					{upload.errorMessage}
				</div>
			)}
			<div className="mt-1 text-gray-500 text-xs">
				{getStatusText()}
			</div>
			{upload.status === 'queued' && upload.queuePosition && upload.queuePosition > 1 && (
				<div className="mt-1 text-blue-600 text-xs">
					Pozycja w kolejce: {upload.queuePosition}
				</div>
			)}
		</div>
	);
}
