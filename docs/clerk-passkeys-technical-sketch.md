# Wspólne passkeys dla Chmury i natywnego Androida

Data researchu: 2026-11-14. Status: szkic techniczny do decyzji; wspólne logowanie istniejącym kluczem nie zostało jeszcze potwierdzone E2E.

## Cel i ograniczenia

Jedna produkcyjna instancja Clerk, te same konta i uprawnienia, możliwość użycia tego samego passkey w Chmurze i aplikacji `pl.blokserwis`. Android zachowuje natywny `AuthView` i systemowy Credential Manager. Przeglądarka ani WebView nie stają się częścią androidowego logowania passkey.

Wspólne miejsce odpowiedzialne za login oznacza wspólnego dostawcę tożsamości, politykę i rejestr poświadczeń. Interfejs pozostaje właściwy dla platformy: natywny na Androidzie, WWW w Chmurze. Preferencja użytkownika: centralny ekran WWW na `auth.blokserwis.pl`; docelowo także wspólny RP ID `auth.blokserwis.pl`, jeżeli Clerk wspiera go dla natywnego Androida. Adres ekranu i RP ID to osobne decyzje: ekran pod tym adresem można zaprojektować również przy innym RP, ale wymaga to poprawnej konfiguracji WebAuthn.

## Stan sprawdzony

| Element | Ustalenie | Rodzaj dowodu |
| --- | --- | --- |
| Clerk | UniSource ID, jedna produkcyjna instancja | Odczyt konektorem Clerk |
| Domena główna instancji | `auth.blokserwis.pl` | `list_domains` |
| Frontend API (FAPI) | `clerk.auth.blokserwis.pl` | `list_domains` |
| Account Portal | `accounts.auth.blokserwis.pl` | `list_domains` |
| WWW | `@clerk/clerk-js` 6.40.0, UI 1.41.0, osadzony `mountSignIn` | Kod Chmury |
| Android | Clerk SDK 1.1.4, natywny `AuthView` | Kod `blokserwis-native` |
| Native API | Włączone, `pl.blokserwis` zarejestrowane z fingerprintem | `list_native_applications` |
| Passkeys | Włączone, przycisk i autofill aktywne | `get_instance_config` |
| Web challenge | RP ID `auth.blokserwis.pl` | Świeży request standardowego Clerk JS z Chmury |
| Native challenge | RP ID `clerk.auth.blokserwis.pl` | Wcześniejsza diagnostyka Androida; zgodne z dokumentacją Clerk dla klientów natywnych |
| Zapisane klucze użytkownika | RP ID `clerk.auth.blokserwis.pl` | Wcześniejsza autoryzowana kontrola metadanych Proton Pass; w tym researchu nie odczytywano ponownie sejfu |
| Digital Asset Links | FAPI zwraca HTTP 200 i relacje dla `pl.blokserwis` | Odczyt publicznego `/.well-known/assetlinks.json` |
| Related origins na FAPI | `https://clerk.auth.blokserwis.pl/.well-known/webauthn` zwraca 404 | Odczyt HTTP |
| Related origins na domenie głównej | Worker publikuje Chmurę pod `https://auth.blokserwis.pl/.well-known/webauthn` | Kod i HTTP 200 przez curl |

Jedna próba HTTP z Python urllib na domenie głównej dostała 403, kolejna przez curl 200. Przed akceptacją trzeba sprawdzić niezawodne pobieranie pliku przez docelowe przeglądarki oraz reguły ochrony Cloudflare; pojedynczy 200 nie dowodzi dostępności dla wszystkich klientów.

Publiczny schemat `auth_passkey` zawiera przełączniki użycia, autofill i drugiego składnika. Nie znaleziono w nim ustawienia RP ID ani allowlisty originów WebAuthn. To stwierdzenie dotyczy dostępnego schematu, nie dowodzi braku wewnętrznej konfiguracji u dostawcy.

## Przyczyna

Passkey jest przypisany do RP ID użytego przy rejestracji. Wspólna instancja Clerk i identyczny adres e-mail nie zastępują zgodności RP ID. Klucz dla `clerk.auth.blokserwis.pl` nie zostanie dobrany do challenge'u dla `auth.blokserwis.pl`.

Występują dwa niezależne problemy:

1. Przeglądarka na `chmura.blokserwis.pl` musi mieć prawo użycia RP wskazanego przez Clerk. Dla RP `auth.blokserwis.pl` obecny Worker realizuje mechanizm Related Origin Requests w obsługujących go przeglądarkach.
2. RP wskazany przez Clerk musi odpowiadać RP istniejącego klucza. Obecny Worker nie rozwiązuje tego problemu, bo znajduje się pod inną domeną niż RP natywnych kluczy.

