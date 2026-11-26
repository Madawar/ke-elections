import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

type Handler = (e?: unknown) => void;
const imported = vi.fn();
/** A stand-in for the MapLibre map that records what the composable asks of it. */
const fake = vi.hoisted(() => ({
    throws: true,
    current: null as null | {
        handlers: Map<string, Handler>;
        layers: Set<string>;
        filters: Map<string, unknown>;
        setFilter: ReturnType<typeof vi.fn>;
        setPaintProperty: ReturnType<typeof vi.fn>;
        fitBounds: ReturnType<typeof vi.fn>;
        queryRenderedFeatures: ReturnType<typeof vi.fn>;
        zoom: number;
        fitZoom: number;
        fitZooms: Map<string, number>;
        moving: boolean;
        easeTo: ReturnType<typeof vi.fn>;
        scrollZoom: {
            enable: ReturnType<typeof vi.fn>;
            disable: ReturnType<typeof vi.fn>;
        };
        touchZoomRotate: {
            enable: ReturnType<typeof vi.fn>;
            disable: ReturnType<typeof vi.fn>;
        };
    },
}));
vi.mock('maplibre-gl', () => {
    imported();
    return {
        Map: vi.fn(function (options: {
            style: { layers: { id: string }[]; sources: object };
        }) {
            if (fake.throws) throw new Error('no webgl');
            const handlers = new Map<string, Handler>();
            const layers = new Set(options.style.layers.map((l) => l.id));
            const filters = new Map<string, unknown>();
            const sources = new Set(Object.keys(options.style.sources));
            const self = {
                handlers,
                layers,
                filters,
                touchZoomRotate: {
                    disableRotation: () => {},
                    enable: vi.fn(),
                    disable: vi.fn(),
                },
                scrollZoom: { enable: vi.fn(), disable: vi.fn() },
                // An ease with no duration is over before the call returns.
                easeTo: vi.fn((o: { duration?: number }) => {
                    self.moving = (o.duration ?? 0) > 0;
                }),
                on: (name: string, cb: Handler) => handlers.set(name, cb),
                getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
                getSource: (id: string) =>
                    sources.has(id)
                        ? { setData: () => Promise.resolve() }
                        : undefined,
                addSource: (id: string) => sources.add(id),
                addLayer: (l: { id: string }) => layers.add(l.id),
                setLayoutProperty: () => {},
                setPaintProperty: vi.fn(),
                setFilter: vi.fn((id: string, f: unknown) =>
                    filters.set(id, f),
                ),
                setFeatureState: () => {},
                fitBounds: vi.fn((_b: unknown, o: { duration?: number }) => {
                    self.moving = (o.duration ?? 0) > 0;
                }),
                queryRenderedFeatures: vi.fn(() => []),
                zoom: 6,
                moving: false,
                isMoving: () => self.moving,
                fitZoom: 14,
                fitZooms: new Map<string, number>(),
                getZoom: () => self.zoom,
                cameraForBounds: (b: number[]) => ({
                    zoom: self.fitZooms.get(String(b)) ?? self.fitZoom,
                }),
                getCanvas: () => ({ style: {} }),
                resize: () => {},
                remove: () => {},
            };
            fake.current = self;
            return self;
        }),
        setWorkerUrl: vi.fn(),
    };
});
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?url', () => ({
    default: '/worker.js',
}));
const webgl = { ok: false };
vi.mock('@/lib/map/webgl', () => ({ supportsWebGL2: () => webgl.ok }));

import { useMap } from '@/composables/useMap';
import { NO_COLOURING } from '@/lib/map/colouring';
import { FOCUS_LAYERS } from '@/lib/map/focus';
import { OVERLAYS } from '@/lib/map/overlays';
import { type Unit, UnitIndex } from '@/lib/units';

const index = UnitIndex.fromRows(
    JSON.parse(
        readFileSync(
            resolve(
                import.meta.dirname,
                '../../../public/boundaries/units.json',
            ),
            'utf8',
        ),
    ) as Unit[],
);

