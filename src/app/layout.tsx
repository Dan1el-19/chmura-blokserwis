import type { Metadata, Viewport } from "next";
import { Roboto, Inter } from 'next/font/google';
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt';

// Google Fonts
const roboto = Roboto({
  weight: ['100', '300', '400', '500', '700', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

const inter = Inter({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-funnel-sans',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#3B82F6',
  colorScheme: 'light dark',
};

export const metadata: Metadata = {
  title: "Chmura Blokserwis",
  description: "Profesjonalna platforma do zarządzania plikami z zaawansowanym systemem uprawnień",
  keywords: ["chmura", "plik", "storage", "cloud", "bezpieczeństwo"],
  authors: [{ name: "Chmura Blokserwis" }],
  robots: "index, follow",
  openGraph: {
    title: "Chmura Blokserwis",
    description: "Profesjonalna platforma do zarządzania plikami z zaawansowanym systemem uprawnień",
    type: "website",
    locale: "pl_PL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chmura Blokserwis",
    description: "Profesjonalna platforma do zarządzania plikami z zaawansowanym systemem uprawnień",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`scroll-smooth ${roboto.variable} ${inter.variable}`}>
      <head>
  {/* Fonts loaded via next/font/google (roboto, inter) */}
        
        <meta name="application-name" content="Chmura Blokserwis" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Chmura Blokserwis" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3B82F6" />
        <meta name="msapplication-tap-highlight" content="no" />
        
  <link rel="apple-touch-icon" href="/favicon-new.svg" />
  <link rel="icon" type="image/svg+xml" href="/favicon-new.svg" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className="antialiased"
        suppressHydrationWarning={true}
      >
        <div id="skip-to-content" className="sr-only">
          <a href="#main-content" className="block p-4 bg-blue-600 text-white text-center">
            Przejdź do głównej zawartości
          </a>
        </div>
        
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
