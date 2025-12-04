node abort-multipart.mjs --dry-run false --older-than 0

# Chmura Blokserwis - Platforma do zarządzania plikami

Profesjonalna aplikacja do zarządzania plikami w chmurze z zaawansowanym systemem uprawnień, monitorowaniem wykorzystania przestrzeni i bezpiecznym udostępnianiem.

## Funkcjonalności

### 🔐 System autoryzacji

- Firebase Authentication (Google, email/password)
- System ról: basic, plus, admin
- Bezpieczne tokeny JWT

### 📁 Zarządzanie plikami

- Upload, pobieranie, usuwanie plików
- Monitorowanie wykorzystania przestrzeni
- Blokada uploadu po przekroczeniu limitu
- Pre-signed URL do bezpiecznego udostępniania

### 👥 Role i uprawnienia

- **Basic**: Własny folder (5GB), podstawowe operacje
- **Plus**: Wszystkie funkcje basic + dostęp do folderu głównego
- **Admin**: Panel administracyjny, zarządzanie użytkownikami, logi

### 🛡️ Bezpieczeństwo

- Weryfikacja tokenów Firebase
- Kontrola dostępu oparta na rolach
- Szyfrowanie danych w Cloudflare R2
- Logi aktywności użytkowników

## Technologie

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Autoryzacja**: Firebase Authentication
- **Storage**: Cloudflare R2 (kompatybilne z AWS S3)
- **UI**: Lucide React, React Hot Toast

## Instalacja

### 1. Klonowanie repozytorium

```bash
git clone <repository-url>
cd chmura-blokserwis
```

### 2. Instalacja zależności

```bash
npm install
```

### 3. Konfiguracja zmiennych środowiskowych

Skopiuj plik `env.example` do `.env.local` i wypełnij odpowiednie wartości:

```bash
cp env.example .env.local
```

#### Firebase Configuration

1. Utwórz projekt w [Firebase Console](https://console.firebase.google.com/)
2. Włącz Authentication (Google, Email/Password)
3. Pobierz konfigurację z ustawień projektu
4. Utwórz Service Account i pobierz klucz prywatny

#### Cloudflare R2 Configuration

1. Utwórz konto w [Cloudflare](https://cloudflare.com/)
2. Przejdź do R2 Object Storage
3. Utwórz bucket
4. Wygeneruj API Token z uprawnieniami do R2

### 4. Uruchomienie aplikacji

```bash
npm run dev
```

Aplikacja będzie dostępna pod adresem `http://localhost:3000`

## Struktura projektu

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── admin/         # Endpointy administracyjne
│   │   ├── files/         # Zarządzanie plikami
│   │   └── user/          # Profil użytkownika
│   ├── login/             # Strona logowania
│   ├── storage/           # Panel użytkownika
│   ├── admin-panel/       # Panel administracyjny
│   └── page.tsx           # Strona główna
├── lib/                   # Biblioteki i konfiguracje
│   ├── firebase.ts        # Konfiguracja Firebase
│   ├── storage.ts         # Konfiguracja Cloudflare R2
│   ├── auth.ts            # Funkcje autoryzacji
│   └── utils.ts           # Funkcje pomocnicze
└── types/                 # Definicje TypeScript
    └── index.ts           # Typy aplikacji
```

## API Endpoints

### Użytkownik

- `GET /api/user/profile` - Pobierz profil użytkownika

### Pliki

- `GET /api/files` - Lista plików
- `POST /api/files/upload` - Upload pliku
- `GET /api/files/download` - Pobierz plik
- `DELETE /api/files/delete` - Usuń plik
- `POST /api/files/share` - Udostępnij plik

### Administracja

- `GET /api/admin/users` - Lista użytkowników
- `PUT /api/admin/users/update` - Aktualizuj użytkownika
- `DELETE /api/admin/users?userId=<id>` - Usuń użytkownika
- `GET /api/admin/logs` - Logi aktywności

## Deployment

### Firebase Hosting

```bash
npm run build
firebase deploy
```

### Vercel

```bash
npm run build
vercel --prod
```

## Bezpieczeństwo

- Wszystkie API endpoints wymagają autoryzacji
- Tokeny Firebase są weryfikowane na serwerze
- Uprawnienia sprawdzane przed każdą operacją
- Pre-signed URL mają ograniczony czas ważności
- Logi wszystkich akcji użytkowników

## Rozwój

### Dodawanie nowych funkcjonalności

1. Utwórz nowy komponent w `src/components/`
2. Dodaj odpowiednie typy w `src/types/`
3. Stwórz API endpoint w `src/app/api/`
4. Zaktualizuj dokumentację

### Testowanie

```bash
npm run lint
npm run build
```

## Licencja

MIT License - zobacz plik [LICENSE](LICENSE) dla szczegółów.

## Wsparcie

W przypadku problemów lub pytań, utwórz issue w repozytorium lub skontaktuj się z zespołem deweloperskim.