function harness(
    onUnsupported: () => void,
    out: {
        api?: ReturnType<typeof useMap>;
        outside?: ReturnType<typeof vi.fn>;
        zoomOut?: ReturnType<typeof vi.fn>;
    } = {},
) {
    const colouring = ref(NO_COLOURING);
    return {
        colouring,
        component: defineComponent({
            setup() {
                const el = ref<HTMLElement | null>(null);
                out.api = useMap(el, {
                    manifest: {},
                    provinceOfCounty: new Map(),
                    index,
                    theme: ref('light'),
                    colouring,
                    overlays: ref(OVERLAYS),
                    enabledOverlays: ref(['towns', 'stations']),
                    boundsOf: (l, c) => index.get(l, c)?.b,
                    onSelect: () => {},
                    onOutsideClick: out.outside,
                    onZoomOut: out.zoomOut,
                    onUnsupported,
                });
                return () => h('div', { ref: el });
            },
        }),
    };
}

describe('useMap', () => {
    it('falls back without importing MapLibre when WebGL2 is missing', async () => {
        webgl.ok = false;
        const onUnsupported = vi.fn();
        mount(harness(onUnsupported).component);
        await new Promise((r) => setTimeout(r, 0));
        expect(onUnsupported).toHaveBeenCalledTimes(1);
        expect(imported).not.toHaveBeenCalled();
    });

    it('falls back when the Map constructor throws', async () => {
        webgl.ok = true;
        fake.throws = true;
        const onUnsupported = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mount(harness(onUnsupported).component);
        await vi.waitFor(() => expect(onUnsupported).toHaveBeenCalledTimes(1));
    });
});

