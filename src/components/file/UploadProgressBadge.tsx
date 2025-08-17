"use client";
import React from 'react';
import { UploadTaskState } from '@/lib/resumableUpload';
import { useUpload } from '@/context/UploadContext';

export default function UploadProgressBadge({ task }: { task: UploadTaskState }) {
	const percent = Math.round((task.uploadedBytes / task.size) * 100);
	const { pause, resume, cancel, remove } = useUpload();

	const getStatusColor = () => {
		switch (task.status) {
			case 'uploading': return 'bg-blue-600';
			case 'paused': return 'bg-yellow-600';
			case 'error': return 'bg-red-600';
			case 'completed': return 'bg-green-600';
			default: return 'bg-gray-600';
		}
	};

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
			<div className="flex justify-between mb-1">
				<span className="font-medium text-gray-700">{task.fileName}</span>
				<span className="text-gray-600">{percent}%</span>
			</div>
			<div className="w-full bg-gray-200 h-2 rounded">
				<div className={`h-2 rounded ${getStatusColor()}`} style={{ width: `${percent}%` }} />
			</div>
			<div className="flex justify-between items-center mt-1 text-gray-600">
				<span>{task.speedMbps.toFixed(2)} Mb/s</span>
				<div className="flex items-center gap-2">
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
		</div>
	);
}
