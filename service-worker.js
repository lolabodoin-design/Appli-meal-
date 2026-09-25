/* ============================================================
   Service worker : rend l'appli utilisable hors connexion.
   - À l'installation, on met en cache tous les fichiers de l'appli.
   - Ensuite, l'appli est servie depuis ce cache (instantané, même sans réseau).
   - À CHAQUE MISE À JOUR DE L'APPLI, IL FAUT CHANGER « VERSION » CI-DESSOUS :
     le navigateur détecte alors le nouveau service worker, l'appli affiche
     « Nouvelle version disponible » et recharge les nouveaux fichiers.
   ============================================================ */
const VERSION = 'v1.2.0';
const CACHE = `menu-proteine-${VERSION}`;

const FILES = [
  './',
  'index.html',
  'style.css',
  'fonts.css',
  'data.js',
  'drive-stock.js',
  'app.js',
  'bg-pattern.svg',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'fonts/fredoka-latin.woff2',
  'fonts/fredoka-latin-ext.woff2',
  'fonts/nunito-latin.woff2',
  'fonts/nunito-latin-ext.woff2',
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
