// Imported by public/sw.js (vite.config.ts, workbox.importScripts). Saved pages point at the
// hashed bundle files of the build they came from, and a new service worker drops those files
// from its precache when it activates. Drop the saved pages with them, so an offline visit never
// opens a page whose scripts are gone; the app saves fresh copies (lib/pwa/warmPages.ts).
self.addEventListener('activate', (event) => {
    event.waitUntil(caches.delete('pages'));
});
