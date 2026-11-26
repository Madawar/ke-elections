// Draws a MapLibre style into a hidden, fixed-size map and returns it as a PNG data URL
// (plan decision R2: the export builds its own style instead of reading the visible map).
import type { PaddingOptions, StyleSpecification } from 'maplibre-gl';
import { loadMapLibre } from '@/composables/useMap';
import type { MapLevel } from '@/lib/map/levels';
import { SOURCE_OF } from '@/lib/map/style';

export interface RenderMapImageOptions {
    style: StyleSpecification;
    /** [west, south, east, north] */
    bounds: [number, number, number, number];
    width: number;
    height: number;
    /** Outline this unit with the style's "selected" line. */
    highlight?: { level: MapLevel; code: number };
    padding?: number | PaddingOptions;
    maxZoom?: number;
    /** Give up after this long (ms). */
    timeout?: number;
}

let workerReady: Promise<void> | null = null;

/** The visible map normally sets the worker URL first; set it here only if it has not. */
function ensureWorker(maplibre: typeof import('maplibre-gl')) {
    workerReady ??= (async () => {
        if (maplibre.getWorkerUrl()) return;
        const url = (
            await import('maplibre-gl/dist/maplibre-gl-worker.mjs?url')
        ).default;
        if (!maplibre.getWorkerUrl()) maplibre.setWorkerUrl(url);
    })().catch((error: unknown) => {
        workerReady = null; // let the next export try again
        throw error;
    });
    return workerReady;
}

export async function renderMapImage({
    style,
    bounds,
    width,
    height,
    highlight,
    padding = 0,
    maxZoom = 13,
    timeout = 30_000,
}: RenderMapImageOptions): Promise<string> {
    const maplibre = await loadMapLibre();
    await ensureWorker(maplibre);

    const container = document.createElement('div');
    container.setAttribute('aria-hidden', 'true');
    Object.assign(container.style, {
        position: 'fixed',
        left: '-20000px',
        top: '0',
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
    });
    document.body.appendChild(container);

    let map: import('maplibre-gl').Map;
    try {
        map = new maplibre.Map({
            container,
            style,
            bounds,
            fitBoundsOptions: { padding, maxZoom },
            interactive: false,
            attributionControl: false,
            pixelRatio: 1,
            fadeDuration: 0,
            canvasContextAttributes: { preserveDrawingBuffer: true },
        });
    } catch (error) {
        // No WebGL2 (or no context left): don't leave the off-screen container behind.
        container.remove();
        throw error;
    }

    try {
        return await new Promise<string>((resolve, reject) => {
            const timer = window.setTimeout(
                () => reject(new Error('The map took too long to draw.')),
                timeout,
            );
            let loaded = false;
            const fail = (error: unknown) => {
                window.clearTimeout(timer);
                reject(error);
            };
            // Before 'load' an error means the style itself failed. After it, MapLibre reports
            // problems it recovers from (a missing glyph range, say), so keep going to 'idle'.
            map.on('error', (e) => {
                if (!loaded)
                    fail(e.error ?? new Error('The map could not be drawn.'));
                else console.warn('[export map]', e.error?.message ?? e);
            });
            map.getCanvas().addEventListener('webglcontextlost', () =>
                fail(new Error('The map lost its drawing context.')),
            );
            map.once('load', () => {
                loaded = true;
                // Fit again now that the canvas has its final size, then outline the unit.
                map.fitBounds(bounds, { padding, maxZoom, duration: 0 });
                if (highlight)
                    map.setFeatureState(
                        {
                            source: SOURCE_OF[highlight.level],
                            id: highlight.code,
                        },
                        { selected: true },
                    );
                map.once('idle', () => {
                    window.clearTimeout(timer);
                    try {
                        resolve(map.getCanvas().toDataURL('image/png'));
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        });
    } finally {
        map.remove();
        container.remove();
    }
}
