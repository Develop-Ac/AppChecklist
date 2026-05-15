"use strict";

const CACHE_VERSION = "model-viewer-cache-v1";
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(STATIC_ASSETS);

      try {
        const response = await fetch(MODEL_VIEWER_URL, { cache: "no-cache" });
        if (response && (response.ok || response.type === "opaque")) {
          await cache.put(MODEL_VIEWER_URL, response.clone());
        }
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
  const url = new URL(request.url);

  const isModelViewerScript =
    url.origin === "https://unpkg.com" &&
    url.pathname === "/@google/model-viewer@3.3.0/dist/model-viewer.min.js";

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
  }
});
