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
		<div className="w-full bg-blue-50 border border-blue-200 rounded-md p-2 sm:p-3 mb-3 sm:mb-4">
			<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
				<h3 className="text-xs sm:text-sm font-medium text-blue-900">Status uploadów</h3>
				<div className="flex gap-1.5 sm:gap-2 flex-wrap">
					<button
						onClick={pauseAll}
						className="px-1.5 sm:px-2 py-1 bg-yellow-600 text-white rounded text-[10px] sm:text-xs hover:bg-yellow-700"
					>
						<span className="hidden sm:inline">Wstrzymaj wszystkie</span>
						<span className="sm:hidden">Wstrzymaj</span>
					</button>
					<button
						onClick={resumeAll}
						className="px-1.5 sm:px-2 py-1 bg-green-600 text-white rounded text-[10px] sm:text-xs hover:bg-green-700"
					>
						<span className="hidden sm:inline">Wznów wszystkie</span>
						<span className="sm:hidden">Wznów</span>
					</button>
					<button
						onClick={cancelAll}
						className="px-1.5 sm:px-2 py-1 bg-red-600 text-white rounded text-[10px] sm:text-xs hover:bg-red-700"
					>
						<span className="hidden sm:inline">Anuluj wszystkie</span>
						<span className="sm:hidden">Anuluj</span>
					</button>
				</div>
			</div>
			<div className="grid grid-cols-4 gap-1.5 sm:gap-4 text-[10px] sm:text-xs">
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
					<div className="text-blue-600 truncate">Śr. czas</div>
				</div>
				<div className="text-center">
					<div className="text-blue-900 font-medium">{(queueStats.estimatedThroughput || 0).toFixed(1)}</div>
					<div className="text-blue-600">MB/s</div>
				</div>
			</div>
		</div>
	);
}
