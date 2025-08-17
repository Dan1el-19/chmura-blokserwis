"use client";

import { 
  User, 
  LogOut, 
  Menu, 
  X, 
  Settings,
  Folder,
  FolderOpen
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { UserRole } from '@/types';

interface StorageHeaderProps {
  title: string;
  userEmail: string;
  userRole: UserRole;
  currentFolder: string;
  onFolderChange: (folder: string) => void;
  onLogout: () => void;
  onAdminPanel: () => void;
  showMobileMenu: boolean;
  onToggleMobileMenu: () => void;
}

export default function StorageHeader({
  title,
  userEmail,
  userRole,
  currentFolder,
  onFolderChange,
  onLogout,
  onAdminPanel,
  showMobileMenu,
  onToggleMobileMenu
}: StorageHeaderProps) {




  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Navigation */}
        <div className="hidden md:flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center py-3 sm:py-4">
          {/* Logo + Folder Toggle */}
          <div className="flex items-center gap-2 sm:gap-4">
                         <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-roboto">{title}</h1>
            <div className="flex gap-2">
              <button
                onClick={() => onFolderChange('personal')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentFolder === 'personal'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                Mój folder
              </button>
              <button
                onClick={() => onFolderChange('main')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentFolder === 'main'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                Folder główny
              </button>
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3 sm:gap-4">

            {/* User Info */}
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">{userEmail}</span>
            </div>

            {/* Action Buttons */}
            {userRole === 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAdminPanel}
                aria-label="Panel admina"
                className="p-2"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              aria-label="Wyloguj się"
              className="p-2"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                             <h1 className="text-lg font-bold text-gray-900 font-roboto">{title}</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleMobileMenu}
                aria-label="Menu"
                aria-expanded={showMobileMenu}
                aria-haspopup={true}
                className="p-2"
              >
                {showMobileMenu ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">{userEmail}</span>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="space-y-4">
              {/* Folder Toggle Mobile */}
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => onFolderChange('personal')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentFolder === 'personal'
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Folder className="h-4 w-4" />
                  <span>Mój folder</span>
                </button>
                <button
                  onClick={() => onFolderChange('main')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentFolder === 'main'
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Folder główny</span>
                </button>
              </div>



              {/* User Info Mobile */}
              <div className="px-3 py-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{userEmail}</span>
                  <div className="flex items-center space-x-2">
                    {userRole === 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onAdminPanel}
                        aria-label="Panel admina"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onLogout}
                      aria-label="Wyloguj się"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
