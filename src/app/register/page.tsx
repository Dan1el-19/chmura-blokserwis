'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function RegisterInfoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full">
        <Link href="/login" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Powrót do logowania
        </Link>
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Rejestracja konta</h1>
          <p className="text-gray-600 mb-6">
            Tworzenie kont jest zarządzane przez administratora. Aby uzyskać dostęp, skontaktuj się z administratorem systemu.
          </p>
          <div className="text-sm text-gray-500">
            Jeśli otrzymałeś dane dostępowe, zaloguj się na stronie logowania.
          </div>
        </div>
      </div>
    </div>
  );
}



