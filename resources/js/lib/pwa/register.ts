/// <reference types="vite-plugin-pwa/client" />
// Registers the service worker built by vite-plugin-pwa (public/sw.js, scope /) and mounts the
// offline banner. In `vp dev` the virtual module is a no-op, so only built assets register it.
import { createApp } from 'vue';
import { registerSW } from 'virtual:pwa-register';
import OfflineBanner from '@/components/OfflineBanner.vue';
import { PAGES_CACHE, warmPages } from '@/lib/pwa/warmPages';

/** Resolves once the active worker has finished activating (which clears the pages cache). */
async function whenActivated(): Promise<void> {
    const sw = (await navigator.serviceWorker.ready).active;
    if (!sw || sw.state === 'activated') return;
    await new Promise<void>((done) =>
        sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') done();
        }),
    );
}

export function initializePwa(): void {
    if (import.meta.env.DEV) {
        // A worker left over from a production build would keep serving its precached
        // boundaries while you work on them: remove it during `vp dev`.
        void navigator.serviceWorker
            ?.getRegistrations()
            .then((regs) => regs.forEach((r) => void r.unregister()));
    } else
        registerSW({
            immediate: true,
            onRegisteredSW: () => {
                void whenActivated()
                    .then(() => caches.open(PAGES_CACHE))
                    .then((cache) => warmPages(cache, location.pathname))
                    .catch(() => {});
            },
        });

    // Its own tiny app beside the Inertia root, so every page gets it without touching layouts.
    const el = document.createElement('div');
    document.body.appendChild(el);
    createApp(OfflineBanner).mount(el);
}
