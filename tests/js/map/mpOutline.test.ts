import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOCUS_LAYERS, focusFilters } from '@/lib/map/focus';
import { buildStyle } from '@/lib/map/style';
import { THEMES } from '@/lib/map/theme';
import { fitsNameLine } from '@/lib/map/wardLabels';
import {
    type SeatsData,
    MP_NO_DATA,
    mcaNameLines,
    mpOutline,
    seatColouring,
} from '@/lib/seats';
import { LEADERS_SEATS, holder, leadersIndex } from '../leadersFixtures';

const root = resolve(import.meta.dirname, '../../..');
const manifest = JSON.parse(
    readFileSync(resolve(root, 'public/boundaries/manifest.json'), 'utf8'),
);
const T = THEMES.light;
const ODM = '#e07b24';
const JP = '#c8323c';
const tokens = { noData: T.noData, faded: T.faded };
const provinceOfCounty = new Map([[47, 8]]);
const seats: SeatsData = {
    ...LEADERS_SEATS,
    holders: [
        ...LEADERS_SEATS.holders,
        // An independent MP, and a constituency (288) with none.
        holder('mp', 'constituency', 287, 'IND'),
    ],
};
/** The MCA view with MP outlines, as the page builds it. */
const mcaColouring = (onlyMp: string[] = [], names = true) => ({
    ...seatColouring(seats, 'mca', tokens),
    outline: mpOutline(seats, { ...tokens, only: new Set(onlyMp) }),
    ...(names ? { names: mcaNameLines(seats) } : {}),
});
const build = (over: Partial<Parameters<typeof buildStyle>[0]> = {}) =>
    buildStyle({
        manifest,
        theme: T,
        provinceOfCounty,
        colouring: mcaColouring(),
        ...over,
    });
type Layer = {
    id: string;
    type: string;
    source?: string;
    minzoom?: number;
    filter?: unknown;
    paint: Record<string, unknown>;
    layout: Record<string, unknown>;
};
const layerOf = (st: ReturnType<typeof buildStyle>, id: string) =>
    st.layers.find((l) => l.id === id) as unknown as Layer;
const order = (st: ReturnType<typeof buildStyle>, id: string) =>
    st.layers.findIndex((l) => l.id === id);
/** A `match` on the feature's code, as a plain object, with its fallback under "*". */
const matchOf = (expr: unknown): Record<string, unknown> => {
    const e = expr as unknown[];
    expect(e[0]).toBe('match');
    expect(e[1]).toEqual(['get', 'code']);
    const out: Record<string, unknown> = { '*': e[e.length - 1] };
    for (let i = 2; i < e.length - 1; i += 2)
        for (const code of [e[i]].flat()) out[String(code)] = e[i + 1];
    return out;
};
/** An `interpolate` over zoom, read at one zoom as MapLibre would. */
const atZoom = (expr: unknown, zoom: number): number => {
    if (typeof expr === 'number') return expr;
    const stops = (expr as unknown[]).slice(3) as number[];
    if (zoom <= stops[0]) return stops[1];
    for (let i = 0; i < stops.length - 2; i += 2)
        if (zoom <= stops[i + 2]) {
            const t = (zoom - stops[i]) / (stops[i + 2] - stops[i]);
            return stops[i + 1] + t * (stops[i + 3] - stops[i + 1]);
        }
    return stops[stops.length - 1];
};

describe('mpOutline', () => {
    it('maps each constituency code to its MP’s party colour, from the holder data', () => {
        const o = mpOutline(seats, tokens);
        expect(o.colours.get(290)).toBe(ODM);
        expect(o.colours.get(289)).toBe(JP);
        expect(o.colours.get(287)).toBe(T.independent);
        expect(o.colours.has(288)).toBe(false);
        expect(o.fallback).toBe(T.noData);
        // MCAs and county seats never leak into the outlines.
        expect([...o.colours.keys()].sort()).toEqual([287, 289, 290]);
    });

    it('takes the faded colour for an MP whose party is not selected', () => {
        const o = mpOutline(seats, { ...tokens, only: new Set(['JP']) });
        expect(o.colours.get(289)).toBe(JP);
        expect(o.colours.get(290)).toBe(T.faded);
        expect(o.colours.get(287)).toBe(T.faded);
        // An empty highlight fades nothing.
        expect(
            mpOutline(seats, { ...tokens, only: new Set() }).colours.get(290),
        ).toBe(ODM);
    });

    it('words the badge "MP: <ABBREV>", and "MP: no data" where there is no holder', () => {
        const o = mpOutline(seats, tokens);
        expect(o.badges.get(290)).toBe('MP: ODM');
        expect(o.badges.get(289)).toBe('MP: JP');
        expect(o.badges.get(287)).toBe('MP: Independent');
        expect(o.badges.has(288)).toBe(false);
        expect(o.fallbackBadge).toBe('MP: no data');
        expect(MP_NO_DATA).toBe('MP: no data');
        // The badge names the party, never the highlight: a faded outline keeps its badge.
        expect(
            mpOutline(seats, { ...tokens, only: new Set(['JP']) }).badges.get(
                290,
            ),
        ).toBe('MP: ODM');
    });
});

