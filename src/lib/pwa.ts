import React from 'react';

// PWA Management Library - Temporarily disabled for SSR compatibility
export interface PWAInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAConfig {
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'portrait' | 'landscape' | 'any';
  scope: string;
  startUrl: string;
}

// Hook dla React - Simplified version for SSR compatibility
export function usePWA() {
  const [canInstall] = React.useState(false);
  const [isInstalled] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [hasUpdate] = React.useState(false);

  React.useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    // Simple online/offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    canInstall,
    isInstalled,
    isOnline,
    hasUpdate,
    showInstallPrompt: async () => false,
    updateApp: async () => {},
    sendNotification: async () => {},
    requestNotificationPermission: async () => 'denied' as NotificationPermission,
    getNotificationPermission: async () => 'denied' as NotificationPermission
  };
}
