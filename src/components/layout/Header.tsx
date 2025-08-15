import React from 'react';
import { 
  HardDrive, 
  User, 
  Settings, 
  LogOut, 
  Menu, 
  X 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatBytes } from '@/lib/utils';

interface HeaderProps {
  title: string;
  userEmail: string;
  userRole: string;
  storageUsed: number;
  storageLimit: number;
  currentFolder: string;
  onFolderChange: (folder: string) => void;
  onLogout: () => void;
  onAdminPanel?: () => void;
  showMobileMenu?: boolean;
  onToggleMobileMenu?: () => void;
}

export default function Header({
  title,
  userEmail,
  userRole,
  storageUsed,
  storageLimit,
  currentFolder,
  onFolderChange,
  onLogout,
  onAdminPanel,
  showMobileMenu = false,
  onToggleMobileMenu
}: HeaderProps) {
  const storagePercentage = (storageUsed / storageLimit) * 100;

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Header */}
        <div className="hidden md:flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
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
              {userRole !== 'basic' && (
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
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                {formatBytes(storageUsed)} / {formatBytes(storageLimit)}
              </span>
            </div>
            
            <div className="w-28 sm:w-32 bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  storagePercentage > 90 ? 'bg-red-500' : 
                  storagePercentage > 70 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(storagePercentage, 100)}%` }}
              ></div>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">{userEmail}</span>
            </div>

            {userRole === 'admin' && onAdminPanel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAdminPanel}
                className="p-2"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="p-2"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-gray-900">{title}</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleMobileMenu}
                className="p-2"
              >
                {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    storagePercentage > 90 ? 'bg-red-500' : 
                    storagePercentage > 70 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-600">
                {formatBytes(storageUsed)}
              </span>
            </div>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <Card className="mt-3">
              <CardContent className="p-4 space-y-4">
                {/* Folder Navigation */}
                <div className="flex gap-2">
                  <Button
                    variant={currentFolder === 'personal' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onFolderChange('personal')}
                    className="flex-1"
                  >
                    Mój folder
                  </Button>
                  {userRole !== 'basic' && (
                    <Button
                      variant={currentFolder === 'main' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => onFolderChange('main')}
                      className="flex-1"
                    >
                      Folder główny
                    </Button>
                  )}
                </div>

                {/* User Info */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="truncate">{userEmail}</span>
                </div>

                {/* Storage Info */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <HardDrive className="h-4 w-4" />
                  <span>{formatBytes(storageUsed)} / {formatBytes(storageLimit)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-200">
                  {userRole === 'admin' && onAdminPanel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onAdminPanel}
                      className="flex-1"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Admin
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onLogout}
                    className="flex-1"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Wyloguj
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </header>
  );
}
