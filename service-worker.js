/* ============================================================
   Service worker : rend l'appli utilisable hors connexion.
   - À l'installation, on met en cache tous les fichiers de l'appli.
   - Ensuite, l'appli est servie depuis ce cache (instantané, même sans réseau).
   - À CHAQUE MISE À JOUR DE L'APPLI, IL FAUT CHANGER « VERSION » CI-DESSOUS :
     le navigateur détecte alors le nouveau service worker, l'appli affiche
     « Nouvelle version disponible » et recharge les nouveaux fichiers.
   ============================================================ */
const VERSION = 'v2.1.0';
const CACHE = `menu-proteine-${VERSION}`;

const FILES = [
  './',
  'index.html',
  'style.css',
  'fonts.css',
  'data.js',
  'drive-stock.js',
  'app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/logo.svg',
  'fonts/cormorant-garamond-latin.woff2',
  'fonts/cormorant-garamond-latin-ext.woff2',
  'fonts/cormorant-garamond-italic-latin.woff2',
  'fonts/cormorant-garamond-italic-latin-ext.woff2',
  'fonts/dm-sans-latin.woff2',
  'fonts/dm-sans-latin-ext.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  // On n'active pas tout de suite : l'appli propose d'abord la mise à jour
});

self.addEventListener('activate', event => {
  // Supprime les caches des anciennes versions
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// L'appli demande à passer à la nouvelle version (bouton « Mettre à jour »)
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  // Seuls les fichiers de l'appli passent par le cache ; les API (Open Food Facts…) restent en ligne
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true })
      .then(cached => cached || fetch(request))
      .catch(() => caches.match('index.html')),
  );
});

// ---------- Notifications push (rappels d'eau envoyés par GitHub Actions)
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "💧 Un verre d'eau ?", {
    body: data.body || "Pense à boire un verre d'eau.",
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'rappel-eau', // un nouveau rappel remplace le précédent au lieu de s'empiler
    data: { url: data.url || './' },
  }));
});

// Toucher la notification ouvre l'appli
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list.find(c => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow(event.notification.data.url);
    }),
  );
});
