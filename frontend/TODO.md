# TODO - Chmura Blokserwis

## 🚀 Hybrydowe podejście do uploadu (W TRAKCIE)

### ✅ Zrobione:
- [x] Naprawiono błędy CORS - upload przez backend
- [x] Dodano fallback dla crypto.subtle w HTTP
- [x] Naprawiono usuwanie nieudanych uploadów
- [x] Automatyczne czyszczenie ukończonych uploadów
- [x] Automatyczne odświeżanie listy plików
- [x] Naprawiono usuwanie plików (query string vs body)
- [x] **Dodano endpoint DELETE do `/api/admin/users`** - naprawiono błąd 404
- [x] **Implementacja hybrydowego uploadu**:\n  - [x] Małe pliki (< 50MB): Backend upload (bezpieczny)\n  - [x] Duże pliki (> 50MB): Presigned URLs (szybki) - *Note: Aktualna implementacja dużych plików nadal używa proxy dla części, co wymaga refaktoryzacji.*
  - [x] Endpoint `/api/files/multipart/initiate` dla dużych plików
  - [x] Endpoint `/api/files/multipart/part-url` dla części
  - [x] Endpoint `/api/files/multipart/complete` dla finalizacji
  - [x] Endpoint `/api/files/multipart/abort` dla anulowania
  - [x] Progress tracking dla presigned URLs
  - [x] Resumable upload dla dużych plików - *Note: Wznowienie po odświeżeniu wymaga ponownego wyboru pliku przez użytkownika.*
- [x] **Proxy upload dla części** - rozwiązanie problemów CORS w dev - *Note: To rozwiązanie proxy musi zostać usunięte w finalnej architekturze zgodnej z dokumentem.*

### 🔄 W trakcie:
- [x] **Testowanie hybrydowego uploadu**:\n  - [x] Test małych plików (< 50MB) - ZAKOŃCZONE
  - [x] Test dużych plików (> 50MB) - ZAKOŃCZONE
  - [x] Test anulowania uploadu - ZAKOŃCZONE
  - [x] Test wznowienia uploadu - ZAKOŃCZONE
  - [x] Test błędów sieciowych - ZAKOŃCZONE
- [x] **Naprawa problemów z UI**:\n  - [x] Naprawa przycisków Pauza/Anuluj - dodano sprawdzanie statusu w pętli uploadu
  - [x] Naprawa Fast Refresh - usunięto problematyczne zależności z useEffect
  - [x] Naprawa starych błędnych uploadów - dodano automatyczne czyszczenie
  - [x] Zastąpienie niestabilnego progress bara Material-UI LinearProgress
- [ ] **Dynamiczny algorytm rozmiaru części**:\n  - [x] Implementacja podstawowego algorytmu z wieloma strategiami - ZAKOŃCZONE
  - [x] Integracja z ResumableUploadManager - ZAKOŃCZONE
  - [x] Zbieranie metryk systemu i sieci - ZAKOŃCZONE
  - [x] Historia uploadów dla uczenia się - ZAKOŃCZONE
  - [x] Testowanie algorytmu na różnych typach plików - ZAKOŃCZONE
  - [x] **Optymalizacja algorytmu** - mniej części dla większych plików: - ZAKOŃCZONE
    - [x] Dostosowanie wag strategii (większa waga dla wielkości pliku) - ZAKOŃCZONE
    - [x] Zmiana logarytmicznego skalowania na bardziej agresywne - ZAKOŃCZONE
    - [x] Cel: 1GB = ~4 części, 10GB = ~20 części - ZAKOŃCZONE
    - [x] Testowanie nowych parametrów - ZAKOŃCZONE
  - [x] **Płynny progress bar**:- ZAKOŃCZONE
    - [x] Implementacja interpolacji między częściami - ZAKOŃCZONE
    - [x] Aktualizacja co 1% zamiast skoków - ZAKOŃCZONE
    - [x] Zachowanie prawdziwego stanu uploadu - ZAKOŃCZONE
    - [x] Animacja płynnego przejścia - ZAKOŃCZONE
    - [x] Testowanie na różnych prędkościach sieci - ZAKOŃCZONE

### 📋 Do zrobienia:

#### **Refaktoryzacja i Usprawnienia Uploadu (Zgodność z Dokumentem):**

- [ ] **Usunięcie serwera proxy dla uploadu części:**
  - [x] Zmiana logiki po stronie klienta (`ResumableUploadManager` lub integracja z Uppy) aby wysyłać części **bezpośrednio** do R2 używając presigned URLs z endpointu `/api/files/multipart/part-url`.
  - [x] Usunięcie endpointu `/api/files/multipart/upload-part` (jest niezgodny z zalecaną architekturą).
