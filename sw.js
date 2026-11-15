/* Our Library service worker.
   Purpose: lets the app be installed and gives a fallback page if the network is down.
   It only touches files from this site. It never intercepts Firebase, Google Books,
   Open Library, Hardcover or font requests, so login and library data are never cached here.
   Network first: you always get the newest index.html when online.
   To force a clean cache after a big update, change the version number below. */
const CACHE = "our-library-shell-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
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
