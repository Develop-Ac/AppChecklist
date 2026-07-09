"use strict";

const CACHE_VERSION = "model-viewer-cache-v4";
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

// Dependências de CDN externas que o app precisa funcionando OFFLINE (tablet
// instalado). Precarregadas no install e servidas cache-first no fetch. Sem
// isto, abrir offline quebraria (Tailwind/jsPDF/html2canvas ausentes).
const EXTERNAL_ASSETS = [
  MODEL_VIEWER_URL,
  "https://cdn.tailwindcss.com",
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
];

// Predicado: esta requisição é uma das CDNs externas que cacheamos offline?
function ehAssetExternoCacheavel(url) {
  if (url.host === "cdn.tailwindcss.com") return true; // runtime JIT (path varia)
  const base = url.origin + url.pathname;
  return EXTERNAL_ASSETS.some((u) => base === u || url.href === u);
}

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
        await cachearUrls(EXTERNAL_ASSETS);
      } catch (error) {
        // Sem conectividade no install: os arquivos serao armazenados depois via fetch runtime.
        console.warn("SW: falha ao pre-cache das CDNs externas", error);
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

  const isExternalCdn = ehAssetExternoCacheavel(url);

  const isLocalModelGlb =
    url.origin === self.location.origin && url.pathname.endsWith("/models/carro.glb");

  if (isExternalCdn || isLocalModelGlb) {
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
