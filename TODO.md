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
- [x] **Implementacja hybrydowego uploadu**:
  - [x] Małe pliki (< 50MB): Backend upload (bezpieczny)
  - [x] Duże pliki (> 50MB): Presigned URLs (szybki)
  - [x] Endpoint `/api/files/multipart/initiate` dla dużych plików
  - [x] Endpoint `/api/files/multipart/part-url` dla części
  - [x] Endpoint `/api/files/multipart/complete` dla finalizacji
  - [x] Endpoint `/api/files/multipart/abort` dla anulowania
  - [x] Progress tracking dla presigned URLs
  - [x] Resumable upload dla dużych plików

### 🔄 W trakcie:
- [ ] **Testowanie hybrydowego uploadu**:
  - [ ] Test małych plików (< 50MB)
  - [ ] Test dużych plików (> 50MB)
  - [ ] Test anulowania uploadu
  - [ ] Test wznowienia uploadu
  - [ ] Test błędów sieciowych

### 📋 Do zrobienia:
- [ ] **Optymalizacje**:
  - [ ] Caching presigned URLs
  - [ ] Adaptive concurrency dla dużych plików
  - [ ] Retry logic dla presigned URLs
  - [ ] Network quality detection
  - [ ] Upload speed optimization

- [ ] **UI/UX**:
  - [ ] Progress bar dla presigned URLs
  - [ ] Różne style dla różnych typów uploadu
  - [ ] Informacja o typie uploadu (backend vs presigned)
  - [ ] Better error handling dla różnych typów

## 🔒 Bezpieczeństwo - Analiza i poprawki

### ✅ Zrobione:
- [x] **Panel admina - wszystkie operacje przez backend API**:
  - [x] `GET /api/admin/users` - lista użytkowników
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
- [ ] **Middleware bezpieczeństwa**:
  - [ ] Admin role verification
  - [ ] Rate limiting
  - [ ] Request validation
  - [ ] Audit logging

## 📊 Priorytety:

### 🟢 WYSOKI (Bezpieczeństwo):
1. ✅ ~~Implementacja endpointów admina~~ - ZAKOŃCZONE
2. ✅ ~~Przeniesienie operacji admina na backend~~ - ZAKOŃCZONE
3. [ ] Middleware bezpieczeństwa

### 🟡 ŚREDNI (Wydajność):
1. ✅ ~~Hybrydowe podejście do uploadu~~ - ZAKOŃCZONE
2. ✅ ~~Presigned URLs dla dużych plików~~ - ZAKOŃCZONE
3. [ ] Progress tracking

### 🔵 NISKI (UX):
1. [ ] UI improvements
2. [ ] Better error messages
3. [ ] Loading states

## 🎯 Cel:
- ✅ **Bezpieczeństwo**: Wszystkie operacje przez backend - ZAKOŃCZONE
- ✅ **Wydajność**: Szybki upload dla dużych plików - ZAKOŃCZONE
- [ ] **UX**: Płynne doświadczenie użytkownika