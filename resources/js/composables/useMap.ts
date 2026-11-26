import type {
    GeoJSONSource,
    Map as MapLibreMap,
    MapGeoJSONFeature,
    MapMouseEvent,
} from 'maplibre-gl';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import { type Colouring, pinnedLevel } from '@/lib/map/colouring';
import {
    KENYA_BOUNDS,
    MAX_BOUNDS,
    type MapLevel,
    WARD_MIN_ZOOM,
    levelForZoom,
} from '@/lib/map/levels';
import { type MapOverlay, overlaySourceId } from '@/lib/map/overlays';
import { MAP_LEVELS, SOURCE_OF, buildStyle, fileUrl } from '@/lib/map/style';
import type { ThemeName } from '@/lib/map/theme';
import { THEMES } from '@/lib/map/theme';
import { supportsWebGL2 } from '@/lib/map/webgl';

export type Bounds = [number, number, number, number];
export interface Picked {
    level: MapLevel;
    code: number;
}

export interface UseMapOptions {
    manifest: Record<string, string>;
    provinceOfCounty: Map<number, number>;
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
    onUnsupported: () => void;
    /** The user moved the camera by hand (auto-centre pauses until the next selection). */
    onUserMove?: () => void;
}

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
    let hovered: Picked | null = null;
    let wardsLoaded = false;
    let padding = { top: 72, bottom: 24, left: 24, right: 24 };
    let resizeObserver: ResizeObserver | null = null;
    const canHover =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(hover: hover)').matches;

    const style = () =>
        buildStyle({
            manifest: opts.manifest,
            theme: THEMES[opts.theme.value],
            colouring: opts.colouring.value,
            provinceOfCounty: opts.provinceOfCounty,
            wards: wardsLoaded,
        });

    function ensureWards() {
        const m = map.value;
        if (!m || wardsLoaded) return;
        wardsLoaded = true;
        void (m.getSource('wards') as GeoJSONSource | undefined)?.setData(
            fileUrl(opts.manifest, 'wards.geojson'),
        );
    }

    function setState(
        unit: Picked | null,
        key: 'selected' | 'hover',
        value: boolean,
    ) {
        if (!unit || !map.value) return;
        map.value.setFeatureState(
            { source: SOURCE_OF[unit.level], id: unit.code },
            { [key]: value },
        );
    }

    function addOverlays() {
        const m = map.value;
        if (!m) return;
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
    }

    function restyle() {
        const m = map.value;
        if (!m) return;
        m.setStyle(style(), { diff: true });
        m.once('styledata', () => {
            addOverlays();
            setState(selected, 'selected', true);
        });
    }

    function fit(bounds: Bounds, animate = true) {
        map.value?.fitBounds(bounds, {
            padding,
            maxZoom: 13,
            duration: animate ? 600 : 0,
        });
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
        if (doFit && bounds) fit(bounds, animate);
    }

    function clearSelection() {
        setState(selected, 'selected', false);
        selected = null;
    }

    function pick(e: MapMouseEvent): Picked | null {
        const m = map.value!;
        const pinned = pinnedLevel(opts.colouring.value.mode);
        const zoomLevel = levelForZoom(m.getZoom());
        // With seat colouring, a tap below the seat's own level still picks the visible unit at this zoom.
        const order = MAP_LEVELS.slice(
            0,
            MAP_LEVELS.indexOf(zoomLevel) + 1,
        ).reverse();
        const level =
            pinned && MAP_LEVELS.indexOf(pinned) > MAP_LEVELS.indexOf(zoomLevel)
                ? pinned
                : zoomLevel;
        for (const l of [level, ...order.filter((x) => x !== level)]) {
            const features: MapGeoJSONFeature[] = m.queryRenderedFeatures(
                e.point,
                { layers: [`${SOURCE_OF[l]}-fill`] },
            );
            const f = features[0];
            if (f && typeof f.id === 'number') return { level: l, code: f.id };
        }
        return null;
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
            if (!selected) fit(KENYA_BOUNDS, false);
            addOverlays();
            if (pinnedLevel(opts.colouring.value.mode) === 'ward')
                ensureWards();
            setState(selected, 'selected', true);
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
        m.on('click', (e) => {
            for (const overlay of opts.overlays.value) {
                const layers = (overlay.interactive ?? []).filter((id) =>
                    m.getLayer(id),
                );
                const hit = layers.length
                    ? m.queryRenderedFeatures(e.point, { layers })[0]
                    : undefined;
                if (hit) {
                    opts.onOverlayClick?.(overlay, hit.properties ?? {});
                    return;
                }
            }
            const unit = pick(e);
            if (unit) opts.onSelect(unit);
        });
        if (canHover) {
            m.on('mousemove', (e) => {
                const unit = pick(e);
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
        fit,
        fitKenya: (animate = true) => fit(KENYA_BOUNDS, animate),
        setPadding(p: Partial<typeof padding>) {
            padding = { ...padding, ...p };
            map.value?.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
        },
        getPadding: () => padding,
        zoomIn: () => map.value?.zoomIn(),
        zoomOutStep: () => map.value?.zoomOut(),
        flyTo: (lng: number, lat: number, z = 11) =>
            map.value?.flyTo({
                center: [lng, lat],
                zoom: z,
                padding,
                duration: 800,
            }),
    };
}