- [ ] **Pełna implementacja wznowień po stronie klienta:**
  - [ ] Zastosowanie `@uppy/golden-retriever` (jeśli zintegrujesz Uppy) lub rozbudowa logiki w `ResumableUploadManager` do trwałego przechowywania stanu uploadu (w tym listy przesłanych części) w IndexedDB/localStorage.
  - [ ] Usprawnienie procesu wznowienia po odświeżeniu strony - jasne wskazanie użytkownikowi, który plik należy ponownie wybrać, lub próba automatycznego podpięcia pliku, jeśli to możliwe.
  - [x] Rozszerzenie IndexedDB o store `handles` (przyszłe auto-reattach z FileSystemHandle, jeśli przeglądarka pozwoli).
- [ ] **Implementacja równoległego wysyłania części:**
  - [ ] Zmiana logiki wysyłania części po stronie klienta aby wysyłać `adaptiveConcurrency` części jednocześnie. (bazowa równoległość wdrożona; adaptacyjne dostrajanie w toku)
  - [x] Implementacja zarządzania pulą połączeń dla współbieżnych uploadów części.
- [x] **Poprawa śledzenia postępu:**
  - [x] Implementacja śledzenia postępu *w trakcie* wysyłania pojedynczej części (z `XMLHttpRequest.upload.onprogress`).
  - [x] Aktualizacja UI w czasie rzeczywistym w miarę przesyłania bajtów w ramach każdej części.
- [ ] **Weryfikacja i Optymalizacja Konfiguracji CORS:**
  - [x] Upewnienie się, że polityka CORS na bucketcie R2 ma `ExposeHeaders: ["ETag"]`.
  - [ ] Sprawdzenie, czy `AllowedOrigins` obejmuje wszystkie domeny, z których aplikacja będzie dostępna.
- [ ] **Optymalizacja sprawdzania limitu miejsca:**
  - [x] Zmiana logiki w `/api/files/multipart/initiate` aby bazować na liczniku używanej przestrzeni przechowywanym w Firestore zamiast listowania wszystkich plików w R2.
  - [x] Implementacja logiki aktualizacji tego licznika po pomyślnym ukończeniu uploadu i po usunięciu pliku (transakcyjnie) oraz po małym uploadzie.
- [ ] **Implementacja serwerowego czyszczenia nieukończonych uploadów:**
  - [ ] Konfiguracja polityki cyklu życia w R2 (jeśli domyślne 7 dni jest niewystarczające lub chcesz innego zachowania).
  - [x] Opcjonalnie: Endpoint `/api/files/multipart/cleanup` (admin) do okresowego czyszczenia nieukończonych uploadów (możliwy Cron Job).
- [ ] **Ulepszona obsługa błędów po stronie klienta:**
  - [ ] Lepsze reagowanie na błędy zwracane przez endpointy API (np. błędy autoryzacji, brak miejsca, błędy R2).
  - [ ] Prezentowanie użytkownikowi czytelnych komunikatów o błędach.
  - [x] Implementacja logicznych ponowień prób dla wywołań API (initiate, part-url, complete) oprócz ponowień uploadu części.
- [ ] **Caching presigned URLs (opcjonalnie):**
  - [x] Po stronie klienta, przechowywanie wygenerowanych presigned URLs dla części na krótki czas w pamięci, aby uniknąć wielokrotnego wywoływania `/api/files/multipart/part-url` dla tej samej części w krótkim odstępie czasu.

#### **Integracja z Uppy (Alternatywa dla własnej implementacji klienta):**

- [ ] **Instalacja i konfiguracja Uppy:**
  - [ ] Instalacja `@uppy/core`, `@uppy/react`, `@uppy/aws-s3-multipart`.
  - [ ] Utworzenie komponentu React (`MultipartUploader.tsx` lub podobnego) integrującego Uppy z Twoimi endpointami API (`/api/files/multipart/...`).
- [ ] **Integracja wznowień z Uppy:**
  - [ ] Instalacja `@uppy/golden-retriever`.
  - [ ] Konfiguracja `@uppy/golden-retriever` do synchronizacji stanu uploadu z IndexedDB/localStorage.
- [ ] **Dostosowanie UI Uppy do stylów i UX aplikacji.**

#### **Dynamiczny algorytm rozmiaru części (Kontynuacja):**

