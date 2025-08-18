"use client";
import React, { useEffect, useRef, useState } from 'react';
import { UploadTaskState } from '@/lib/resumableUpload';
import { useUpload } from '@/context/UploadContext';
import SmoothProgressBar from '@/components/ui/SmoothProgressBar';
import { uploadSessionDB } from '@/lib/indexedDB';
import toast from 'react-hot-toast';

export default function UploadProgressBadge({ task }: { task: UploadTaskState }) {
	// Użyj płynnego progress jeśli dostępny, w przeciwnym razie oblicz standardowy
	const percent = (task.smoothProgress !== undefined && !Number.isNaN(task.smoothProgress)) ? task.smoothProgress : (task.size ? (task.uploadedBytes / task.size) * 100 : 0);
	const { pause, resume, cancel, remove, enqueue } = useUpload();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [resuming, setResuming] = useState(false);
	const [hasHandle, setHasHandle] = useState<boolean>(true);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				if (task.fileFingerprint) {
					const handle = await uploadSessionDB.getFileHandle(task.fileFingerprint);
					if (mounted) setHasHandle(!!handle);
				}
			} catch {
				if (mounted) setHasHandle(true);
			}
		})();
		return () => { mounted = false; };
	}, [task.fileFingerprint]);

	const getStatusText = () => {
		switch (task.status) {
			case 'uploading': return 'Wysyłanie...';
			case 'paused': return 'Wstrzymane';
			case 'error': return 'Błąd';
			case 'completed': return 'Zakończone';
			case 'canceled': return 'Anulowane';
			case 'queued': return `W kolejce (${task.queuePosition || 0})`;
			default: return 'W kolejce';
		}
	};

	const getNetworkQualityColor = () => {
		switch (task.networkQuality) {
			case 'slow': return 'text-red-600';
			case 'medium': return 'text-yellow-600';
			case 'fast': return 'text-green-600';
			default: return 'text-gray-600';
		}
	};

	const getNetworkQualityText = () => {
		switch (task.networkQuality) {
			case 'slow': return 'Wolna sieć';
			case 'medium': return 'Średnia sieć';
			case 'fast': return 'Szybka sieć';
			default: return '';
		}
	};

	const formatWaitTime = (seconds: number) => {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
		return `${Math.round(seconds / 3600)}h`;
	};

	return (
		<div className="w-full bg-gray-100 rounded-md p-2 text-xs">
			<div className="mb-1">
				<span className="font-medium text-gray-700">{task.fileName}</span>
			</div>
			
			{/* Użyj Material-UI progress bar dla lepszej stabilności */}
			<SmoothProgressBar 
				progress={percent}
				className="mb-2"
			/>
			
			<div className="flex justify-between items-center mt-1 text-gray-600">
				<span>
					{typeof task.speedMbps === 'number' && isFinite(task.speedMbps) && task.speedMbps > 0
						? `${(task.speedMbps / 8).toFixed(2)} MB/s`
						: '—'}
				</span>
				<div className="flex items-center gap-2">
					<div className="text-sm text-gray-700 mr-3">{Math.round(percent)}%</div>
					{task.status === 'uploading' && task.etaSec !== null && (
						<span>~{formatWaitTime(task.etaSec)}</span>
					)}
					{task.status === 'queued' && task.estimatedWaitTime && (
						<span>~{formatWaitTime(task.estimatedWaitTime)}</span>
					)}
					{task.status === 'uploading' && (
						<button onClick={() => pause(task.id)} className="px-2 py-1 bg-yellow-600 text-white rounded text-xs">
							Pauza
						</button>
					)}
					{task.status === 'paused' && (
						<button onClick={() => resume(task.id)} className="px-2 py-1 bg-green-600 text-white rounded text-xs">
							Wznów
						</button>
					)}
					{/* Zapisz uchwyt pliku dla auto-wznawiania (jeśli wspierane) */}
					{typeof window !== 'undefined' && 'showOpenFilePicker' in window && task.fileFingerprint && (task.status === 'uploading' || task.status === 'paused' || task.status === 'queued') && (
						<button
							onClick={async () => {
								try {
									// @ts-expect-error File System Access API
									const [handle] = await window.showOpenFilePicker({ multiple: false });
									await uploadSessionDB.saveFileHandle(task.fileFingerprint!, handle);
									toast.success('Uchwyt pliku zapisany. Wznowienia będą łatwiejsze.');
									setHasHandle(true);
								} catch {
									toast.error('Nie udało się zapisać uchwytu pliku');
								}
							}}
							className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
						>
							Zapisz uchwyt
						</button>
					)}
					{/* Jeśli plik nie jest dostępny po odświeżeniu, pozwól wybrać plik ponownie aby wznowić */}
					{!task.file && (
						<>
							<input ref={fileInputRef} type="file" className="hidden" onChange={async (e) => {
								const file = e.currentTarget.files?.[0];
								if (!file) return;
								setResuming(true);
								try {
									// Enqueue creates a resumed upload if fingerprint matches existing session
									await enqueue(file, task.folder);
									// Usuń starą, niepełną sesję z widoku
									remove(task.id);
								} finally {
									setResuming(false);
									// pozwól na ponowny wybór tego samego pliku później
									e.currentTarget.value = '';
								}
							}} />
							<button onClick={() => fileInputRef.current?.click()} disabled={resuming} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">
								{resuming ? 'Wznawianie...' : 'Wybierz plik'}
							</button>
						</>
					)}
					{(task.status === 'uploading' || task.status === 'queued' || task.status === 'paused') && (
						<button onClick={() => cancel(task.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">
							Anuluj
						</button>
					)}
					{task.status === 'error' && (
						<button onClick={() => remove(task.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">
							Usuń
						</button>
					)}
				</div>
			</div>
			{/* CTA: podpowiedź zapisu uchwytu jeśli dostępne i nie zapisane */}
			{typeof window !== 'undefined' && 'showOpenFilePicker' in window && task.fileFingerprint && !hasHandle && (task.status === 'uploading' || task.status === 'paused' || task.status === 'queued') && (
				<div className="mt-2 text-blue-700 text-xs">
					Wskazówka: zapisz uchwyt pliku (przycisk „Zapisz uchwyt”), aby łatwiej wznawiać upload po odświeżeniu.
				</div>
			)}
			{task.errorMessage && (
				<div className="mt-1 text-red-600 text-xs">
					{task.errorMessage}
				</div>
			)}
			<div className="mt-1 text-gray-500 text-xs">
				{getStatusText()}
			</div>
			{task.status === 'queued' && task.queuePosition && task.queuePosition > 1 && (
				<div className="mt-1 text-blue-600 text-xs">
					Pozycja w kolejce: {task.queuePosition}
				</div>
			)}
			{/* Nowe informacje o adaptacyjnej równoległości */}
			{task.status === 'uploading' && task.adaptiveConcurrency && (
				<div className="mt-1 text-blue-600 text-xs">
					Równoległość: {task.adaptiveConcurrency} części
				</div>
			)}
			{task.status === 'uploading' && task.networkQuality && (
				<div className={`mt-1 text-xs ${getNetworkQualityColor()}`}>
					{getNetworkQualityText()}
				</div>
			)}
			{/* Informacje o dynamicznym algorytmie */}
			{task.status === 'uploading' && task.partStrategy && (
				<div className="mt-1 text-purple-600 text-xs">
					{task.partsDone}/{task.partStrategy.targetParts} części ({task.partStrategy.confidence.toFixed(1)}% pewności)
				</div>
			)}
		</div>
	);
}
