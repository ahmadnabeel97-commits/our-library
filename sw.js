/* Our Library service worker.
   Purpose: lets the app be installed and gives a fallback page if the network is down.
   Network first for this site's own files: you always get the newest index.html when online.
   One narrow exception (Stage 6E): the Firebase SDK script files from
   https://www.gstatic.com/firebasejs/ are saved too, so the app can start with no internet.
   They are version-pinned (for example /13.2.0/), so a saved copy never goes stale.
   It never intercepts Firebase data or login traffic, Google Books, Open Library, Hardcover or fonts,
   so login and library data are never cached here.
   To force a clean cache after a big update, change the version numbers below. */
const CACHE = "our-library-shell-v2";
const SDK_CACHE = "our-library-sdk-v1";
const SDK_PREFIX = "https://www.gstatic.com/firebasejs/";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== SDK_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Firebase SDK script files only: saved copy first, otherwise fetch and save.
  if (url.href.startsWith(SDK_PREFIX) && url.pathname.endsWith(".js")) {
    event.respondWith(
      caches.open(SDK_CACHE).then((cache) =>
        cache.match(request).then((hit) => hit || fetch(request).then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        }))
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request.mode === "navigate" ? "index.html" : request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || (request.mode === "navigate" ? caches.match("index.html") : undefined)))
  );
});
