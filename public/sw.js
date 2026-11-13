// Service worker mínimo: torna o app instalável.
// Não guarda dados em cache — as horas sempre vêm do servidor.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
