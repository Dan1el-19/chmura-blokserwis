"use client";
import React from 'react';
import { useUpload } from '@/context/UploadContext';

export default function UploadQueueBadge() {
	const { queueStats, pauseAll, resumeAll, cancelAll } = useUpload();

	const formatTime = (seconds: number) => {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
		return `${Math.round(seconds / 3600)}h`;
	};

	if (queueStats.totalInQueue === 0 && queueStats.activeUploads === 0) {
		return null;
	}

	return (
		<div className="w-full bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
			<div className="flex justify-between items-center mb-2">
				<h3 className="text-sm font-medium text-blue-900">Status uploadów</h3>
				<div className="flex gap-2">
					<button
						onClick={pauseAll}
						className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
					>
						Wstrzymaj wszystkie
					</button>
					<button
						onClick={resumeAll}
						className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
					>
						Wznów wszystkie
					</button>
					<button
						onClick={cancelAll}
						className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
					>
						Anuluj wszystkie
					</button>
				</div>
			</div>
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
				<div className="text-center">
					<div className="text-blue-900 font-medium">{queueStats.activeUploads || 0}</div>
					<div className="text-blue-600">Aktywne</div>
				</div>
				<div className="text-center">
					<div className="text-blue-900 font-medium">{queueStats.totalInQueue || 0}</div>
					<div className="text-blue-600">W kolejce</div>
				</div>
				<div className="text-center">
					<div className="text-blue-900 font-medium">{formatTime(queueStats.averageWaitTime || 0)}</div>
					<div className="text-blue-600">Średni czas oczekiwania</div>
				</div>
				<div className="text-center">
					<div className="text-blue-900 font-medium">{(queueStats.estimatedThroughput || 0).toFixed(1)}</div>
					<div className="text-blue-600">MB/s</div>
				</div>
			</div>
		</div>
	);
}
