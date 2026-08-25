/* Quizey — service worker — 2026-08-25 (spec docs/2026-08-25-pwa-design.md).
   App shell en pré-cache à l'install, stratégie cache-first + repli réseau,
   version de cache incrémentationnable (les anciens sont purgés à l'activate),
   interception RESTREINTE aux GET de même origine. Zéro dépendance.

   MAJ du cache : incrémenter la constante CACHE ci-dessous (ex. "quizey-v3") —
   à la prochaine activation, l'ancienne cache est supprimée automatiquement.

   Historique : quizey-v1 (premier cache) → quizey-v2 (2026-08-25 : boutons
   topbar/compacité mobile + écart stats→Entraînement libre). */

const CACHE = "quizey-v2";

/* L'app shell : tout ce qui fait tourner l'app hors ligne. Chemins RELATIFS
   (le site est servi sous /Quizey/). index.html = redirect → Quizey.html. */
const APP_SHELL = [
  "./",
  "./index.html",
  "./Quizey.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

/* INSTALL — pré-cache de l'app shell. On ne force PAS skipWaiting() : la
   nouvelle version s'active à la prochaine navigation, pas en pleine session. */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
});

/* ACTIVATE — purge des anciennes caches + prise de contrôle des onglets. */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* FETCH — cache-first, repli réseau, mémorisation. GET même origine uniquement. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                    // on ne met en cache que les GET
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;     // même origine : les polices Google
                                                       // passent au réseau (échec silencieux
                                                       // hors ligne → repli stacks système)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;                        // hit → servi hors ligne
      return fetch(req).then((res) => {
        if (res && res.ok) {                            // miss → réseau + mémo
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