describe('the MP outline layers', () => {
    it('colours each constituency’s outline by its code, with the no-data colour for the rest', () => {
        const colour = matchOf(layerOf(build(), 'mp-outline').paint['line-color']);
        expect(colour['290']).toBe(ODM);
        expect(colour['289']).toBe(JP);
        expect(colour['287']).toBe(T.independent);
        expect(colour['*']).toBe(T.noData);
        expect(layerOf(build(), 'mp-outline').source).toBe('constituencies');
    });

    it('fades the outlines of the parties that are not selected, leaving the ward fills alone', () => {
        const st = build({ colouring: mcaColouring(['JP']) });
        const colour = matchOf(layerOf(st, 'mp-outline').paint['line-color']);
        expect(colour['289']).toBe(JP);
        expect(colour['290']).toBe(T.faded);
        // The ward fills keep their MCA colours: the outline has its own highlight.
        const fill = matchOf(layerOf(st, 'wards-fill').paint['fill-color']);
        expect(fill['1448']).toBe(ODM);
    });

    it('is a 4 to 5px party-colour line between two thin ink edges, drawn inside the constituency', () => {
        const st = build();
        const line = layerOf(st, 'mp-outline');
        const edge = layerOf(st, 'mp-outline-edge');
        expect(edge.paint['line-color']).toBe(T.ink);
        // Lighter while a whole county is in view, so the band does not bury its small wards.
        expect(atZoom(line.paint['line-width'], 10)).toBeGreaterThanOrEqual(2.5);
        expect(atZoom(line.paint['line-width'], 10)).toBeLessThan(4);
        for (const zoom of [12, 13, 14, 15]) {
            const w = atZoom(line.paint['line-width'], zoom);
            expect(w, `zoom ${zoom}`).toBeGreaterThanOrEqual(4);
            expect(w, `zoom ${zoom}`).toBeLessThanOrEqual(5);
            // An ink edge of about a pixel on each side.
            const ew = atZoom(edge.paint['line-width'], zoom);
            expect(ew - w).toBeGreaterThanOrEqual(1.5);
            expect(ew - w).toBeLessThanOrEqual(3);
            // Offset inward by half the edged width, so two neighbours each show their own
            // colour on their own side of the shared border.
            const offset = atZoom(line.paint['line-offset'], zoom);
            expect(offset).toBeCloseTo(ew / 2, 5);
            expect(atZoom(edge.paint['line-offset'], zoom)).toBe(offset);
            // Inside a focused constituency the band starts clear of that constituency's own
            // ink outline (5.6px, centred on the border), which would cover most of it.
            const focused = layerOf(
                build({ focus: { level: 'constituency', code: 290 } }),
                'mp-outline',
            );
            expect(
                atZoom(focused.paint['line-offset'], zoom) - offset,
            ).toBeCloseTo(2.8, 1);
        }
        // The edge is drawn first, the colour over it.
        expect(order(st, 'mp-outline-edge')).toBeLessThan(order(st, 'mp-outline'));
    });

    it('sits above the ward fills and every boundary line, below the labels and the focused unit’s outline', () => {
        const st = build();
        const at = order(st, 'mp-outline-edge');
        for (const under of [
            'wards-fill',
            'wards-line',
            'constituencies-line',
            'counties-line',
        ])
            expect(order(st, under), under).toBeLessThan(at);
        for (const over of [
            'counties-selected',
            'constituencies-selected',
            'wards-selected',
            'labels-ward',
            'labels-constituency',
        ])
            expect(order(st, over), over).toBeGreaterThan(order(st, 'mp-outline'));
    });

    it('shows from the constituency zoom band down: not at national zoom, fully by zoom 7.2', () => {
        const opacity = layerOf(build(), 'mp-outline').paint['line-opacity'];
        expect(atZoom(opacity, 5.5)).toBe(0);
        expect(atZoom(opacity, 6.4)).toBe(0);
        expect(atZoom(opacity, 7.2)).toBe(1);
        expect(atZoom(opacity, 13)).toBe(1);
        expect(layerOf(build(), 'mp-outline-edge').paint['line-opacity']).toEqual(
            opacity,
        );
    });

    it('shows at any zoom while a county or a constituency is focused', () => {
        for (const level of ['county', 'constituency'] as const) {
            const opacity = layerOf(build({ focus: { level, code: 1 } }), 'mp-outline')
                .paint['line-opacity'];
            expect(atZoom(opacity, 5), level).toBe(1);
            expect(atZoom(opacity, 13), level).toBe(1);
        }
    });

    it('greys and fades the outlines outside the focused unit when the surroundings are shown', () => {
        const outside = ['!=', ['get', 'county_code'], 47];
        const st = build({
            focus: { level: 'county', outside: { constituencies: outside as never } },
        });
        const colour = layerOf(st, 'mp-outline').paint['line-color'] as unknown[];
        expect(colour.slice(0, 3)).toEqual(['case', outside, T.muted]);
        const opacity = layerOf(st, 'mp-outline').paint['line-opacity'] as unknown[];
        expect(opacity[0]).toBe('case');
        expect(opacity[1]).toEqual(outside);
        expect(opacity[2]).toBeLessThan(0.5);
    });

    it('is in the style in every view but drawn only in the MCA view with outlines on', () => {
        for (const colouring of [
            undefined,
            seatColouring(seats, 'mca', tokens),
            seatColouring(seats, 'mp', tokens),
        ]) {
            const st = build({ colouring });
            for (const id of ['mp-outline', 'mp-outline-edge'])
                expect(layerOf(st, id).paint['line-opacity']).toBe(0);
            expect(layerOf(st, 'labels-mp').layout['text-field']).toBe('');
        }
    });
});

