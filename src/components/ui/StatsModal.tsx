import React, { useState, useEffect, useCallback } from 'react';
import { X, BarChart3, Users, MousePointer, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

interface LinkStats {
  linkId: string;
  linkName: string;
  totalClicks: number;
  uniqueVisitors: number;
  lastAccessed: Date | null;
  createdAt: Date | null;
}

interface RecentActivity {
  id: string;
  linkId: string;
  linkName: string;
  fileName: string;
  accessedAt: Date;
  userAgent: string;
  ipAddress: string;
}

interface Stats {
  totalClicks: number;
  uniqueVisitors: number;
  recentActivity: RecentActivity[];
  linkStats: LinkStats[];
}

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileKey: string;
  fileName: string;
}

export default function StatsModal({
  isOpen,
  onClose,
  fileKey,
  fileName
}: StatsModalProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const user = await import('@/lib/firebase').then(m => m.auth.currentUser);
      if (!user) {
        setError('Brak autoryzacji');
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch(`/api/files/stats?fileKey=${encodeURIComponent(fileKey)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Błąd podczas ładowania statystyk');
        return;
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Błąd podczas ładowania statystyk');
    } finally {
      setLoading(false);
    }
  }, [fileKey]);

  useEffect(() => {
    if (isOpen && fileKey) {
      fetchStats();
    }
  }, [isOpen, fileKey, fetchStats]);

  const getDeviceInfo = (userAgent: string) => {
    if (userAgent.includes('Mobile')) return '📱 Mobile';
    if (userAgent.includes('Tablet')) return '📱 Tablet';
    if (userAgent.includes('Windows')) return '💻 Windows';
    if (userAgent.includes('Mac')) return '💻 Mac';
    if (userAgent.includes('Linux')) return '💻 Linux';
    return '🖥️ Desktop';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Statystyki użycia linków</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="mb-4">
            <p className="text-sm text-gray-600">Plik: <span className="font-medium text-gray-900">{fileName}</span></p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center p-4">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" onClick={fetchStats} className="mt-2">
                Spróbuj ponownie
              </Button>
            </div>
          ) : !stats ? (
            <div className="text-center p-8">
              <p className="text-gray-600">Brak danych statystycznych</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Podsumowanie */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <MousePointer className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Łączne kliknięcia</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalClicks}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Users className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Unikalni odwiedzający</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.uniqueVisitors}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <BarChart3 className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Aktywne linki</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.linkStats.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Statystyki per link */}
              {stats.linkStats.length > 0 && (
                <Card>
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-gray-900">Statystyki per link</h4>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 text-sm font-medium text-gray-900">Nazwa linku</th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-gray-900">Kliknięcia</th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-gray-900">Unikalni</th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-gray-900">Ostatni dostęp</th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-gray-900">Utworzony</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.linkStats.map((linkStat) => (
                            <tr key={linkStat.linkId} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-3 text-sm text-gray-900">{linkStat.linkName}</td>
                              <td className="py-3 px-3 text-sm text-center text-gray-900">{linkStat.totalClicks}</td>
                              <td className="py-3 px-3 text-sm text-center text-gray-900">{linkStat.uniqueVisitors}</td>
                              <td className="py-3 px-3 text-sm text-center text-gray-600">
                                {linkStat.lastAccessed ? formatDate(linkStat.lastAccessed) : 'Brak'}
                              </td>
                              <td className="py-3 px-3 text-sm text-center text-gray-600">
                                {linkStat.createdAt ? formatDate(linkStat.createdAt) : 'Brak'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ostatnia aktywność */}
              {stats.recentActivity.length > 0 && (
                <Card>
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-gray-900">Ostatnia aktywność</h4>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Clock className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Link: {activity.linkName}
                              </p>
                              <p className="text-xs text-gray-600">
                                {formatDate(activity.accessedAt)} • {getDeviceInfo(activity.userAgent)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">IP: {activity.ipAddress}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {stats.totalClicks === 0 && (
                <div className="text-center p-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Brak aktywności dla tego pliku</p>
                  <p className="text-sm text-gray-500 mt-2">Statystyki pojawią się po pierwszym użyciu linku</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
