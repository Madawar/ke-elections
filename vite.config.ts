import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { existsSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, lazyPlugins } from 'vite-plus';

export default defineConfig({
    plugins: lazyPlugins(() => [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.ts'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        inertia(),
        tailwindcss(),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
        wayfinder({
            formVariants: true,
        }),
        // Installable app + offline boundaries (Task 10). The service worker lives at /sw.js
        // with scope / while the bundle stays in /build/. Boundaries, units.json and glyphs are
        // precached (cache-first): the app asks for them with a content hash in ?v=, which the
        // precache ignores, and the precached manifest.json keeps those hashes in step with
        // the files. Holder data and pages are network-first so they stay fresh online and
        // still load offline.
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: false,
            outDir: 'public',
            filename: 'sw.js',
            scope: '/',
            base: '/',
            // buildBase is where the plugin's own files (sw.js, the manifest) are served, not
            // the bundle: '/build/' would register /build/sw.js, which does not exist.
            buildBase: '/',
            manifestFilename: 'manifest.webmanifest',
            includeManifestIcons: false,
            manifest: {
                id: '/',
                name: 'Kenya Electoral Map',
                short_name: 'Electoral Map',
                description:
                    "Kenya's 47 counties, 290 constituencies and 1,450 wards, with the seats they elect.",
                lang: 'en',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                theme_color: '#EEF1EF',
                background_color: '#EEF1EF',
                icons: [
                    {
                        src: '/icons/pwa-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/icons/pwa-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '/icons/maskable-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                globDirectory: fileURLToPath(
                    new URL('public', import.meta.url),
                ),
                globPatterns: [
                    // .mjs: MapLibre's worker, which the map cannot draw without
                    'build/**/*.{js,mjs,css,woff2}',
                    'boundaries/*.{geojson,json}',
                    'glyphs/**/*.pbf',
                    'icons/*.{png,svg}',
                ],
                // Optional overlays load only when switched on, so they are cached on first use
                // instead of making every install download them (see runtimeCaching).
                globIgnores: ['boundaries/stations.geojson'],
                // Hashed bundle files need no revision check.
                dontCacheBustURLsMatching: /^build\/assets\//,
                ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
                navigateFallback: null,
                maximumFileSizeToCacheInBytes: 3_000_000,
                cleanupOutdatedCaches: true,
                // Clears the "pages" cache when a new worker activates (see the file).
                importScripts: ['/sw-reset-pages.js'],
                clientsClaim: true,
                skipWaiting: true,
                runtimeCaching: [
                    {
                        // Hashed bundle files a saved page refers to, kept as they are used:
                        // after a deploy the old worker can save a new page before the new
                        // precache installs, and that page must still find its scripts.
                        urlPattern: ({ url }) =>
                            url.pathname.startsWith('/build/assets/'),
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'assets',
                            expiration: {
                                maxEntries: 200,
                                maxAgeSeconds: 60 * 60 * 24 * 60,
                            },
                            cacheableResponse: { statuses: [200] },
                        },
                    },
                    {
                        urlPattern: ({ url }) =>
                            url.pathname === '/boundaries/stations.geojson',
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'overlays',
                            expiration: { maxEntries: 8 },
                            cacheableResponse: { statuses: [200] },
                        },
                    },
                    {
                        // Only the public map pages: never admin, account or login pages.
                        urlPattern: ({ request, url }) =>
                            request.mode === 'navigate' &&
                            /^\/((county|constituency|ward)\/\d+|party\/[a-z0-9]+(-[a-z0-9]+)*)?$/i.test(
                                url.pathname,
                            ),
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'pages',
                            networkTimeoutSeconds: 3,
                            expiration: { maxEntries: 50 },
                            cacheableResponse: { statuses: [200] },
                            plugins: [
                                {
                                    // Only a signed-out copy is ever stored: pages embed the
                                    // signed-in user, and the server marks guest responses
                                    // (App\\Http\\Middleware\\MarkPublicPage).
                                    cacheWillUpdate: async ({ response }) =>
                                        response.headers.get(
                                            'X-Public-Page',
                                        ) === '1'
                                            ? response
                                            : null,
                                },
                                {
                                    // Offline and never visited: open the saved home page
                                    // rather than the browser's error page.
                                    handlerDidError: async () =>
                                        (await caches.match('/', {
                                            cacheName: 'pages',
                                        })) ?? undefined,
                                },
                            ],
                        },
                    },
                    {
                        urlPattern: ({ url }) =>
                            url.pathname === '/data/seats.json',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'seats',
                            networkTimeoutSeconds: 3,
                            expiration: { maxEntries: 4 },
                            cacheableResponse: { statuses: [200] },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/tiles\.openfreemap\.org\//,
                        handler: 'NetworkOnly',
                    },
                ],
            },
        }),
        {
            // vite-plugin-pwa emits the web manifest into the bundle dir (public/build/), but
            // precaches and serves it as /manifest.webmanifest: move it next to sw.js.
            name: 'ke:web-manifest-to-public',
            apply: 'build',
            closeBundle() {
                const at = (p: string) =>
                    fileURLToPath(new URL(p, import.meta.url));
                const built = at('public/build/manifest.webmanifest');
                if (existsSync(built))
                    renameSync(built, at('public/manifest.webmanifest'));
            },
        },
    ]),
    server: {
        watch: {
            ignored: [
                '**/.agents/**',
                '**/.claude/**',
                '**/.cursor/**',
                '**/.junie/**',
                '**/vendor/**',
            ],
        },
    },
    lint: {
        ignorePatterns: [
            'vendor/**',
            'node_modules/**',
            'public/**',
            'bootstrap/ssr/**',
            'tailwind.config.js',
            'resources/js/actions/**',
            'resources/js/components/ui/*',
            'resources/js/routes/**',
            'resources/js/wayfinder/**',
        ],
        options: {
            denyWarnings: true,
            typeAware: true,
        },
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        ignorePatterns: [
            '.github/**',
            'composer.json',
            'resources/js/components/ui/*',
            'resources/views/mail/*',
        ],
        sortTailwindcss: {
            functions: ['clsx', 'cn', 'cva'],
            stylesheet: 'resources/css/app.css',
        },
    },
});