describe('the "MP: <ABBREV>" badges', () => {
    it('labels each constituency’s label point with its badge, "MP: no data" for the rest', () => {
        const badge = layerOf(build(), 'labels-mp');
        expect(badge.source).toBe('labels');
        expect(badge.filter).toEqual(['==', ['get', 'level'], 'constituency']);
        const text = matchOf(badge.layout['text-field']);
        expect(text['290']).toBe('MP: ODM');
        expect(text['287']).toBe('MP: Independent');
        expect(text['*']).toBe('MP: no data');
    });

    it('gives way to the constituency names and the ward names: they are placed first', () => {
        const st = build();
        // MapLibre places the layers on top first, so a layer lower in the list has less priority.
        expect(order(st, 'labels-mp')).toBeLessThan(order(st, 'labels-constituency'));
        expect(order(st, 'labels-mp')).toBeLessThan(order(st, 'labels-ward'));
        expect(layerOf(st, 'labels-mp').layout['text-allow-overlap']).toBe(false);
    });

    it('shows from the constituency zoom band, as the outlines do', () => {
        expect(layerOf(build(), 'labels-mp').minzoom).toBeGreaterThanOrEqual(6.6);
        expect(layerOf(build(), 'labels-mp').minzoom).toBeLessThanOrEqual(7.5);
    });
});

