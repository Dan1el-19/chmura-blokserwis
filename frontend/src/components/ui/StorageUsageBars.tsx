import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { formatBytes } from '@/lib/utils';
import { HardDrive } from 'lucide-react';

interface StorageStats {
  personal: {
    used: number;
    limit: number;
    percentage: number;
  };
  main: {
    used: number;
    limit: number;
    percentage: number;
  };
  total: {
    used: number;
    limit: number;
    percentage: number;
  };
}

interface StorageUsageBarsProps {
  onRefresh?: () => void;
}

export default function StorageUsageBars({ onRefresh }: StorageUsageBarsProps) {
  const [user] = useAuthState(auth);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStorageStats = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/files/storage-stats', {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });
      
      if (response.ok) {
        const stats = await response.json();
        setStorageStats(stats);
      }
    } catch (error) {
      console.error('Error fetching storage stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStorageStats();
  }, [fetchStorageStats]);

  useEffect(() => {
    if (onRefresh) {
      fetchStorageStats();
    }
  }, [onRefresh, fetchStorageStats]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!storageStats) {
    return null;
  }

  const getBarColor = (percentage: number) => {
    if (percentage > 90) return 'bg-red-500';
    if (percentage > 70) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="rounded-lg transition-all duration-200 glass-card bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-900">Zajętość folderów</h3>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        {/* Personal Folder Storage */}
        <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Mój folder</span>
          <span className="text-sm text-gray-500">
            {formatBytes(storageStats.personal.used)} / {formatBytes(storageStats.personal.limit)}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getBarColor(storageStats.personal.percentage)}`}
            style={{ width: `${Math.min(storageStats.personal.percentage, 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500">
          {storageStats.personal.percentage.toFixed(1)}% zajęte
        </div>
      </div>

      {/* Main Folder Storage - only show if user has access */}
      {storageStats.main.limit > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Folder główny</span>
            <span className="text-sm text-gray-500">
              {formatBytes(storageStats.main.used)} / {formatBytes(storageStats.main.limit)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getBarColor(storageStats.main.percentage)}`}
              style={{ width: `${Math.min(storageStats.main.percentage, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">
            {storageStats.main.percentage.toFixed(1)}% zajęte
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
