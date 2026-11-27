// Checks the built service worker and web app manifest (R6: run after `npm run build`, as CI
// does; fails loudly when the build output is missing rather than skipping).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PUBLIC = resolve(__dirname, '../../../public');
const SW = resolve(PUBLIC, 'sw.js');
const MANIFEST = resolve(PUBLIC, 'manifest.webmanifest');

function swSource(): string {
    if (!existsSync(SW))
        throw new Error(
            'public/sw.js is missing: run `npm run build` before the JS tests.',
        );
    return readFileSync(SW, 'utf8');
}

/** The precache entries: workbox inlines them as {url:"…",revision:…} objects. */
function precacheUrls(): string[] {
    return [...swSource().matchAll(/url:"([^"]+)",revision:/g)].map(
        (m) => m[1],
    );
}

describe('service worker', () => {
    it('exists in public/', () => {
        expect(existsSync(SW)).toBe(true);
    });

    it('precaches the boundaries, the unit index, glyphs and the map worker', () => {
        const urls = precacheUrls();
        expect(urls).toContain('boundaries/wards.geojson');
        expect(urls).toContain('boundaries/counties.geojson');
        expect(urls).toContain('boundaries/constituencies.geojson');
        expect(urls).toContain('boundaries/units.json');
        expect(urls).toContain('boundaries/manifest.json');
        expect(urls).toContain('boundaries/towns.geojson');
        expect(urls.some((u) => u.startsWith('glyphs/'))).toBe(true);
        expect(urls.some((u) => /^build\/assets\/app-.*\.js$/.test(u))).toBe(
            true,
        );
        expect(
            urls.some((u) =>
                /^build\/assets\/maplibre-gl-worker.*\.mjs$/.test(u),
            ),
        ).toBe(true);
        expect(urls.some((u) => u.endsWith('.woff2'))).toBe(true);
    });

    it('only lists files that exist under public/', () => {
        const missing = precacheUrls().filter(
            (u) => !existsSync(resolve(PUBLIC, decodeURI(u))),
        );
        expect(missing).toEqual([]);
    });

    it('keeps the precache under 8 MB', () => {
        const bytes = precacheUrls().reduce(
            (sum, u) => sum + statSync(resolve(PUBLIC, decodeURI(u))).size,
            0,
        );
        expect(bytes).toBeLessThan(8_000_000);
    });

    it('is registered from the app bundle at /sw.js with scope /', () => {
        const viteManifest = JSON.parse(
            readFileSync(resolve(PUBLIC, 'build/manifest.json'), 'utf8'),
        ) as Record<string, { file: string }>;
        const app = readFileSync(
            resolve(PUBLIC, 'build', viteManifest['resources/js/app.ts'].file),
            'utf8',
        );
        expect(app).toMatch(/[`"']\/sw\.js[`"']/);
        expect(app).not.toContain('/build/sw.js');
        expect(app).toMatch(/scope:[`"']\/[`"']/);
    });

    it('matches content-hashed ?v= requests against the precache', () => {
        expect(swSource()).toContain('/^v$/');
    });

    it('uses network-first for pages and holder data, and never caches basemap tiles', () => {
        const sw = swSource();
        expect(sw).toMatch(/NetworkFirst\(\{cacheName:"pages"/);
        // pages: only the public map routes, so admin and account pages are never saved
        expect(sw).toContain('(county|constituency|ward)');
        // and a party's page (/party/uda) is one of them
        expect(sw).toContain('party\\/[a-z0-9]+');
        expect(sw).toMatch(/NetworkFirst\(\{cacheName:"seats"/);
        expect(sw).toContain('importScripts("/sw-reset-pages.js")');
        expect(
            readFileSync(resolve(PUBLIC, 'sw-reset-pages.js'), 'utf8'),
        ).toContain("caches.delete('pages')");
        expect(sw).toMatch(/openfreemap.{0,12},new \w+\.NetworkOnly/);
    });
});

describe('web app manifest', () => {
    function manifest() {
        if (!existsSync(MANIFEST))
            throw new Error(
                'public/manifest.webmanifest is missing: run `npm run build` first.',
            );
        return JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
            name: string;
            short_name: string;
            start_url: string;
            display: string;
            theme_color: string;
            background_color: string;
            icons: { src: string; sizes: string; purpose?: string }[];
        };
    }

    it('names the app and opens standalone at /', () => {
        const m = manifest();
        expect(m.name).toBe('Kenya Electoral Map');
        expect(m.short_name).toBe('Electoral Map');
        expect(m.start_url).toBe('/');
        expect(m.display).toBe('standalone');
        expect(m.theme_color.toUpperCase()).toBe('#EEF1EF');
        expect(m.background_color.toUpperCase()).toBe('#EEF1EF');
    });

    it('has 192 and 512 icons plus a maskable one, all present on disk', () => {
        const { icons } = manifest();
        const sizes = icons.map((i) => i.sizes);
        expect(sizes).toContain('192x192');
        expect(sizes).toContain('512x512');
        expect(icons.some((i) => (i.purpose ?? '').includes('maskable'))).toBe(
            true,
        );
        for (const i of icons)
            expect(existsSync(resolve(PUBLIC, i.src.replace(/^\//, '')))).toBe(
                true,
            );
    });
});
