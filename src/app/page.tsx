import Link from 'next/link';
import { FileText, Shield, Users, Cloud } from 'lucide-react';

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
              <Link 
                href="/login" 
                className="text-gray-700 hover:text-gray-900 px-4 py-2 rounded-md text-sm font-medium border sm:border-0"
              >
                Zaloguj się
              </Link>
              <Link 
                href="/storage" 
                className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 text-center"
              >
                Przejdź do chmury
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
            Bezpieczne przechowywanie plików w chmurze
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 md:mb-8 max-w-3xl mx-auto px-2">
            Profesjonalna platforma do zarządzania plikami z zaawansowanym systemem uprawnień, 
            monitorowaniem wykorzystania przestrzeni i bezpiecznym udostępnianiem.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link 
              href="/login" 
              className="bg-blue-600 text-white px-6 md:px-8 py-3 rounded-lg text-base md:text-lg font-medium hover:bg-blue-700 transition-colors text-center"
            >
              Rozpocznij
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 md:mt-16 lg:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Bezpieczeństwo</h3>
            <p className="text-gray-600">
              Firebase Authentication, szyfrowanie danych i kontrola dostępu oparta na rolach.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Zarządzanie plikami</h3>
            <p className="text-gray-600">
              Upload, pobieranie, usuwanie i udostępnianie plików z pre-signed URL.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Role i uprawnienia</h3>
            <p className="text-gray-600">
              System ról: basic, plus i admin z różnymi poziomami dostępu.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <Cloud className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cloudflare R2</h3>
            <p className="text-gray-600">
              Szybkie i niezawodne przechowywanie w chmurze z globalnym CDN.
            </p>
          </div>
        </div>

        {/* Plans */}
        <div className="mt-16 lg:mt-20">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Dostępne plany
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="bg-white p-8 rounded-lg shadow-md border-2 border-gray-200">
              <h4 className="text-xl font-semibold text-gray-900 mb-4">Basic</h4>
              <ul className="space-y-3 text-gray-600">
                <li>• Własny folder z limitem 5GB</li>
                <li>• Upload, pobieranie, usuwanie plików</li>
                <li>• Monitorowanie wykorzystania przestrzeni</li>
                <li>• Bezpieczne logowanie</li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Popularny
                </span>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-4">Plus</h4>
              <ul className="space-y-3 text-gray-600">
                <li>• Wszystkie funkcje Basic</li>
                <li>• Dostęp do wspólnego folderu main</li>
                <li>• Pełne uprawnienia w folderze main</li>
                <li>• Zaawansowane udostępnianie</li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md border-2 border-gray-200">
              <h4 className="text-xl font-semibold text-gray-900 mb-4">Admin</h4>
              <ul className="space-y-3 text-gray-600">
                <li>• Panel administracyjny</li>
                <li>• Zarządzanie użytkownikami</li>
                <li>• Kontrola limitów przestrzeni</li>
                <li>• Logi aktywności</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>&copy; 2024 Chmura Blokserwis. Wszystkie prawa zastrzeżone.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
