"use client";

import { useState, useEffect, useRef } from 'react';
import { User, LogOut, Menu, X, Settings, ChevronDown } from 'lucide-react';
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

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Navigation */}
        <div className="hidden md:flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center py-3 sm:py-4">
          {/* Logo + Folder Toggle */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-3 group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                {title}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onFolderChange('personal')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentFolder === 'personal'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                Personal
              </button>
              <button
                onClick={() => onFolderChange('main')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentFolder === 'main'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                Main
              </button>
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Role Badge */}
            <div className="hidden sm:block">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                userRole === 'admin' 
                  ? 'bg-red-100 text-red-800' 
                  : userRole === 'plus'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {userRole.toUpperCase()}
              </span>
            </div>

            {/* User Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:block">{userEmail}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-200 text-center">
                  <p className="text-sm font-medium text-gray-900">{userEmail}</p>
                </div>
                <div className="py-1">
                  {userRole === 'admin' && (
                    <button
                      onClick={onAdminPanel}
                      className="flex items-center justify-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Panel Administracyjny
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onLogout();
                      setShowUserDropdown(false);
                    }}
                    className="flex items-center justify-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Wyloguj się
                  </button>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <h1 className="text-base font-bold text-gray-900 font-roboto tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium inline-flex ${
                userRole === 'admin'
                  ? 'bg-red-100 text-red-700'
                  : userRole === 'plus'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>{userRole.toUpperCase()}</span>
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
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200 py-3 animate-in fade-in">
            <div className="px-4 flex items-center mb-4">
              <p
                className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0 pr-4"
                title={userEmail}
              >
                {userEmail}
              </p>
              <div className="flex items-center shrink-0 space-x-2">
                {userRole === 'admin' && (
                  <Button variant="outline" size="sm" onClick={onAdminPanel} aria-label="Panel admina">
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={onLogout} aria-label="Wyloguj się">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-stretch px-4">
              <button
                onClick={() => onFolderChange('personal')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentFolder === 'personal' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >Personal</button>
              <button
                onClick={() => onFolderChange('main')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentFolder === 'main' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >Main</button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