Related Origin Requests rozszerza dozwolone originy dla tego samego RP ID. Nie przenosi kluczy pomiędzy RP ID. Zmiana adresu strony, CNAME, nazwy wpisu w Proton Pass albo ręczna podmiana `rpId` w odpowiedzi serwera nie stanowi poprawnej migracji poświadczenia. Serwer musi zweryfikować zarówno RP, podpis i challenge, jak i origin klienta.

Źródła: [Clerk: ograniczenia domen passkeys](https://clerk.com/docs/guides/development/custom-flows/authentication/passkeys), [Clerk: RP klientów natywnych](https://clerk.com/docs/reference/electron/passkeys), [Chrome: Related Origin Requests](https://developer.chrome.com/blog/passkeys-updates-chrome-129).

## Rekomendowany kierunek

Preferowanym kierunkiem po doprecyzowaniu użytkownika jest **centralny ekran WWW i wspólny RP ID `auth.blokserwis.pl`**. Trzeba potwierdzić z Clerk, czy natywny SDK może otrzymywać ten RP przy rejestracji i logowaniu. Publiczny schemat konfiguracji nie udostępnia takiego przełącznika; wykonalność wspólnego RP pozostaje warunkiem do sprawdzenia.

Docelowy przepływ:

```text
Chmura -> auth.blokserwis.pl -> WebAuthn -> Clerk -> powrót do Chmury
Android -> natywny AuthView -> Credential Manager -> Clerk

Obie platformy: docelowy RP = auth.blokserwis.pl
Frontend API: clerk.auth.blokserwis.pl może pozostać adresem API,
             jeżeli Clerk wspiera oddzielny wybór RP.
```

Dla tego wariantu trzeba:

- uzyskać wspieraną konfigurację challenge'ów i rejestracji Androida z RP `auth.blokserwis.pl`;
- opublikować pod `https://auth.blokserwis.pl/.well-known/assetlinks.json` powiązanie z `pl.blokserwis` i właściwymi certyfikatami; plik na FAPI nie zastępuje powiązania dla innego RP;
- wykonywać webowe WebAuthn na `https://auth.blokserwis.pl`, co spełnia relację origin–RP bez Related Origin Requests;
- potwierdzić wspierany przez Clerk powrót i ustanowienie sesji na `chmura.blokserwis.pl`; ta domena leży poza domeną główną instancji `auth.blokserwis.pl`, więc nie zakładać automatycznego współdzielenia sesji;
- obsłużyć dodatkową rejestrację poświadczenia dla nowego RP. Istniejące klucze dla `clerk.auth.blokserwis.pl` nie stają się kluczami dla `auth.blokserwis.pl` po zmianie konfiguracji;
- zapewnić przejście z użyciem dostępnej alternatywnej metody logowania i zweryfikować zachowanie starych kluczy oraz starszych wersji Androida przed wdrożeniem.

Jeśli całe webowe WebAuthn odbywa się na centralnym ekranie, Chmura nie potrzebuje ROR do własnych ceremonii, bo ich nie wykonuje. Aktualnego pliku ROR nie usuwać przed przełączeniem i weryfikacją istniejącego przepływu.

Jeżeli Clerk nie wspiera RP `auth.blokserwis.pl` dla natywnego SDK, wariantem rezerwowym pozostaje **ekran WWW na `auth.blokserwis.pl` z RP `clerk.auth.blokserwis.pl`**. Zachowałby zgodność domeny istniejących kluczy, ale wymaga potwierdzenia web challenge'ów z tym RP, publikacji `/.well-known/webauthn` na FAPI, dopuszczenia originu `https://auth.blokserwis.pl` przez przeglądarkę i weryfikator Clerk oraz testu sesji. To nadal nie jest potwierdzone rozwiązanie.

## Warianty i ich ograniczenia

| Wariant | Istniejące natywne klucze w WWW | Ocena |
| --- | --- | --- |
| Ekran WWW na `auth.blokserwis.pl`, RP `clerk.auth.blokserwis.pl`, potwierdzony przez Clerk | Potencjalnie tak, po dopuszczeniu originów i pełnej weryfikacji | Wariant rezerwowy zachowujący RP istniejących kluczy |
| Ekran WWW i wspólny RP `auth.blokserwis.pl`, potwierdzony przez Clerk również dla Androida | Wymaga dodatkowej rejestracji klucza dla nowego RP | Preferowany przez użytkownika; wymaga potwierdzenia konfiguracji natywnej i ścieżki przejściowej |
| Oddzielny klucz WWW i natywny przy obecnym zachowaniu Clerk | Nie jest to ten sam klucz | Najmniejszy wariant operacyjny, ale nie spełnia celu wspólnego passkey |
| Eksperymentalny login WWW w trybie klienta natywnego | Niepotwierdzone E2E | Wyłącznie eksperyment, nie gotowe rozwiązanie produkcyjne |

Przeniesienie domeny głównej Clerk na `blokserwis.pl` może uprościć zwykłe logowanie WWW na subdomenach. Samo w sobie nie dowodzi wyrównania RP dla native/web i może zmienić FAPI oraz istniejące integracje. Nie jest pierwszym krokiem.

## Eksperyment: co wiemy, czego nie wiemy

W izolowanym kontekście Playwright dodanie `_is_native=true` wyłącznie do requestu utworzenia próby logowania zmienia otrzymany RP ID na `clerk.auth.blokserwis.pl`. Standardowy request zwraca `auth.blokserwis.pl`. Oba zatrzymały się przed uwierzytelnieniem, ze statusem `needs_identifier`.

To dowód sposobu wyboru RP przez API, a nie udanego logowania. Nie wykonano podpisu istniejącym kluczem, akceptacji browser originu przez Clerk, utworzenia sesji ani jej odnowienia. Nie należy wdrażać globalnego dopisywania tego parametru w Chmurze.

Możliwy eksperyment: strona `login.clerk.auth.blokserwis.pl` spełnia warunek domenowy przeglądarki dla RP `clerk.auth.blokserwis.pl` bez Related Origin Requests. Nadal nie rozwiązuje automatycznie wyboru RP przez Clerk ani akceptacji web originu w trybie native. Potrzebuje również wspieranego mechanizmu ustanowienia sesji na Chmurze, która leży poza `auth.blokserwis.pl`. Nie projektować własnego przekazywania bearer tokenów w URL.

Dokumentacja Electron potwierdza użycie FAPI jako RP dla native i możliwość WebAuthn z poprawnego HTTPS originu w rendererze. Nie stanowi deklaracji wsparcia takiego rozwiązania w zwykłej przeglądarce.

Oficjalne proxy FAPI też nie jest automatyczną naprawą RP. Dokumentacja wymaga osobnej subdomeny, jeżeli istnieje już wymagany CNAME. Nie należy przejmować działającego hosta FAPI pod pretekstem dodania jednego pliku. Źródło: [Clerk: proxy FAPI](https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi).

## Pytania techniczne do Clerk

Przygotowany zakres do zgłoszenia; w ramach researchu nie wysyłano wiadomości:

1. Czy wspieracie wspólny RP dla Android SDK 1.1.4 i Clerk JS 6.40.0, gdy native otrzymuje FAPI host, a web domenę główną instancji?
2. Priorytet: czy można ustawić RP `auth.blokserwis.pl` dla natywnych rejestracji i logowania bez browser flow, zachowując FAPI pod obecnym adresem?
3. Czy FAPI może publikować `/.well-known/webauthn`, oraz jak konfiguruje się akceptowane web originy w serwerowej weryfikacji WebAuthn?
4. Jak obsłużyć przejście ze starych kluczy dla FAPI na nowy RP, w tym starsze wersje aplikacji? Rezerwowo: czy web RP może pozostać równy FAPI, przy ekranie WWW na `auth.blokserwis.pl`?
5. Jaki mechanizm Clerk wspiera dla loginu na `auth.blokserwis.pl` i powrotu z sesją do `chmura.blokserwis.pl`? Osobno, wyłącznie dla wariantu eksperymentalnego: czy zwykła strona HTTPS może korzystać z native API?

Do zgłoszenia wystarczą domeny, wersje SDK i zanonimizowane pola RP z challenge'ów. Nie dołączać tokenów, podpisów ani prywatnych danych Proton Pass.

## Kolejność prac

### 1. Potwierdzenie kontraktu i mały test wykonalności

- Uzyskać odpowiedzi powyżej; ustalić docelowy RP i wspierane API.
- Przygotować izolowane konto testowe oraz możliwość sprzątnięcia go po teście.
- Zarejestrować klucz natywnie i potwierdzić logowanie tym samym kluczem w WWW; wykonać również test odwrotny.
- Zakończyć pełnym `signIn.status = complete`, aktywną sesją i autoryzowanym requestem do API Chmury. Samo otwarcie systemowego wyboru klucza nie wystarcza.
- Gdy wspólny RP wymaga ponownej rejestracji, wcześniej opisać zachowanie starych kluczy i alternatywną metodę wejścia. Nie usuwać istniejących kluczy.

### 2. Domknięcie konfiguracji domen

- Opublikować wymagane pliki pod rzeczywistym RP, z HTTP 200, prawidłowym JSON i bez challenge Cloudflare.
- Zweryfikować Android package i certyfikat faktycznej instalacji, w tym Play App Signing, jeśli dystrybucja odbywa się przez Play.
- Sprawdzić originy FAPI, CORS oraz backendowe `authorizedParties` zgodnie z wybranym przepływem; nie zakładać, że sama zgodność cookies rozwiązuje domeny.
- Zachować działające logowanie natywne podczas wdrożenia i zapewnić wycofanie web zmiany bez migracji danych użytkowników.

Źródła: [Android: Digital Asset Links](https://developer.android.com/identity/credential-manager/prerequisites), [Clerk: wdrożenie i domeny](https://clerk.com/docs/guides/development/deployment/production).

### 3. Ujednolicenie interfejsu

- Przygotować centralny formularz na `auth.blokserwis.pl`: wspólne kolory, ciemny/jasny motyw, polskie teksty i brak poziomego przewijania na 320–430 px. Chmura kieruje do niego z kontrolowanym adresem powrotu.
- Obsłużyć długie błędy Clerk zawijaniem tekstu oraz czytelnym komunikatem użytkowym. Anulowanie systemowego okna rozróżnić od błędu konfiguracji RP.
- W Androidzie zachować `AuthView` i Credential Manager. Ewentualne zmiany ograniczyć do wspieranej konfiguracji SDK i spójnego brandingu.
- Centralny ekran WWW wdrożyć po potwierdzeniu wybranego RP i sesji. Zastąpiłby obecny redirect domeny głównej; nie byłby otwierany przez Androida przy passkey login.

### 4. Odbiór

| Próba | Wymagany wynik |
| --- | --- |
| Istniejący klucz Proton Pass -> Android | Natywne logowanie nadal działa |
| Istniejący klucz -> Chrome WWW | Wariant zachowujący stary RP: pełne logowanie; przy nowym RP: poprawne wejście alternatywne i dodatkowa rejestracja, bez obietnicy użycia starego klucza |
| Nowy klucz z Androida -> WWW | Ten sam klucz działa bez ponownej rejestracji |
| Nowy klucz z WWW -> Android | Ten sam klucz dostępny przez Credential Manager |
| Restart, odnowienie sesji, wylogowanie | Zachowanie zgodne z polityką każdej aplikacji |
| Google/hasło | Alternatywne wejście do tego samego konta, zgodne z obecną konfiguracją |
| Brak klucza/anulowanie | Czytelny stan bez błędu konfiguracji |
| Chrome/Edge/Safari/Firefox w wybranych wersjach | Sprawdzona obsługa lub jawnie ustalona alternatywa przy braku ROR |
| Obcy origin, niedozwolony powrót | Odrzucone; brak tokenów w URL |
| Motywy i mały ekran | Czytelny kontrast, brak obcięcia karty i błędów |

Passkey E2E wymaga prawdziwego fizycznego Androida i dostawcy poświadczeń. Wirtualny authenticator w przeglądarce pomaga sprawdzić protokół, ale nie zastępuje testu Proton Pass i Credential Manager.

## Zakres przyszłych zmian w repozytoriach

- Chmura: `src/lib/clerk-ui.ts`, `src/routes/+layout.svelte`, istniejące testy Clerk oraz `e2e/sign-in.spec.ts`; obsługa przekierowania do centralnego loginu WWW i zweryfikowanego powrotu z sesją.
- Worker: `workers/auth-domain/` tylko w zakresie wynikającym z docelowego RP i miejsca wykonywania WebAuthn. Aktualny Worker domeny głównej nie obsługuje hosta FAPI.
- Android: `ClerkLoginScreen.kt` i inicjalizacja Clerk tylko jeśli wspierany kontrakt wymaga zmiany; bez zastępowania natywnego ekranu stroną WWW.
- Backend: walidacja sesji i dozwolonych originów; osobny kontrakt przekazania sesji wyłącznie jeśli potwierdzony wariant go wymaga. Konta i istniejące identyfikatory użytkowników pozostają w tej samej instancji Clerk.

W tym researchu nie zmieniano kodu produktu, konfiguracji Clerk ani wdrożeń. Utworzono wyłącznie ten dokument. Wcześniejsze poprawki formularza i Worker są odrębnym stanem prac; nie są dowodem naprawy wspólnych passkeys.
