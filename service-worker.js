/* ============================================================
   Service worker : rend l'appli utilisable hors connexion.
   - « Réseau d'abord » : avec internet, on charge toujours la dernière version
     publiée (et on met la copie de secours à jour au passage).
   - Sans internet (ou réseau trop lent), on sert la copie de secours.
   - VERSION : à changer à chaque mise à jour, pour renouveler la copie de secours.
   ============================================================ */
const VERSION = 'v3.14.0';
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
  'fonts/dm-serif-display-latin.woff2',
  'fonts/dm-serif-display-latin-ext.woff2',
  'fonts/dm-serif-display-italic-latin.woff2',
  'fonts/dm-serif-display-italic-latin-ext.woff2',
  'fonts/dm-sans-latin.woff2',
  'fonts/dm-sans-latin-ext.woff2',
];

// Délai au-delà duquel on se rabat sur la copie de secours (réseau très lent en magasin)
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting(); // la nouvelle version prend la main tout de suite, sans attendre
});

self.addEventListener('activate', event => {
  // Supprime les copies des anciennes versions
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Compatibilité avec les anciennes versions de l'appli (bouton « Mettre à jour »)
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

function fromNetwork(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('lent')), NETWORK_TIMEOUT);
    fetch(request, { cache: 'no-cache' }).then(response => {
      clearTimeout(timer);
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      resolve(response);
    }, err => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  // Seuls les fichiers de l'appli passent ici ; les API (Open Food Facts…) restent en direct
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    fromNetwork(request).catch(() =>
      caches.match(request, { ignoreSearch: true }).then(cached => cached || caches.match('index.html'))),
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
      const url = event.notification.data.url;
      const open = list.find(c => 'focus' in c);
      if (!open) return self.clients.openWindow(url);
      // L'appli est déjà ouverte : on l'amène sur la bonne page (ex. le quiz)
      return (url.includes('quiz=1') && 'navigate' in open ? open.navigate(url) : Promise.resolve(open)).then(c => (c || open).focus());
    }),
  );
});
