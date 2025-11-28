"use client";
import { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Cloud, 
  User, 
  LogOut, 
  Menu, 
  X, 
  Settings,
  Home
} from 'lucide-react';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

export default function Header() {
  const [user] = useAuthState(auth);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Wylogowano pomyślnie!');
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Błąd podczas wylogowywania');
    }
  };

  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-1.5 sm:space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
            onClick={closeMobileMenu}
          >
            <Cloud className="h-6 w-6 sm:h-8 sm:w-8" aria-hidden="true" />
            <span className="text-base sm:text-xl font-bold font-roboto">Chmura Blokserwis</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <Link 
                  href="/storage" 
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Moje pliki
                </Link>
                <Link 
                  href="/admin-panel" 
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Panel admina
                </Link>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">
                    {user.email}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    aria-label="Wyloguj się"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Wyloguj</span>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link href="/login">
                  <Button variant="outline" size="sm">
                    Zaloguj się
                  </Button>
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
                          <Button
                variant="ghost"
                size="sm"
                onClick={toggleMobileMenu}
                aria-label={showMobileMenu ? "Zamknij menu" : "Otwórz menu"}
                aria-expanded={showMobileMenu}
                aria-haspopup={true}
              >
              {showMobileMenu ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <div 
            className="md:hidden border-t border-gray-200 bg-white"
            role="navigation"
            aria-label="Menu mobilne"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {user ? (
                <>
                  <Link
                    href="/"
                    className="flex items-center px-3 py-3 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
                    onClick={closeMobileMenu}
                  >
                    <Home className="h-5 w-5 mr-3" aria-hidden="true" />
                    Strona główna
                  </Link>
                  <Link
                    href="/storage"
                    className="flex items-center px-3 py-3 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
                    onClick={closeMobileMenu}
                  >
                    <Cloud className="h-5 w-5 mr-3" aria-hidden="true" />
                    Moje pliki
                  </Link>
                  <Link
                    href="/admin-panel"
                    className="flex items-center px-3 py-3 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
                    onClick={closeMobileMenu}
                  >
                    <Settings className="h-5 w-5 mr-3" aria-hidden="true" />
                    Panel admina
                  </Link>
                  <div className="border-t border-gray-200 pt-4 pb-3">
                    <div className="flex items-center px-3">
                      <User className="h-5 w-5 mr-3 text-gray-400" aria-hidden="true" />
                      <div className="text-base font-medium text-gray-800">
                        {user.email}
                      </div>
                    </div>
                    <div className="mt-3 px-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleLogout();
                          closeMobileMenu();
                        }}
                        className="w-full justify-center"
                        aria-label="Wyloguj się"
                      >
                        <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                        Wyloguj się
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="px-3 py-3">
                  <Link href="/login" onClick={closeMobileMenu}>
                    <Button variant="primary" size="lg" className="w-full">
                      Zaloguj się
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
