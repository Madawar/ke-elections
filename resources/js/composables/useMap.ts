import type {
    FilterSpecification,
    GeoJSONSource,
    Map as MapLibreMap,
    MapGeoJSONFeature,
    MapMouseEvent,
} from 'maplibre-gl';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import { type Colouring, pinnedLevel } from '@/lib/map/colouring';
import { type TapFeature, tapTarget } from '@/lib/map/tap';
import {
    type FocusSelection,
    combineFilter,
    focusFilters,
    focusOutside,
    stepUpFor,
} from '@/lib/map/focus';
import { centreOn } from '@/lib/map/camera';
import {
    KENYA_BOUNDS,
    MAX_BOUNDS,
    type MapLevel,
    WARD_MIN_ZOOM,
} from '@/lib/map/levels';
import { type MapOverlay, overlaySourceId } from '@/lib/map/overlays';
import { MAP_LEVELS, SOURCE_OF, buildStyle, fileUrl } from '@/lib/map/style';
import type { ThemeName } from '@/lib/map/theme';
import { THEMES } from '@/lib/map/theme';
import { supportsWebGL2 } from '@/lib/map/webgl';
import type { UnitIndex } from '@/lib/units';

export type Bounds = [number, number, number, number];
export interface Picked {
    level: MapLevel;
    code: number;
}

export interface UseMapOptions {
    manifest: Record<string, string>;
    provinceOfCounty: Map<number, number>;
    /** The unit directory: focus mode reads which units sit inside the selected one. */
    index: UnitIndex;
    theme: Ref<ThemeName>;
    colouring: Ref<Colouring>;
    overlays: Ref<MapOverlay[]>;
    enabledOverlays: Ref<string[]>;
    /** Bounds of a unit, for fitting the camera. */
    boundsOf: (level: MapLevel, code: number) => Bounds | undefined;
    onSelect: (unit: Picked) => void;
    onHover?: (unit: Picked | null, point: { x: number; y: number }) => void;
    onOverlayClick?: (
        overlay: MapOverlay,
        properties: Record<string, unknown>,
    ) => void;
    /** A tap landed on the map, outside the focused unit (the page steps up one level). */
    onOutsideClick?: () => void;
    /**
     * The person zoomed out of the focused unit, so the focus moves up (null: all of Kenya). The
     * camera is already where they put it; the page only updates the selection.
     */
    onZoomOut?: (next: FocusSelection | null) => void;
    onUnsupported: () => void;
    /** The user moved the camera by hand (auto-centre pauses until the next selection). */
    onUserMove?: () => void;
}

type Padding = { top: number; bottom: number; left: number; right: number };

/** MapLibre is loaded on demand so the first paint (and phones without WebGL2) never pay for it. */
export const loadMapLibre = () => import('maplibre-gl');

