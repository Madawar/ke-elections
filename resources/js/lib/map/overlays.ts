// Point (or polygon) layers drawn on top of the boundaries: towns today; schools, hospitals,
// polling stations and the like later. An overlay is data plus a few layers, so adding one is
// a new entry in OVERLAYS (or one passed to <MapView :overlays>) and nothing else.
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import type { MapTheme } from './theme';

export interface MapOverlay {
    id: string;
    label: string;
    /** Shown in the layer list; overlays without a description are listed plainly. */
    description?: string;
    /** Data for the overlay's source (id = `overlay-<id>`). */
    source: (ctx: { manifest: Record<string, string> }) => SourceSpecification;
    /** Layers reading from `overlay-<id>`. Ids must start with the overlay id. */
    layers: (theme: MapTheme, sourceId: string) => LayerSpecification[];
    /** Layer ids that are clickable; the click reports the feature's properties. */
    interactive?: string[];
    /** Legend swatch. */
    swatch?: (theme: MapTheme) => string;
    defaultOn?: boolean;
}

export const overlaySourceId = (overlay: MapOverlay) => `overlay-${overlay.id}`;

export const TOWNS: MapOverlay = {
    id: 'towns',
    label: 'Towns',
    description: 'Cities and towns from OpenStreetMap',
    defaultOn: true,
    source: ({ manifest }) => ({
        type: 'geojson',
        data: `/boundaries/towns.geojson?v=${manifest['towns.geojson'] ?? ''}`,
    }),
    swatch: (t) => t.town,
    layers: (theme, source) => [
        {
            id: 'towns',
            type: 'symbol',
            source,
            minzoom: 6,
            filter: [
                'any',
                ['==', ['get', 'place'], 'city'],
                ['>=', ['zoom'], 8.5],
            ],
            layout: {
                'symbol-sort-key': ['get', 'rank'],
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Italic'],
                'text-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    6,
                    ['case', ['==', ['get', 'place'], 'city'], 11, 10],
                    12,
                    13,
                ],
                'text-offset': [0, 0.6],
                'text-anchor': 'top',
                'text-padding': 4,
                'text-optional': true,
                'icon-optional': false,
            },
            paint: {
                'text-color': theme.town,
                'text-halo-color': theme.labelHalo,
                'text-halo-width': 1.4,
                'text-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    6,
                    0,
                    6.6,
                    1,
                ],
            },
        },
        {
            id: 'towns-dot',
            type: 'circle',
            source,
            minzoom: 6,
            filter: [
                'any',
                ['==', ['get', 'place'], 'city'],
                ['>=', ['zoom'], 8.5],
            ],
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    6,
                    2,
                    12,
                    3.5,
                ],
                'circle-color': theme.surface,
                'circle-stroke-color': theme.town,
                'circle-stroke-width': 1.2,
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    6,
                    0,
                    6.6,
                    1,
                ],
                'circle-stroke-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    6,
                    0,
                    6.6,
                    1,
                ],
            },
        },
    ],
};

export const POLLING_STATIONS: MapOverlay = {
    id: 'stations',
    label: 'Polling stations (2013)',
    description: 'IEBC 2013 locations; many have moved or been added since',
    source: ({ manifest }) => ({
        type: 'geojson',
        data: `/boundaries/stations.geojson?v=${manifest['stations.geojson'] ?? ''}`,
    }),
    swatch: () => '#13233A',
    interactive: ['stations-dot'],
    layers: (theme, source) => [
        {
            id: 'stations-dot',
            type: 'circle',
            source,
            // Starts where the dots are visible, so faded-out dots never catch a tap.
            minzoom: 9.6,
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    9,
                    1.6,
                    12,
                    3.2,
                    15,
                    5,
                ],
                'circle-color': theme.ink,
                'circle-stroke-color': theme.surface,
                'circle-stroke-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    9,
                    0.4,
                    13,
                    1.2,
                ],
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    9.6,
                    0,
                    10.2,
                    0.85,
                ],
                'circle-stroke-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    9.6,
                    0,
                    10.2,
                    1,
                ],
            },
        },
        {
            id: 'stations-label',
            type: 'symbol',
            source,
            minzoom: 12.5,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 11,
                'text-offset': [0, 0.8],
                'text-anchor': 'top',
                'text-max-width': 9,
                'text-optional': true,
                'text-padding': 2,
            },
            paint: {
                'text-color': theme.muted,
                'text-halo-color': theme.labelHalo,
                'text-halo-width': 1.4,
            },
        },
    ],
};

export const OVERLAYS: MapOverlay[] = [TOWNS, POLLING_STATIONS];
