/* Command-centre install shell. Network only. No cache of CRM data and no external calls. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  /* The listener is enough for a browser install prompt. The request stays on the network. */
});