export function useMap(
    container: Ref<HTMLElement | null>,
    opts: UseMapOptions,
) {
    const map = shallowRef<MapLibreMap | null>(null);
    const ready = ref(false);
    const zoom = ref(5.5);
    let selected: Picked | null = null;
    let focus: FocusSelection | null = null;
    let surroundings = false;
    /** True while a camera move that the page started (not the person) is under way. */
    let ownMove = false;
    let hovered: Picked | null = null;
    let wardsLoaded = false;
    /** The ward source has its geometry (the data was set and the worker has finished with it). */
    let wardsReady = false;
    let wantWards = false;
    let disposed = false;
    let padding: Padding = { top: 72, bottom: 24, left: 24, right: 24 };
    let resizeObserver: ResizeObserver | null = null;
    const canHover =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(hover: hover)').matches;

    /**
     * The focus the map draws. A ward focus draws its parent constituency until the ward geometry
     * has loaded, so the map is never blank while the wards source is still empty.
     */
    function drawnFocus(): FocusSelection | null {
        if (focus?.level !== 'ward' || wardsReady) return focus;
        const parent = opts.index.get('ward', focus.code)?.p;
        return parent === null || parent === undefined
            ? focus
            : { level: 'constituency', code: parent };
    }

    const style = () => {
        const drawn = drawnFocus();
        return buildStyle({
            manifest: opts.manifest,
            theme: THEMES[opts.theme.value],
            colouring: opts.colouring.value,
            provinceOfCounty: opts.provinceOfCounty,
            wards: wardsLoaded,
            focus: drawn
                ? {
                      outside: surroundings ? focusOutside(drawn) : undefined,
                      level: drawn.level,
                  }
                : undefined,
        });
    };

    /** Fill the (initially empty) ward source; deferred until the style has loaded. */
    function ensureWards() {
        wantWards = true;
        const m = map.value;
        const source = m?.getSource('wards') as GeoJSONSource | undefined;
        if (!m || wardsLoaded || !source) return;
        wardsLoaded = true;
        source
            .setData(fileUrl(opts.manifest, 'wards.geojson'))
            .then(() => {
                wardsReady = true;
                // A ward focus was drawn as its constituency while this loaded.
                if (focus?.level === 'ward') restyle();
            })
            .catch(() => {});
    }

    function setState(
        unit: Picked | null,
        key: 'selected' | 'hover',
        value: boolean,
    ) {
        const m = map.value;
        if (!unit || !m || !ready.value) return;
        m.setFeatureState(
            { source: SOURCE_OF[unit.level], id: unit.code },
            { [key]: value },
        );
    }

    function addOverlays() {
        const m = map.value;
        if (!m || !ready.value) return;
        const theme = THEMES[opts.theme.value];
        for (const overlay of opts.overlays.value) {
            const id = overlaySourceId(overlay);
            const on = opts.enabledOverlays.value.includes(overlay.id);
            if (!m.getSource(id)) {
                if (!on) continue;
                m.addSource(id, overlay.source({ manifest: opts.manifest }));
                for (const layer of overlay.layers(theme, id))
                    m.addLayer(layer, 'overlays-anchor');
            }
            for (const layer of overlay.layers(theme, id)) {
                if (m.getLayer(layer.id))
                    m.setLayoutProperty(
                        layer.id,
                        'visibility',
                        on ? 'visible' : 'none',
                    );
            }
        }
        applyFocus();
    }

    /**
     * Theme and colouring changes only touch paint and visibility: the boundary sources
     * (2+ MB of GeoJSON) are never reloaded, and feature-state (the selection) survives.
     */
    function restyle() {
        const m = map.value;
        if (!m || !ready.value) return;
        const theme = THEMES[opts.theme.value];
        const overlayLayers = new Set<string>();
        const layers = [
            ...style().layers,
            ...opts.overlays.value.flatMap((o) =>
                o.layers(theme, overlaySourceId(o)).map((l) => {
                    overlayLayers.add(l.id);
                    return l;
                }),
            ),
        ];
        for (const layer of layers) {
            if (!m.getLayer(layer.id)) continue;
            for (const [key, value] of Object.entries(layer.paint ?? {})) {
                m.setPaintProperty(layer.id, key as never, value as never);
            }
            const visibility = (
                layer.layout as { visibility?: 'visible' | 'none' } | undefined
            )?.visibility;
            if (visibility && !overlayLayers.has(layer.id))
                m.setLayoutProperty(layer.id, 'visibility', visibility);
        }
        applyFocus();
    }

    /** Every layer's filter: its own, plus the focus filter while a unit is focused. */
    function applyFocus() {
        const m = map.value;
        if (!m || !ready.value) return;
        const theme = THEMES[opts.theme.value];
        const filters = focusFilters(drawnFocus(), opts.index, {
            surroundings,
        });
        const layers = [
            ...style().layers,
            ...opts.overlays.value.flatMap((o) =>
                o.layers(theme, overlaySourceId(o)),
            ),
        ];
        for (const layer of layers) {
            if (!(layer.id in filters) || !m.getLayer(layer.id)) continue;
            const base = (layer as { filter?: FilterSpecification }).filter;
            m.setFilter(layer.id, combineFilter(base, filters[layer.id]));
        }
    }

    /** Run a camera move of the page's own; its zoom events are not the person zooming out. */
    function ownCamera(move: (m: MapLibreMap) => void) {
        const m = map.value;
        if (!m) return;
        ownMove = true;
        move(m);
        // A move that changed nothing fires no end event to clear the flag.
        if (!m.isMoving()) ownMove = false;
    }

    /**
     * While a unit is focused, wheel and pinch zoom around the middle of the visible map (the map's
     * padding moves that middle clear of the sheet or panel), so the unit stays put as it shrinks.
     */
    function applyZoomAnchor() {
        const m = map.value;
        if (!m) return;
        // enable() does nothing while a handler is already on, so switch it off first.
        const options = focus ? { around: 'center' as const } : undefined;
        m.scrollZoom.disable();
        m.scrollZoom.enable(options);
        m.touchZoomRotate.disable();
        m.touchZoomRotate.enable(options);
    }

    /**
     * Fit the bounds inside the padding, and keep that padding on the map (absolutePadding), so
     * the map's own middle is the middle of the visible area and zooming around the centre keeps
     * the unit where it is. Plain padding would only shape this one fit.
     */
    function fit(bounds: Bounds, animate = true) {
        ownCamera((m) =>
            m.fitBounds(bounds, {
                padding,
                absolutePadding: true,
                maxZoom: 14,
                duration: animate ? 600 : 0,
            }),
        );
    }

    function select(
        level: MapLevel,
        code: number,
        { fit: doFit = true, animate = true } = {},
    ) {
        if (level === 'ward') ensureWards();
        setState(selected, 'selected', false);
        selected = { level, code };
        setState(selected, 'selected', true);
        const bounds = opts.boundsOf(level, code);
        if (doFit && bounds && ready.value) fit(bounds, animate);
    }

    function clearSelection() {
        setState(selected, 'selected', false);
        selected = null;
    }

    /** Every unit's fill under the point, finest first; a level's own code is its feature id. */
    function featuresAt(point: MapMouseEvent['point']): TapFeature[] {
        const m = map.value!;
        return [...MAP_LEVELS].reverse().flatMap((level) =>
            m
                .queryRenderedFeatures(point, {
                    layers: [`${SOURCE_OF[level]}-fill`],
                })
                .filter((f: MapGeoJSONFeature) => typeof f.id === 'number')
                .map((f: MapGeoJSONFeature) => ({
                    level,
                    code: f.id as number,
                    county_code: f.properties?.county_code,
                    constituency_code: f.properties?.constituency_code,
                })),
        );
    }

    /**
     * What a tap here would do, from the focus and not from the zoom (see `tapTarget`). A ward
     * focus is read as the constituency drawn in its place until the ward geometry has loaded.
     */
    const tapAt = (e: MapMouseEvent) =>
        tapTarget(drawnFocus(), featuresAt(e.point));

    /** The zoom the camera would fit this unit at, with the current padding. */
    function fitZoomOf(sel: FocusSelection): number {
        const bounds = opts.boundsOf(sel.level, sel.code);
        const camera =
            bounds && map.value
                ? map.value.cameraForBounds(bounds, {
                      padding,
                      absolutePadding: true,
                      maxZoom: 14,
                  })
                : undefined;
        return camera?.zoom ?? 0;
    }

    onMounted(async () => {
        if (!container.value) return;
        if (!supportsWebGL2()) {
            opts.onUnsupported();
            return;
        }
        let maplibre: typeof import('maplibre-gl');
        try {
            maplibre = await loadMapLibre();
            const workerUrl = (
                await import('maplibre-gl/dist/maplibre-gl-worker.mjs?url')
            ).default;
            if (disposed || !container.value) return;
            maplibre.setWorkerUrl(workerUrl);
            map.value = new maplibre.Map({
                container: container.value,
                style: style(),
                bounds: KENYA_BOUNDS,
                fitBoundsOptions: { padding },
                maxBounds: MAX_BOUNDS,
                minZoom: 3.5,
                maxZoom: 15,
                attributionControl: false,
                dragRotate: false,
                pitchWithRotate: false,
                touchPitch: false,
            });
        } catch (error) {
            console.error(error);
            opts.onUnsupported();
            return;
        }
        const m = map.value;
        m.touchZoomRotate.disableRotation();
        m.on('error', (e) => console.warn('[map]', e.error?.message ?? e));
        m.on('load', () => {
            ready.value = true;
            applyZoomAnchor();
            addOverlays();
            if (wantWards || pinnedLevel(opts.colouring.value.mode) === 'ward')
                ensureWards();
            restyle();
            setState(selected, 'selected', true);
            fit(
                (selected && opts.boundsOf(selected.level, selected.code)) ??
                    KENYA_BOUNDS,
                false,
            );
        });
        m.on('zoom', () => {
            zoom.value = m.getZoom();
            if (zoom.value >= WARD_MIN_ZOOM - 1) ensureWards();
        });
        m.on('dragstart', () => opts.onUserMove?.());
        m.on('zoomstart', (e) => {
            if ((e as { originalEvent?: Event }).originalEvent)
                opts.onUserMove?.();
        });
        // The page's own camera moves (fitting a unit) zoom too, and must not step the focus.
        m.on('moveend', () => (ownMove = false));
        m.on('zoomend', () => {
            if (ownMove || !focus) return;
            const next = stepUpFor(focus, m.getZoom(), fitZoomOf, opts.index);
            if (next?.level === focus.level && next?.code === focus.code)
                return;
            opts.onZoomOut?.(next);
            // Centre the new unit at the zoom the person is at; never zoom back in. Stepping out to
            // all of Kenya leaves the camera alone: they are mid zoom-out beside the unit they
            // were viewing, and a jump to the middle of the country would be disorienting.
            const bounds = next && opts.boundsOf(next.level, next.code);
            if (bounds)
                ownCamera((map) =>
                    map.easeTo(
                        centreOn(
                            bounds,
                            padding,
                            map.getZoom(),
                            window.matchMedia?.(
                                '(prefers-reduced-motion: reduce)',
                            ).matches,
                        ),
                    ),
                );
        });
        m.on('click', (e) => {
            for (const overlay of opts.overlays.value) {
                const layers = (overlay.interactive ?? []).filter((id) =>
                    m.getLayer(id),
                );
                const hit = layers.length
                    ? m.queryRenderedFeatures(
                          [
                              [e.point.x - 10, e.point.y - 10],
                              [e.point.x + 10, e.point.y + 10],
                          ],
                          { layers },
                      )[0]
                    : undefined;
                if (hit) {
                    opts.onOverlayClick?.(overlay, hit.properties ?? {});
                    return;
                }
            }
            const target = tapAt(e);
            if (target === 'outside') opts.onOutsideClick?.();
            else if (target && target !== 'inside') opts.onSelect(target);
        });
        if (canHover) {
            m.on('mousemove', (e) => {
                // The tooltip and the pointer name what a tap would select.
                const target = tapAt(e);
                const unit =
                    target && target !== 'inside' && target !== 'outside'
                        ? target
                        : null;
                if (
                    unit?.level !== hovered?.level ||
                    unit?.code !== hovered?.code
                ) {
                    setState(hovered, 'hover', false);
                    hovered = unit;
                    setState(hovered, 'hover', true);
                    m.getCanvas().style.cursor = unit ? 'pointer' : '';
                }
                opts.onHover?.(unit, e.point);
            });
            m.on('mouseout', () => {
                setState(hovered, 'hover', false);
                hovered = null;
                opts.onHover?.(null, { x: 0, y: 0 });
            });
        }
        resizeObserver = new ResizeObserver(() => m.resize());
        resizeObserver.observe(container.value);
    });

    watch([opts.theme, opts.colouring], () => {
        if (pinnedLevel(opts.colouring.value.mode) === 'ward') ensureWards();
        restyle();
    });
    watch([opts.enabledOverlays, opts.overlays], () => addOverlays(), {
        deep: true,
    });

    onBeforeUnmount(() => {
        disposed = true;
        resizeObserver?.disconnect();
        map.value?.remove();
        map.value = null;
    });

    return {
        map,
        ready,
        zoom,
        select,
        clearSelection,
        /** Show only this unit (and what is inside it); null shows everything again. */
        setFocus(sel: FocusSelection | null) {
            focus = sel;
            // Tapping inside a constituency picks a ward, so its geometry is wanted, not just a ward's.
            if (sel?.level === 'ward' || sel?.level === 'constituency')
                ensureWards();
            applyZoomAnchor();
            restyle();
        },
        /** Keep the rest of the map faintly in view, in grey, instead of hiding it. */
        setShowSurroundings(on: boolean) {
            surroundings = on;
            restyle();
        },
        fit,
        fitKenya: (animate = true) => fit(KENYA_BOUNDS, animate),
        setPadding(p: Partial<Padding>) {
            padding = { ...padding, ...p };
        },
        getPadding: () => padding,
        zoomIn: () => map.value?.zoomIn(),
        zoomOutStep: () => map.value?.zoomOut(),
        flyTo: (lng: number, lat: number, z = 11) =>
            ownCamera((m) =>
                m.flyTo({
                    center: [lng, lat],
                    zoom: z,
                    padding,
                    duration: 800,
                }),
            ),
    };
}
