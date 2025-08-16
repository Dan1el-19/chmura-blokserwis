# TODO - Chmura Blokserwis

## ✅ Zakończone
- [x] Naprawa pobierania plików z S3 Cloudflare (błąd 404)
- [x] Utworzenie endpointu `/api/files/access` dla bezpośredniego dostępu do plików
- [x] Utworzenie endpointu `/api/files/presigned` dla miniatur obrazów
- [x] Implementacja komponentu `ThumbnailImage` z autoryzacją
- [x] Naprawa podglądu obrazów w aplikacji
- [x] Dodanie szczegółowego logowania błędów w funkcji udostępniania
- [x] Naprawa generowania pełnych URL dla udostępniania
- [x] Naprawa pobierania plików - wymuszenie pobierania zamiast przekierowania

### 1. Modal potwierdzenia udostępnienia
- [x] Utworzenie komponentu `ShareModal` z potwierdzeniem
- [x] Wyświetlanie wygenerowanego linku w modalu
- [x] Przycisk kopiowania linku w modalu
- [x] Integracja z funkcją `handleShare` w `storage/page.tsx`
- [x] Usunięcie automatycznego kopiowania do schowka

### 2. Naprawa pobierania plików
- [x] Modyfikacja funkcji `handleFileDownload` aby wymuszała pobieranie
- [x] Użycie `Content-Disposition: attachment` w endpoincie `/api/files/download`
- [x] Testowanie pobierania różnych typów plików
- [x] Sprawdzenie czy nie ma przekierowań na linki Cloudflare

### 3. System ważności linków
- [x] Utworzenie komponentu `ShareOptionsModal` z opcjami czasu
- [x] Dodanie opcji czasowych: minuty, godziny, dni, miesiące
- [x] Dodanie opcji do konkretnej daty i godziny
- [x] Modyfikacja endpointu `/api/files/share` aby obsługiwał różne czasy ważności
- [x] Walidacja dat w interfejsie użytkownika
- [x] Wyświetlanie informacji o ważności linku w modalu potwierdzenia

### 4. System zarządzania wieloma linkami
- [x] Utworzenie endpointu `/api/files/links` (GET, DELETE, PATCH)
- [x] Implementacja komponentu `ManageLinksModal`
- [x] Dodanie funkcji edycji nazwy i czasu ważności linków
- [x] Integracja z interfejsem użytkownika
- [x] Naprawa błędów TypeScript i ESLint

### 5. Statystyki użycia linków
- [x] Utworzenie kolekcji `linkUsage` w Firestore
- [x] Logowanie kliknięć w endpoincie `/api/files/shared`
- [x] Implementacja endpointu `/api/files/stats`
- [x] Utworzenie komponentu `StatsModal`
- [x] Integracja z `ManageLinksModal` i `FileGrid`

### 6. System zarządzania przestrzenią dyskową
- [x] Usunięcie strony register i odwołań do niej
- [x] Naprawa obliczania użytej przestrzeni dyskowej w `/api/user/profile`
- [x] Dodanie sprawdzania limitu miejsca przed uploadem
- [x] Aktualizacja użytej przestrzeni po uploadzie i usunięciu plików
- [x] Dodanie limitu miejsca dla folderu main (50GB)
- [x] Ograniczenie uploadu do folderu main dla ról plus i admin
- [x] Dodanie statystyk folderu main w panelu admina
- [x] Utworzenie endpointu `/api/admin/main-storage`
- [x] Dodanie zarządzania limitem folderu main przez admina

### 7. Ulepszenia interfejsu i obsługi błędów
- [x] Naprawa kolorów inputów w panelu admina
- [x] Dodanie własnego modału do zmiany hasła (zamiast prompt)
- [x] Dodanie szczegółowych komunikatów błędów logowania w języku polskim
- [x] Lepsze handling błędów Firebase Authentication
- [x] Wyświetlanie błędów logowania pod polem hasła
- [x] Modyfikacja strony głównej z prawdziwymi danymi systemu
- [x] Utworzenie endpointu `/api/system/stats` dla statystyk systemu
- [x] Aktualizacja stopki z dynamicznym rokiem
- [x] Przeniesienie statusu systemu do prawej kolumny (zamiast ostatnich plików)
- [x] Poprawa układu stopki - zawsze na dole strony
- [x] Ulepszenie responsywności paneli - lepsze wykorzystanie przestrzeni na dużych ekranach
- [x] Dodanie sekcji "Ostatnie pliki" na bardzo dużych ekranach (2xl)
- [x] Usunięcie panelu "Szybkie akcje" - uproszczenie interfejsu
- [x] Rozszerzenie "Status systemu" o dodatkowe usługi (Google Cloud Run, GitHub, Next.js)
- [x] Poprawa responsywności statusu systemu - lepsze wykorzystanie przestrzeni
- [x] Ulepszenie logiki sprawdzania statusu usług - lepsze rozróżnianie błędów połączenia od braku danych
- [x] Uproszczenie statusu usług na stronie publicznej - statyczne statusy zamiast dynamicznego sprawdzania
- [x] Naprawa błędów TypeScript i ESLint - usunięcie nieużywanych importów i dodanie typów dla błędów

## 🐛 Znane problemy
- Clipboard API nie działa w niektórych przeglądarkach (naprawione przez modal)
- Statystyki mogą nie działać w środowisku deweloperskim (wymagane wdrożenie)

## 📝 Uwagi techniczne
- System sprawdza limity miejsca przed każdym uploadem
- Używana przestrzeń jest obliczana w czasie rzeczywistym z S3
- Folder main ma limit 50GB i jest dostępny dla ról plus i admin
- Admin może edytować limit folderu main z panelu administracyjnego
- Wszystkie operacje na plikach są logowane w `activityLogs`
- Statystyki linków są zbierane w kolekcji `linkUsage`
- Szczegółowe komunikaty błędów w języku polskim

## 🔧 Funkcje systemu
- **Zarządzanie plikami**: Upload, download, delete, preview
- **Udostępnianie**: Wielokrotne linki z nazwami i czasem ważności
- **Statystyki**: Śledzenie użycia linków i przestrzeni dyskowej
- **Administracja**: Panel admina z zarządzaniem użytkownikami i limitami
- **Bezpieczeństwo**: Sprawdzanie uprawnień i limitów miejsca
