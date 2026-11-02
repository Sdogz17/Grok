const CACHE = "mandarin-v2";
const BASE = new URL("./", self.location);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"].map(async (path) => {
          try {
            await cache.add(new URL(path, BASE).href);
          } catch {
            // One missing file must not stop the app from installing.
          }
        }),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("mandarin-") && key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Health is a separate app at /Grok/health/ with its own service worker.
  if (url.pathname.startsWith("/Grok/health")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await cache.match(new URL("./", BASE).href));
    return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
