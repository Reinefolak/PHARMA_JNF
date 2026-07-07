const CACHE_NAME = 'pharmalink-v1';
const ASSETS_TO_CACHE = [
  './',
  './livreur.html',
  './tournee.html',
  './commande_livreur.html',
  './auth.js',
  './script.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Installation du Service Worker et mise en cache des ressources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Mise en cache initiale');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => !cacheWhitelist.includes(cacheName))
          .map((cacheName) => {
            console.log("[Service Worker] Suppression de l'ancien cache", cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes réseau (Stale-While-Revalidate modifié pour le hors-ligne)
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET ou avec des protocoles non supportés (ex: chrome-extension://)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. Retourner le cache s'il existe
      if (cachedResponse) {
        // En arrière-plan, on met à jour le cache (si connexion disponible)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => { /* Hors-ligne, on ignore */ });
        return cachedResponse;
      }

      // 2. Si pas en cache, on fetch depuis le réseau
      return fetch(event.request).then((networkResponse) => {
        // Ne mettre en cache que les réponses valides
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.status !== 0)) {
          return networkResponse;
        }
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        // 3. Mode hors-ligne strict
        if (event.request.mode === 'navigate') {
          return caches.match('./livreur.html');
        }
        // Retourner une erreur générique pour éviter l'erreur console "resolved with undefined"
        return new Response('Hors-ligne', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
