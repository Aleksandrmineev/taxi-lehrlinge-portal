self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A fetch handler makes the portal installable without taking control of its data requests.
self.addEventListener("fetch", () => {});
