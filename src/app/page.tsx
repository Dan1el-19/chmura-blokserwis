import Link from 'next/link';
import { 
  Cloud, 
  Upload, 
  Download, 
  FileText, 
  HardDrive, 
  Users, 
  Activity,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Witaj w Chmurze Blokserwis
          </h2>
          <p className="text-gray-600">
            Bezpieczna platforma do zarządzania plikami dla Twojej firmy
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pliki</p>
                  <p className="text-2xl font-bold text-gray-900">1,234</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <HardDrive className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Przestrzeń</p>
                  <p className="text-2xl font-bold text-gray-900">2.4 GB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Użytkownicy</p>
                  <p className="text-2xl font-bold text-gray-900">12</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Activity className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Aktywność</p>
                  <p className="text-2xl font-bold text-gray-900">89</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Szybkie akcje</h3>
              <div className="space-y-3">
                <Link 
                  href="/storage" 
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center">
                    <Upload className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="font-medium text-gray-900">Prześlij pliki</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
                
                <Link 
                  href="/storage" 
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
                >
                  <div className="flex items-center">
                    <Download className="h-5 w-5 text-green-600 mr-3" />
                    <span className="font-medium text-gray-900">Pobierz pliki</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
                
                <Link 
                  href="/admin-panel" 
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-purple-600 mr-3" />
                    <span className="font-medium text-gray-900">Panel admin</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ostatnie pliki</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-600 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">dokument.pdf</p>
                      <p className="text-sm text-gray-500">2.3 MB • 2 godziny temu</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-600 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">zdjecie.jpg</p>
                      <p className="text-sm text-gray-500">1.8 MB • 5 godzin temu</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-600 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">prezentacja.pptx</p>
                      <p className="text-sm text-gray-500">4.1 MB • 1 dzień temu</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status systemu</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">Cloudflare R2 - Online</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">Firebase Auth - Online</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">API - Online</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>&copy; 2024 Chmura Blokserwis. Wszystkie prawa zastrzeżone.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
