/* SayDim Service Worker: Offline-first data and image caching (ESP32 HTTP)
   Strategy summary:
   - App shell: cache on install (pages, css, js)
   - /asset/* images: cache-first (serve real cached images offline)
   - /api/* data: network-first, fallback to last cached JSON when offline
   - Message 'refresh-offline': fetch dimensions and characters + related images, store in cache
*/

const SW_VERSION = "1.0.0";
const APP_SHELL_CACHE = `saydim-shell-${SW_VERSION}`;
const DATA_CACHE = `saydim-data-${SW_VERSION}`;
const ASSET_CACHE = `saydim-asset-${SW_VERSION}`;

const APP_SHELL = [
  "index.html",
  "dimension.html",
  "character.html",
  "add.html",
  "css/styles.css",
  "js/app.js",
  "js/mock.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      await cache.addAll(APP_SHELL);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (!k.includes(SW_VERSION)) return caches.delete(k);
        })
      );
      self.clients.claim();
    })()
  );
});

function isAsset(req) {
  return new URL(req.url).pathname.startsWith("/asset/");
}
function isAPI(req) {
  const p = new URL(req.url).pathname;
  return p.startsWith("/api/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigate requests: return cached page if offline
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(request);
          // keep the page fresh in shell cache
          const shell = await caches.open(APP_SHELL_CACHE);
          shell.put(url.pathname, net.clone());
          return net;
        } catch (e) {
          const shell = await caches.open(APP_SHELL_CACHE);
          const cached =
            (await shell.match(url.pathname)) ||
            (await shell.match("index.html"));
          return cached || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Assets: cache-first (real images only)
  if (isAsset(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request, { cache: "no-store" });
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch (e) {
          return cached || new Response("", { status: 504 });
        }
      })()
    );
    return;
  }

  // API: network-first, fallback to cache
  if (isAPI(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA_CACHE);
        try {
          const res = await fetch(request, { cache: "no-store" });
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch (e) {
          const cached = await cache.match(request);
          return (
            cached ||
            new Response("[]", {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
      })()
    );
    return;
  }

  // Default: try network, fallback to shell cache
  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch (e) {
        const shell = await caches.open(APP_SHELL_CACHE);
        return (
          (await shell.match(request)) || new Response("", { status: 504 })
        );
      }
    })()
  );
});

// Background refresh of offline cache (dimensions, characters, and their images)
async function refreshOffline() {
  let ok = true;
  const dataCache = await caches.open(DATA_CACHE);
  const assetCache = await caches.open(ASSET_CACHE);
  // Fetch data
  const endps = ["/api/dimensions", "/api/characters"];
  const results = [];
  for (const ep of endps) {
    try {
      const r = await fetch(ep, { cache: "no-store" });
      if (r.ok) {
        await dataCache.put(ep, r.clone());
        results.push(await r.clone().json());
      } else ok = false;
    } catch (e) {
      ok = false;
    }
  }
  // Cache images referenced by data
  try {
    const dims = Array.isArray(results[0]) ? results[0] : [];
    const chars = Array.isArray(results[1]) ? results[1] : [];
    const urls = [];
    for (const d of dims)
      if (d && d.image)
        urls.push(d.image.startsWith("/asset/") ? d.image : "/asset" + d.image);
    for (const c of chars)
      if (c && c.foto)
        urls.push(c.foto.startsWith("/asset/") ? c.foto : "/asset" + c.foto);
    // Deduplicate
    const uniq = Array.from(new Set(urls));
    for (const u of uniq) {
      try {
        const r = await fetch(u, { cache: "no-store" });
        if (r.ok) await assetCache.put(u, r.clone());
        else ok = false;
      } catch (e) {
        ok = false;
      }
    }
  } catch (e) {
    ok = false;
  }
  return ok;
}

self.addEventListener("message", (event) => {
  const { data, ports } = event;
  if (data && data.type === "refresh-offline") {
    refreshOffline()
      .then((ok) => ports && ports[0] && ports[0].postMessage({ ok }))
      .catch(() => ports && ports[0] && ports[0].postMessage({ ok: false }));
  }
});