describe('useMap focus', () => {
    const out: {
        api?: ReturnType<typeof useMap>;
        outside?: ReturnType<typeof vi.fn>;
        zoomOut?: ReturnType<typeof vi.fn>;
    } = {};
    let colouring: ReturnType<typeof harness>['colouring'];
    const map = () => fake.current!;

    beforeEach(async () => {
        webgl.ok = true;
        fake.throws = false;
        fake.current = null;
        out.outside = vi.fn();
        out.zoomOut = vi.fn();
        const h = harness(() => {}, out);
        colouring = h.colouring;
        mount(h.component);
        await vi.waitFor(() => expect(fake.current).not.toBeNull());
        map().handlers.get('load')!();
        await nextTick();
        map().setFilter.mockClear();
        // Loading fitted Kenya; start each test with the camera at rest.
        map().easeTo.mockClear();
        map().fitBounds.mockClear();
        map().moving = false;
        map().handlers.get('moveend')!();
    });

    it('filters every focus layer, keeping each layer’s own filter', () => {
        out.api!.setFocus({ level: 'county', code: 47 });
        const touched = new Set(map().setFilter.mock.calls.map((c) => c[0]));
        for (const id of FOCUS_LAYERS) expect(touched).toContain(id);
        expect(map().filters.get('wards-fill')).toEqual([
            '==',
            ['get', 'county_code'],
            47,
        ]);
        expect(map().filters.get('labels-ward')).toEqual([
            'all',
            ['==', ['get', 'level'], 'ward'],
            expect.arrayContaining(['in']),
        ]);
    });

    it('re-applies the filters when the colouring changes while focused', async () => {
        out.api!.setFocus({ level: 'county', code: 47 });
        map().setFilter.mockClear();
        colouring.value = { ...NO_COLOURING, mode: { kind: 'province' } };
        await nextTick();
        const touched = new Set(map().setFilter.mock.calls.map((c) => c[0]));
        for (const id of FOCUS_LAYERS) expect(touched).toContain(id);
        expect(map().filters.get('wards-fill')).toEqual([
            '==',
            ['get', 'county_code'],
            47,
        ]);
    });

    it('restores each layer’s own filter when focus is cleared', () => {
        out.api!.setFocus({ level: 'ward', code: 1448 });
        out.api!.setFocus(null);
        expect(map().filters.get('wards-fill')).toBeNull();
        expect(map().filters.get('labels-ward')).toEqual([
            '==',
            ['get', 'level'],
            'ward',
        ]);
    });

    it('keeps the outside drawn and greyed when surroundings are shown', () => {
        out.api!.setFocus({ level: 'county', code: 47 });
        out.api!.setShowSurroundings(true);
        expect(map().filters.get('wards-fill')).toBeNull();
        expect(map().filters.get('labels-county')).toEqual([
            'all',
            ['==', ['get', 'level'], 'county'],
            expect.arrayContaining(['in']),
        ]);
        const painted = map().setPaintProperty.mock.calls.findLast(
            (c) => c[0] === 'wards-fill' && c[1] === 'fill-color',
        );
        expect(JSON.stringify(painted?.[2])).toContain('"case"');
    });

    it('fits the unit inside the padding and keeps that padding on the map', () => {
        out.api!.setPadding({ top: 72, bottom: 420, left: 56, right: 56 });
        out.api!.select('constituency', 280, { animate: false });
        const [bounds, options] = map().fitBounds.mock.calls.at(-1)!;
        expect(bounds).toEqual(index.get('constituency', 280)!.b);
        expect(options.padding).toEqual({
            top: 72,
            bottom: 420,
            left: 56,
            right: 56,
        });
        // Absolute padding makes the map's middle the middle of the visible area, so zooming
        // around the centre keeps the unit centred.
        expect(options.absolutePadding).toBe(true);
        expect(options.duration).toBe(0);
    });

    it('reports a tap outside the focused unit, but not one on it', () => {
        out.api!.setFocus({ level: 'ward', code: 1448 });
        const click = map().handlers.get('click')!;
        map().queryRenderedFeatures.mockReturnValue([]);
        click({ point: { x: 5, y: 5 } });
        expect(out.outside).toHaveBeenCalledTimes(1);

        map().queryRenderedFeatures.mockImplementation(
            (_p: unknown, o: { layers?: string[] }) =>
                o.layers?.[0] === 'wards-fill' ? [{ id: 1448 }] : [],
        );
        click({ point: { x: 6, y: 6 } });
        // Picking the ward itself selects it; the page is not asked to step out.
        expect(out.outside).toHaveBeenCalledTimes(1);
    });

    it('does not report taps when nothing is focused', () => {
        map().queryRenderedFeatures.mockReturnValue([]);
        map().handlers.get('click')!({ point: { x: 5, y: 5 } });
        expect(out.outside).not.toHaveBeenCalled();
    });

    it('zooms around the middle of the visible map while focused, and around the cursor otherwise', () => {
        out.api!.setFocus({ level: 'county', code: 47 });
        expect(map().scrollZoom.enable).toHaveBeenLastCalledWith({
            around: 'center',
        });
        expect(map().touchZoomRotate.enable).toHaveBeenLastCalledWith({
            around: 'center',
        });
        out.api!.setFocus(null);
        expect(map().scrollZoom.enable).toHaveBeenLastCalledWith(undefined);
        expect(map().touchZoomRotate.enable).toHaveBeenLastCalledWith(
            undefined,
        );
        // MapLibre ignores enable() on a handler that is already on, so each is switched off first.
        expect(map().scrollZoom.disable).toHaveBeenCalled();
        expect(map().touchZoomRotate.disable).toHaveBeenCalled();
    });

    describe('zooming out by hand', () => {
        // The zoom that fits each unit: a ward is small, Nairobi is big.
        beforeEach(() => {
            for (const [level, code, zoom] of [
                ['ward', 1448, 14],
                ['constituency', 290, 11],
                ['county', 47, 9],
            ] as const)
                map().fitZooms.set(String(index.get(level, code)!.b), zoom);
        });

        const userZoom = (to: number) => {
            map().zoom = to;
            map().handlers.get('zoomstart')!({});
            map().handlers.get('zoomend')!();
        };

        it('asks to step the focus up once the unit is zoomed out of', () => {
            out.api!.setFocus({ level: 'ward', code: 1448 });
            userZoom(12.5);
            expect(out.zoomOut).toHaveBeenCalledWith({
                level: 'constituency',
                code: index.get('ward', 1448)!.p,
            });
        });

        it('can step several levels in one zoom, down to all of Kenya', () => {
            out.api!.setFocus({ level: 'ward', code: 1448 });
            userZoom(4);
            expect(out.zoomOut).toHaveBeenCalledWith(null);
        });

        it('does nothing while the unit is still in view', () => {
            out.api!.setFocus({ level: 'ward', code: 1448 });
            userZoom(13);
            expect(out.zoomOut).not.toHaveBeenCalled();
        });

        it('ignores zooms the page made itself, such as fitting a unit', () => {
            out.api!.setFocus({ level: 'ward', code: 1448 });
            // A fit that is still animating when its zoom events arrive.
            map().moving = true;
            out.api!.select('ward', 1448);
            userZoom(5);
            expect(out.zoomOut).not.toHaveBeenCalled();
            // Once that move has ended, the next zoom is the person's.
            map().moving = false;
            map().handlers.get('moveend')!();
            userZoom(5);
            expect(out.zoomOut).toHaveBeenCalledWith(null);
        });

        it('does not stay deaf after a move that changed nothing', () => {
            out.api!.setFocus({ level: 'ward', code: 1448 });
            out.api!.select('ward', 1448, { animate: false });
            userZoom(5);
            expect(out.zoomOut).toHaveBeenCalledWith(null);
        });

        it('does nothing when nothing is focused', () => {
            userZoom(4);
            expect(out.zoomOut).not.toHaveBeenCalled();
        });

        it('eases to centre the new unit at the zoom the person is at', () => {
            out.api!.setPadding({ top: 72, bottom: 420, left: 56, right: 56 });
            out.api!.setFocus({ level: 'ward', code: 1448 });
            userZoom(12.5);
            const b = index.get('constituency', 290)!.b;
            expect(map().easeTo).toHaveBeenCalledTimes(1);
            const [options] = map().easeTo.mock.calls[0];
            expect(options.center[0]).toBeCloseTo((b[0] + b[2]) / 2);
            expect(options.center[1]).toBeCloseTo((b[1] + b[3]) / 2);
            expect(options.zoom).toBe(12.5);
            expect(options.padding).toEqual({
                top: 72,
                bottom: 420,
                left: 56,
                right: 56,
            });
        });

        it('treats that ease as the page’s own move, not the person zooming on', () => {
            out.api!.setFocus({ level: 'ward', code: 1448 });
            userZoom(12.5);
            expect(out.zoomOut).toHaveBeenCalledTimes(1);
            // The ease is still running when its zoom events arrive: no second step.
            userZoom(4);
            expect(out.zoomOut).toHaveBeenCalledTimes(1);
            expect(map().easeTo).toHaveBeenCalledTimes(1);
            map().moving = false;
            map().handlers.get('moveend')!();
            userZoom(4);
            expect(out.zoomOut).toHaveBeenCalledTimes(2);
        });

        it('centres Kenya when the focus steps out to all of it', () => {
            out.api!.setFocus({ level: 'county', code: 47 });
            userZoom(4);
            expect(out.zoomOut).toHaveBeenCalledWith(null);
            const [options] = map().easeTo.mock.calls[0];
            expect(options.zoom).toBe(4);
            expect(options.center[0]).toBeCloseTo((33.9 + 41.91) / 2);
        });

        it('does not ease when nothing steps', () => {
            out.api!.setFocus({ level: 'ward', code: 1448 });
            userZoom(13);
            expect(map().easeTo).not.toHaveBeenCalled();
        });
    });
});
