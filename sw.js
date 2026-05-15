"use strict";

const CACHE_VERSION = "model-viewer-cache-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/offline-db.js",
  "/app-config.js",
  "/models/carro.glb",
];

const MODEL_VIEWER_URL = "https://unpkg.com/@google/model-viewer@3.3.0/dist/model-viewer.min.js";

function deveTratarComoAssetLocal(url, request) {
  if (url.origin !== self.location.origin) return false;
  if (request.mode === "navigate") return true;
  if (request.destination === "script" || request.destination === "style") return true;
  if (request.destination === "image" || request.destination === "font") return true;
  return false;
}

async function cachearUrls(urls = []) {
  const cache = await caches.open(CACHE_VERSION);
  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const req = new Request(url, { mode: url.startsWith("http") ? "no-cors" : "same-origin" });
        const res = await fetch(req, { cache: "reload" });
        if (res && (res.ok || res.type === "opaque")) {
          await cache.put(url, res.clone());
        }
      } catch (err) {
        console.warn("SW: falha ao cachear URL", url, err);
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(STATIC_ASSETS);

      try {
        await cachearUrls([MODEL_VIEWER_URL]);
      } catch (error) {
        // Sem conectividade no install: o arquivo sera armazenado depois via fetch runtime.
        console.warn("SW: falha ao pre-cache do model-viewer", error);
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  const isModelViewerScript =
    url.origin === "https://unpkg.com" &&
    url.pathname.includes("/@google/model-viewer@") &&
    url.pathname.endsWith("/dist/model-viewer.min.js");

  const isLocalModelGlb =
    url.origin === self.location.origin && url.pathname.endsWith("/models/carro.glb");

  if (isModelViewerScript || isLocalModelGlb) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(request.url) || await cache.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response && (response.ok || response.type === "opaque")) {
            await cache.put(request.url, response.clone());
          }
          return response;
        } catch (_) {
          // Sem fallback alternativo para GLB/script ausente em primeiro acesso totalmente offline.
          throw _;
        }
      })()
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const respostaRede = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          cache.put("/index.html", respostaRede.clone());
          return respostaRede;
        } catch {
          const cache = await caches.open(CACHE_VERSION);
          const paginaOffline =
            (await cache.match("/index.html")) ||
            (await cache.match("/"));
          if (paginaOffline) return paginaOffline;
          return new Response("Offline: pagina inicial indisponivel no cache.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })()
    );
    return;
  }

  if (deveTratarComoAssetLocal(url, request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return new Response("Offline: recurso indisponivel no cache.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })()
    );
  }
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CACHE_MODEL_3D_ASSETS") {
    const urls = Array.isArray(data.urls) ? data.urls : [];
    event.waitUntil(cachearUrls(urls));
  }
});
