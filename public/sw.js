// Minimal service worker — makes the app installable.
// No caching: P1 Dash needs live data at all times.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