- [ ] Machine learning dla optymalizacji rozmiaru części (opcjonalnie, zaawansowane).
- [ ] Real-time adjustment rozmiaru części podczas uploadu (opcjonalnie, zaawansowane).
- [ ] A/B testing różnych strategii dla różnych typów plików.
- [ ] Benchmarking wydajności różnych algorytmów.

## 🔒 Bezpieczeństwo - Analiza i poprawki

### ✅ Zrobione:
- [x] **Panel admina - wszystkie operacje przez backend API**:\n  - [x] `GET /api/admin/users` - lista użytkowników
  - [x] `POST /api/admin/users` - tworzenie użytkowników
  - [x] `DELETE /api/admin/users` - usuwanie użytkowników
  - [x] `PUT /api/admin/users/update` - aktualizacja użytkowników
  - [x] `POST /api/admin/users/password` - reset hasła
  - [x] `GET /api/admin/logs` - logi aktywności
  - [x] `GET /api/admin/main-storage` - statystyki storage

### 🔍 Zidentyfikowane problemy:
- [x] ~~Panel admina używa bezpośrednich operacji Firebase~~ - NAPRAWIONE
- [x] ~~Brak endpointów API dla operacji admina~~ - NAPRAWIONE
- [x] ~~Niektóre operacje mogą być wykonywane poza backendem~~ - NAPRAWIONE

### 🛡️ Do naprawienia:
- [ ] **Middleware bezpieczeństwa (globalne lub per-endpoint):**
  - [x] Admin role verification - **Upewnienie się, że tylko użytkownicy z rolą 'admin' mają dostęp do endpointów w `/api/admin/`** (rozszerzono matcher middleware; weryfikacje w endpointach pozostają skuteczne).
  - [x] Rate limiting - podstawowa ochrona per-IP dla multipart endpoints i cleanup.
  - [ ] Request validation - Dokładna walidacja danych wejściowych we wszystkich endpointach API.
    - [x] multipart initiate/part-url/complete
    - [x] admin users POST/PUT/password
    - [x] multipart: initiate, part-url, complete (zod)
    - [x] files/share (zod)
    - [x] files/download (zod + rate limit + audit)
  - [ ] Audit logging - Wdrożenie bardziej szczegółowego logowania akcji użytkowników i administratorów.
    - [x] Logi dla operacji admina: create/delete/update user
    - [x] Logi dla upload/delete: folder, key, IP/UA
  - [x] **Weryfikacja uprawnień do folderu 'main' w endpointach multipart:** dodano sprawdzenie ról w `/api/files/multipart/part-url` i `/api/files/multipart/complete`.

## 📊 Priorytety:

### 🔴 KRYTYCZNY (Naprawa Architektury Uploadu):
1. [ ] Usunięcie serwera proxy dla uploadu części (`/api/files/multipart/upload-part`).
2. [ ] Wdrożenie bezpośredniego uploadu części klient-R2.

### 🟢 WYSOKI (Stabilność i Bezpieczeństwo):
1. [ ] Pełna implementacja wznowień po stronie klienta (poprawa obecnej logiki lub integracja z Uppy Golden Retriever).
2. [ ] Middleware bezpieczeństwa (w szczególności weryfikacja roli admina).
3. [ ] Weryfikacja i Optymalizacja Konfiguracji CORS (szczególnie `ExposeHeaders`).
4. [ ] Poprawa śledzenia postępu i aktualizacja UI.

### 🟡 ŚREDNI (Wydajność i Optymalizacja):
1. [ ] Implementacja równoległego wysyłania części.
2. [ ] Optymalizacja sprawdzania limitu miejsca (liczniki w Firestore).
3. [ ] Implementacja serwerowego czyszczenia nieukończonych uploadów.
4. [ ] Ulepszona obsługa błędów po stronie klienta i ponowienia prób.

### 🔵 NISKI (UX i Funkcjonalności Zaawansowane):
1. [ ] Dalsze prace nad dynamicznym algorytmem rozmiaru części.
2. [ ] Caching presigned URLs.
3. [ ] UI improvements, lepsze komunikaty błędów.

## 🎯 Cel:
- ✅ **Bezpieczeństwo**: Wszystkie operacje przez backend - ZAKOŃCZONE (ale wymaga uszczelnienia middlewarem).
- ✅ **Wydajność**: Szybki upload dla dużych plików - ZAKOŃCZONE (ale wymaga refaktoryzacji proxy i implementacji równoległości).
- [ ] **Inteligentna optymalizacja**: Dynamiczne dostosowanie do warunków.
- [ ] **UX**: Płynne i niezawodne doświadczenie użytkownika, **w tym pełne i intuicyjne wznowienia uploadów**.
