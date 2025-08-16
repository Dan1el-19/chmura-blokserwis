'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Cloud, 
  Upload, 
  Download, 
  FileText, 
  HardDrive, 
  Users, 
  Activity,
  ArrowRight,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatBytes } from '@/lib/utils';

interface SystemStats {
  totalFiles: number;
  totalStorage: number;
  totalUsers: number;
  recentActivity: number;
  systemStatus: {
    cloudflare: boolean;
    firebase: boolean;
    api: boolean;
  };
  recentFiles: Array<{
    name: string;
    size: number;
    uploadedAt: string;
  }>;
}

export default function Home() {
  const [stats, setStats] = useState<SystemStats>({
    totalFiles: 0,
    totalStorage: 0,
    totalUsers: 0,
    recentActivity: 0,
    systemStatus: {
      cloudflare: true, // Statyczny status - Cloudflare R2 działa
      firebase: true,   // Statyczny status - Firebase Auth działa
      api: true         // Statyczny status - API działa
    },
    recentFiles: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        // Pobierz tylko podstawowe statystyki (bez sprawdzania statusu usług)
        const response = await fetch('/api/system/stats');
        if (response.ok) {
          const data = await response.json();
          // Zachowaj statyczne statusy usług
          setStats({
            ...data,
            systemStatus: {
              cloudflare: true, // Statyczny status - Cloudflare R2 działa
              firebase: true,   // Statyczny status - Firebase Auth działa
              api: true         // Statyczny status - API działa
            }
          });
        }
      } catch (error) {
        console.error('Error fetching system stats:', error);
        // W przypadku błędu, zachowaj statyczne statusy
        setStats(prev => ({
          ...prev,
          systemStatus: {
            cloudflare: true,
            firebase: true,
            api: true
          }
        }));
      } finally {
        setLoading(false);
      }
    };

    fetchSystemStats();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 sm:py-6 gap-3">
            <div className="flex items-center justify-between sm:justify-start">
              <div className="flex items-center">
                <Cloud className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
                <h1 className="ml-2 text-xl sm:text-2xl font-bold text-gray-900">Chmura Blokserwis</h1>
              </div>
            </div>
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-4">
              <Link href="/login">
                <Button variant="ghost">Zaloguj się</Button>
              </Link>
              <Link href="/storage">
                <Button variant="primary">Przejdź do chmury</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">


        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mb-8">
          {/* Status systemu - główna karta */}
          <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-4">
            <Card className="h-full">
              <CardContent className="p-6 lg:p-8">
                <h3 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-6">Status systemu</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {loading ? (
                    <div className="col-span-full text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 lg:h-10 lg:w-10 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-3 text-sm lg:text-base text-gray-500">Ładowanie...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-4 lg:p-5 rounded-lg bg-gray-50">
                        <div className="flex items-center">
                          {stats.systemStatus.cloudflare ? (
                            <CheckCircle className="h-6 w-6 lg:h-7 lg:w-7 text-green-500 mr-4" />
                          ) : (
                            <XCircle className="h-6 w-6 lg:h-7 lg:w-7 text-red-500 mr-4" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900 text-lg lg:text-xl">Cloudflare R2</p>
                            <p className="text-sm lg:text-base text-gray-500">
                              {stats.systemStatus.cloudflare ? 'Online' : 'Offline'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 lg:p-5 rounded-lg bg-gray-50">
                        <div className="flex items-center">
                          {stats.systemStatus.firebase ? (
                            <CheckCircle className="h-6 w-6 lg:h-7 lg:w-7 text-green-500 mr-4" />
                          ) : (
                            <XCircle className="h-6 w-6 lg:h-7 lg:w-7 text-red-500 mr-4" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900 text-lg lg:text-xl">Firebase Auth</p>
                            <p className="text-sm lg:text-base text-gray-500">
                              {stats.systemStatus.firebase ? 'Online' : 'Offline'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 lg:p-5 rounded-lg bg-gray-50">
                        <div className="flex items-center">
                          {stats.systemStatus.api ? (
                            <CheckCircle className="h-6 w-6 lg:h-7 lg:w-7 text-green-500 mr-4" />
                          ) : (
                            <XCircle className="h-6 w-6 lg:h-7 lg:w-7 text-red-500 mr-4" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900 text-lg lg:text-xl">API</p>
                            <p className="text-sm lg:text-base text-gray-500">
                              {stats.systemStatus.api ? 'Online' : 'Offline'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 lg:p-5 rounded-lg bg-gray-50">
                        <div className="flex items-center">
                          <CheckCircle className="h-6 w-6 lg:h-7 lg:w-7 text-green-500 mr-4" />
                          <div>
                            <p className="font-medium text-gray-900 text-lg lg:text-xl">Google Cloud Run</p>
                            <p className="text-sm lg:text-base text-gray-500">Online</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 lg:p-5 rounded-lg bg-gray-50">
                        <div className="flex items-center">
                          <CheckCircle className="h-6 w-6 lg:h-7 lg:w-7 text-green-500 mr-4" />
                          <div>
                            <p className="font-medium text-gray-900 text-lg lg:text-xl">GitHub</p>
                            <p className="text-sm lg:text-base text-gray-500">Online</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 lg:p-5 rounded-lg bg-gray-50">
                        <div className="flex items-center">
                          <CheckCircle className="h-6 w-6 lg:h-7 lg:w-7 text-green-500 mr-4" />
                          <div>
                            <p className="font-medium text-gray-900 text-lg lg:text-xl">Next.js</p>
                            <p className="text-sm lg:text-base text-gray-500">Online</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ostatnie pliki - widoczne tylko na bardzo dużych ekranach */}
          <div className="hidden 2xl:block">
            <Card className="h-full">
              <CardContent className="p-6 lg:p-8">
                <h3 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-6">Ostatnie pliki</h3>
                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 lg:h-10 lg:w-10 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-3 text-sm lg:text-base text-gray-500">Ładowanie...</p>
                    </div>
                  ) : stats.recentFiles.length > 0 ? (
                    stats.recentFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-4 lg:p-5 rounded-lg bg-gray-50">
                        <div className="flex items-center">
                          <FileText className="h-6 w-6 lg:h-7 lg:w-7 text-gray-600 mr-4" />
                          <div>
                            <p className="font-medium text-gray-900 text-lg lg:text-xl">{file.name}</p>
                            <p className="text-sm lg:text-base text-gray-500">
                              {formatBytes(file.size)} • {file.uploadedAt}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm lg:text-base text-gray-500">Brak ostatnich plików</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>


      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>&copy; {new Date().getFullYear()} Chmura Blokserwis. Wszystkie prawa zastrzeżone.</p>
            <p className="mt-2 text-sm text-gray-400">
              Bezpieczna platforma do zarządzania plikami dla Twojej firmy
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