describe('the MCA’s name on the selected ward’s label', () => {
    const ward = (code: number, over = {}) =>
        build({ focus: { level: 'ward', code }, ...over });
    const full = (st = ward(1448)) => layerOf(st, 'labels-ward-mca');
    /** The sections of a `format` text field. */
    const formatOf = (expr: unknown) => {
        const e = expr as unknown[];
        expect(e[0]).toBe('format');
        return e.slice(1);
    };
    const off = (st: ReturnType<typeof build>) => {
        expect(full(st).filter).toEqual(['==', ['get', 'code'], -1]);
        expect(full(st).layout['text-field']).toBe('');
    };

    it('adds a second, smaller, muted line under the ward’s name: the MCA and the party', () => {
        const [name, nameOpts, br, , line, lineOpts] = formatOf(
            full().layout['text-field'],
        );
        expect(name).toEqual(['get', 'name']);
        expect(nameOpts).toEqual({});
        expect(br).toBe('\n');
        expect(line).toBe('Placeholder mca 1448 (ODM)');
        expect((lineOpts as { 'font-scale': number })['font-scale']).toBeLessThan(1);
        expect((lineOpts as { 'text-color': string })['text-color']).toBe(T.muted);
        expect(full().filter).toEqual([
            'all',
            ['==', ['get', 'level'], 'ward'],
            ['==', ['get', 'code'], 1448],
        ]);
    });

    it('gives the name exactly as the data spells it', () => {
        const spelt = {
            ...seats,
            holders: seats.holders.map((h) =>
                h.seat === 'mca' && h.code === 1448
                    ? { ...h, name: "O'Placeholder wa TEST-case" }
                    : h,
            ),
        };
        expect(mcaNameLines(spelt).get(1448)).toBe(
            "O'Placeholder wa TEST-case (ODM)",
        );
        expect(mcaNameLines(seats).get(1439)).toBe(
            'Placeholder mca 1439 (Independent)',
        );
        const st = ward(1448, {
            colouring: {
                ...seatColouring(spelt, 'mca', tokens),
                names: mcaNameLines(spelt),
            },
        });
        expect(formatOf(full(st).layout['text-field'])[4]).toBe(
            "O'Placeholder wa TEST-case (ODM)",
        );
    });

    it('shows a ward with no approved MCA by its name alone', () => {
        expect(mcaNameLines(seats).has(1450)).toBe(false);
        off(ward(1450));
        expect(layerOf(ward(1450), 'labels-ward').layout['text-field']).toEqual([
            'get',
            'name',
        ]);
    });

    it('shows on the selected ward only: not across a focused constituency, a county or all of Kenya', () => {
        // The plan's first rule (every ward that is large enough) was built and looked cluttered
        // in Mathare, so its fallback applies: the selected ward, and the hover tooltip.
        off(build());
        off(build({ focus: { level: 'county', code: 47 } }));
        off(build({ focus: { level: 'constituency', code: 290 } }));
        // A ward focus drawn as its constituency (while the wards load) has no name line yet.
        off(build({ focus: { level: 'constituency', code: 1448 } }));
    });

    it('drops the name line before the ward’s name: the two-line label is placed first, the name alone fills in', () => {
        const st = ward(1448);
        // Higher in the list is placed first. If the two lines do not fit, the plain name (lower,
        // placed later) still gets its turn at the same point.
        expect(order(st, 'labels-ward-mca')).toBeGreaterThan(order(st, 'labels-ward'));
        expect(full(st).layout['text-allow-overlap']).toBe(false);
        expect(layerOf(st, 'labels-ward').layout['text-allow-overlap']).toBe(false);
    });

    it('is not in play outside the MCA view', () => {
        for (const colouring of [
            undefined,
            seatColouring(seats, 'mp', tokens),
            seatColouring(seats, 'mca', tokens),
        ])
            off(ward(1448, { colouring }));
    });

    it('leaves out a name line that would need more than two lines, rather than cut it', () => {
        expect(fitsNameLine('Placeholder mca 1448 (ODM)')).toBe(true);
        expect(fitsNameLine('Redson Otieno Onyango (ODM)')).toBe(true);
        expect(
            fitsNameLine(
                'Placeholder With A Very Long Run Of Names That Goes On And On (ODM)',
            ),
        ).toBe(false);
        expect(fitsNameLine('Supercalifragilisticexpialidociousname (ODM)')).toBe(
            false,
        );
        const long = {
            ...seats,
            holders: seats.holders.map((h) =>
                h.seat === 'mca' && h.code === 1448
                    ? {
                          ...h,
                          name: 'Placeholder With A Very Long Run Of Names That Goes On And On',
                      }
                    : h,
            ),
        };
        off(
            ward(1448, {
                colouring: {
                    ...seatColouring(long, 'mca', tokens),
                    names: mcaNameLines(long),
                },
            }),
        );
    });
});

describe('focus mode and the new layers', () => {
    it('limits the outlines, badges and name lines to the focused unit, like the layers they follow', () => {
        for (const id of [
            'mp-outline',
            'mp-outline-edge',
            'labels-mp',
            'labels-ward-mca',
        ])
            expect(FOCUS_LAYERS, id).toContain(id);
        const f = focusFilters({ level: 'constituency', code: 290 }, leadersIndex);
        expect(f['mp-outline']).toEqual(f['constituencies-line']);
        expect(f['mp-outline-edge']).toEqual(f['constituencies-line']);
        expect(f['labels-mp']).toEqual(f['labels-constituency']);
        expect(f['labels-ward-mca']).toEqual(f['labels-ward']);
        const none = focusFilters(null, leadersIndex);
        expect(none['mp-outline']).toBeNull();
        expect(none['labels-ward-mca']).toBeNull();
    });
});
