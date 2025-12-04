const CACHE_NAME = "chmura-blokserwis-v1";
const STATIC_CACHE = "chmura-static-v1";
const DYNAMIC_CACHE = "chmura-dynamic-v1";

// Pliki do cache'owania statycznie
const STATIC_FILES = [
  "/",
  "/storage",
  "/login",
  "/admin-panel",
  "/manifest.json",
  "/icons/icon-192x192.svg",
  "/icons/icon-512x512.svg",
  "/favicon.svg",
];

// Strategie cache'owania
const CACHE_STRATEGIES = {
  // Cache First dla statycznych zasobów
  CACHE_FIRST: "cache-first",
  // Network First dla API
  NETWORK_FIRST: "network-first",
  // Stale While Revalidate dla dynamicznych zasobów
  STALE_WHILE_REVALIDATE: "stale-while-revalidate",
};

// Instalacja service workera
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing...");

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("Service Worker: Caching static files");
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log("Service Worker: Static files cached");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("Service Worker: Error caching static files:", error);
      })
  );
});

// Aktywacja service workera
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log("Service Worker: Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("Service Worker: Activated");
        return self.clients.claim();
      })
  );
});

// Interceptowanie żądań
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Pomiń nie-GET żądania
  if (request.method !== "GET") {
    return;
  }

  // Pomiń żądania do zewnętrznych domen
  if (url.origin !== self.location.origin) {
    return;
  }

  // Strategia dla różnych typów zasobów
  if (url.pathname.startsWith("/api/")) {
    // Network First dla API
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.startsWith("/_next/") || url.pathname.includes(".")) {
    // Cache First dla statycznych zasobów
    event.respondWith(handleStaticRequest(request));
  } else {
    // Stale While Revalidate dla stron
    event.respondWith(handlePageRequest(request));
  }
});

// Obsługa żądań API (Network First)
async function handleApiRequest(request) {
  try {
    // Próbuj sieć
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache'uj udane odpowiedzi
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("Service Worker: Network failed for API, trying cache");

    // Fallback do cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback do offline page
    return new Response(
      JSON.stringify({ error: "Offline - brak połączenia z serwerem" }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Obsługa statycznych zasobów (Cache First)
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("Service Worker: Failed to fetch static resource:", error);

    // Fallback dla obrazów
    if (request.destination === "image") {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f3f4f6"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="#9ca3af" font-family="Arial" font-size="14">Brak obrazu</text></svg>',
        {
          headers: { "Content-Type": "image/svg+xml" },
        }
      );
    }

    throw error;
  }
}

// Obsługa stron (Stale While Revalidate)
async function handlePageRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  // Zwróć cache'owaną odpowiedź jeśli istnieje
  if (cachedResponse) {
    // W tle zaktualizuj cache
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          cache.put(request, networkResponse);
        }
      })
      .catch(() => {
        // Ignoruj błędy aktualizacji cache
      });

    return cachedResponse;
  }

  // Jeśli nie ma w cache, pobierz z sieci
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("Service Worker: Failed to fetch page:", error);

    // Fallback do offline page
    return caches.match("/offline.html");
  }
}

// Obsługa push notifications
self.addEventListener("push", (event) => {
  console.log("Service Worker: Push received");

  const options = {
    body: event.data
      ? event.data.text()
      : "Nowe powiadomienie z Chmura Blokserwis",
    icon: "/icons/icon-192x192.svg",
    badge: "/icons/icon-192x192.svg",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "explore",
        title: "Otwórz aplikację",
        icon: "/icons/icon-192x192.svg",
      },
      {
        action: "close",
        title: "Zamknij",
        icon: "/icons/icon-192x192.svg",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification("Chmura Blokserwis", options)
  );
});

// Obsługa kliknięć w powiadomienia
self.addEventListener("notificationclick", (event) => {
  console.log("Service Worker: Notification clicked");

  event.notification.close();

  if (event.action === "explore") {
    event.waitUntil(clients.openWindow("/storage"));
  } else if (event.action === "close") {
    // Nic nie rób, powiadomienie już zamknięte
  } else {
    // Domyślne działanie - otwórz aplikację
    event.waitUntil(clients.openWindow("/storage"));
  }
});

// Obsługa synchronizacji w tle
self.addEventListener("sync", (event) => {
  console.log("Service Worker: Background sync triggered");

  if (event.tag === "background-sync") {
    event.waitUntil(doBackgroundSync());
  }
});

// Funkcja synchronizacji w tle
async function doBackgroundSync() {
  try {
    // Tutaj można dodać logikę synchronizacji
    // np. wysyłanie danych offline, aktualizacja cache
    console.log("Service Worker: Background sync completed");
  } catch (error) {
    console.error("Service Worker: Background sync failed:", error);
  }
}

// Obsługa wiadomości od klienta
self.addEventListener("message", (event) => {
  console.log("Service Worker: Message received:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
