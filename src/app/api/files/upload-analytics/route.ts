import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
	try {
		const authHeader = request.headers.get('authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return NextResponse.json({ error: 'Brak tokenu autoryzacji' }, { status: 401 });
		}
		
		const token = authHeader.split('Bearer ')[1];
		const decodedToken = await verifyToken(token);
		if (!decodedToken) {
			return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d
		const userId = searchParams.get('userId') || decodedToken.uid; // Admin może sprawdzić innych użytkowników

		// Sprawdź czy użytkownik ma uprawnienia do sprawdzania innych użytkowników
		if (userId !== decodedToken.uid) {
			const db = getFirestore();
			const userDoc = await db.doc(`users/${decodedToken.uid}`).get();
			const userData = userDoc.exists ? userDoc.data() : {};
			if (userData?.role !== 'admin') {
				return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
			}
		}

		const db = getFirestore();
		
		// Oblicz datę początkową na podstawie okresu
		const now = new Date();
		let startDate: Date;
		switch (period) {
			case '30d':
				startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
				break;
			case '90d':
				startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
				break;
			case '7d':
			default:
				startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				break;
		}

		// Pobierz logi uploadów
		const uploadLogsQuery = await db.collection('activityLogs')
			.where('userId', '==', userId)
			.where('action', 'in', ['upload', 'multipart_completed', 'queue_completed'])
			.where('timestamp', '>', startDate)
			.orderBy('timestamp', 'desc')
			.get();

		const uploadLogs = uploadLogsQuery.docs.map(doc => doc.data());

		// Pobierz logi kolejki
		const queueLogsQuery = await db.collection('activityLogs')
			.where('userId', '==', userId)
			.where('action', 'in', ['queue_added', 'queue_started', 'queue_completed', 'queue_canceled'])
			.where('timestamp', '>', startDate)
			.orderBy('timestamp', 'desc')
			.get();

		const queueLogs = queueLogsQuery.docs.map(doc => doc.data());

		// Oblicz statystyki
		const totalUploads = uploadLogs.length;
		const totalSize = uploadLogs.reduce((sum, log) => sum + (log.fileSize || 0), 0);
		const averageFileSize = totalUploads > 0 ? totalSize / totalUploads : 0;
		
		// Statystyki kolejki
		const queueStats = {
			added: queueLogs.filter(log => log.action === 'queue_added').length,
			started: queueLogs.filter(log => log.action === 'queue_started').length,
			completed: queueLogs.filter(log => log.action === 'queue_completed').length,
			canceled: queueLogs.filter(log => log.action === 'queue_canceled').length
		};

		// Średni czas w kolejce (przybliżony)
		const queueTimes: number[] = [];
		const startedLogs = queueLogs.filter(log => log.action === 'queue_started');
		const addedLogs = queueLogs.filter(log => log.action === 'queue_added');
		
		startedLogs.forEach(startedLog => {
			const addedLog = addedLogs.find(added => added.taskId === startedLog.taskId);
			if (addedLog && addedLog.timestamp && startedLog.timestamp) {
				const waitTime = startedLog.timestamp.toMillis() - addedLog.timestamp.toMillis();
				queueTimes.push(waitTime / 1000); // w sekundach
			}
		});

		const averageQueueTime = queueTimes.length > 0 
			? queueTimes.reduce((sum, time) => sum + time, 0) / queueTimes.length 
			: 0;

		// Statystyki dzienne
		const dailyStats: Record<string, { uploads: number; size: number }> = {};
		uploadLogs.forEach(log => {
			if (log.timestamp) {
				const date = log.timestamp.toDate().toISOString().split('T')[0];
				if (!dailyStats[date]) {
					dailyStats[date] = { uploads: 0, size: 0 };
				}
				dailyStats[date].uploads++;
				dailyStats[date].size += log.fileSize || 0;
			}
		});

		return NextResponse.json({
			period,
			userId,
			summary: {
				totalUploads,
				totalSize,
				averageFileSize,
				averageQueueTime
			},
			queueStats,
			dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
				date,
				...stats
			})).sort((a, b) => a.date.localeCompare(b.date))
		});
	} catch (error) {
		console.error('Błąd podczas pobierania analityki uploadów:', error);
		return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
	}
}
