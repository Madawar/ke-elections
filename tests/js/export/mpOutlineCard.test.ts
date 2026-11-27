// Task 6 on the cards: an MCA card's map outlines each constituency in its MP's party colour, a
// constituency's card has its MP in the strip (name, party, since), and a county's card counts
// its MPs by party in one line.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ViewCard from '@/components/export/ViewCard.vue';
import type { Box, TextItem } from '@/lib/export/layout';
import { leadersCardView } from '@/lib/export/leadersCard';
import { leadersStrip } from '@/lib/export/leadersStrip';
import { VIEW_SIZES, type ViewSize } from '@/lib/export/sizes';
import { textWidth } from '@/lib/export/text';
import { viewLayout } from '@/lib/export/viewLayout';
import { viewColouring, viewStyle } from '@/lib/export/viewMap';
import { headlineFor, snapshotView, withTheme } from '@/lib/export/viewState';
import { buildLegend } from '@/lib/legend';
import { leadersFor } from '@/lib/leaders';
import { THEMES } from '@/lib/map/theme';
import { legendScope } from '@/lib/seats';
import { LEADERS_SEATS as seats, leadersIndex as index } from '../leadersFixtures';

const SIZES = Object.keys(VIEW_SIZES) as ViewSize[];
const T = THEMES.dark;
const view = (
    seat: 'mca' | 'mp',
    focus: { level: 'county' | 'constituency' | 'ward'; code: number } | null,
    over: { mpOutlines?: boolean; onlyMp?: string[] } = {},
) =>
    snapshotView({
        seats,
        index,
        seat,
        focus,
        only: [],
        showSurroundings: false,
        theme: 'dark',
        ...over,
    });
const county = view('mca', { level: 'county', code: 47 });
const constituency = view('mca', { level: 'constituency', code: 290 });
const URL = 'https://example.org/county/47?seat=mca';
const layout = (v: typeof county, size: ViewSize, aspect = 1.5) =>
    viewLayout(size, v, { headline: headlineFor(v), url: URL, mapAspect: aspect });

describe('which cards carry the MP outlines', () => {
    it('is an MCA card for a county or a constituency', () => {
        expect(county.outline).toBe(true);
        expect(constituency.outline).toBe(true);
        expect(view('mca', null).outline).toBe(false);
        expect(view('mca', { level: 'ward', code: 1448 }).outline).toBe(false);
        expect(view('mp', { level: 'county', code: 47 }).outline).toBe(false);
    });

    it('follows the "Show MPs as outlines" setting and the outlines’ own highlight', () => {
        const off = view('mca', { level: 'county', code: 47 }, { mpOutlines: false });
        expect(off.outline).toBe(false);
        expect(off.mpLine).toBeNull();
        const only = view('mca', { level: 'county', code: 47 }, { onlyMp: ['JP'] });
        expect(only.onlyMp).toEqual(['JP']);
        // The other theme keeps both.
        const light = withTheme(only, 'light', { seats, index });
        expect(light.outline).toBe(true);
        expect(light.onlyMp).toEqual(['JP']);
    });
});

describe('the card map, drawn the same layered way', () => {
    const ctx = { manifest: {}, provinceOfCounty: new Map([[47, 8]]), index, seats };
    const outlineOf = (v: Parameters<typeof viewStyle>[0]) =>
        viewStyle(v, ctx, T).layers.find((l) => l.id === 'mp-outline') as {
            paint: Record<string, unknown>;
        };

    it('keeps the ward fills as the MCAs’ colours and outlines each constituency in its MP’s', () => {
        const col = viewColouring(county, seats, T);
        expect(col.mode).toEqual({ kind: 'seat', seat: 'mca' });
        expect(col.colours.get(1448)).toBe('#e07b24');
        expect(col.outline?.colours.get(290)).toBe('#e07b24');
        expect(col.outline?.colours.get(289)).toBe('#c8323c');
        expect(JSON.stringify(outlineOf(county).paint['line-color'])).toContain(
            '#c8323c',
        );
        expect(outlineOf(county).paint['line-opacity']).toBe(1);
    });

    it('fades the outlines of the parties that are not highlighted', () => {
        const only = view('mca', { level: 'county', code: 47 }, { onlyMp: ['JP'] });
        const col = viewColouring(only, seats, T);
        expect(col.outline?.colours.get(289)).toBe('#c8323c');
        expect(col.outline?.colours.get(290)).toBe(T.faded);
    });

    it('draws no outline on the cards that have none', () => {
        expect(viewColouring(view('mca', null), seats, T).outline).toBeUndefined();
        expect(outlineOf(view('mca', null)).paint['line-opacity']).toBe(0);
        expect(
            outlineOf(view('mp', { level: 'county', code: 47 })).paint[
                'line-opacity'
            ],
        ).toBe(0);
    });

    it('outlines a constituency’s leaders card too, and not a county’s or a ward’s', () => {
        const card = (level: 'county' | 'constituency' | 'ward', code: number) =>
            leadersCardView({ seats, index, focus: { level, code }, theme: 'dark' })!;
        expect(card('constituency', 290).outline).toBe(true);
        expect(card('county', 47).outline).toBe(false);
        expect(card('ward', 1448).outline).toBe(false);
        expect(
            viewColouring(card('constituency', 290), seats, T).outline?.colours.get(
                290,
            ),
        ).toBe('#e07b24');
    });
});

describe('a constituency’s MCA card: the MP block above the ward rows', () => {
    it('gives the MP’s name exactly as the data spells it, the party and since when, in all four sizes', () => {
        for (const size of SIZES) {
            const l = layout(constituency, size);
            const mp = l.leaders!.rows[0];
            expect(mp.seat, size).toBe('mp');
            const text = mp.texts.map((t) => t.text);
            expect(text.slice(0, 3), size).toEqual([
                'MP',
                'Placeholder mp 290',
                'ODM',
            ]);
            // The square card, the shortest of room, drops "since" when it does not fit its cell.
            if (size !== 'square') expect(text, size).toContain('since 2022');
            // Above the ward rows (on X the strip may sit under the map instead).
            if (l.leaders!.box.x >= l.rowsBox!.x - 1)
                expect(l.leaders!.box.y + l.leaders!.box.h, size).toBeLessThanOrEqual(
                    l.rowsBox!.y,
                );
        }
    });

    it('has no MPs line: its one MP is named', () => {
        expect(constituency.mpLine).toBeNull();
        for (const size of SIZES)
            expect(layout(constituency, size).leaders!.note, size).toEqual([]);
    });
});

describe('a county’s MCA card: the MPs line', () => {
    it('counts the county’s MPs by party, from the MP legend of that county', () => {
        const scope = legendScope(index, 'mp', { level: 'county', code: 47 })!;
        const rows = buildLegend(
            seats,
            'mp',
            { codes: scope.codes, unitName: scope.unit.n },
            [],
        ).rows;
        expect(county.mpLine).toBe(
            `MPs (outlines): ${rows.map((r) => `${r.label} ${r.count}`).join(', ')}`,
        );
        // Mathare's MP is ODM and Starehe's is JP: one each, ties by abbreviation.
        expect(county.mpLine).toBe('MPs (outlines): JP 1, ODM 1');
    });

    const textBox = (t: TextItem): Box => ({
        x: t.x,
        y: t.y - t.size * 0.8,
        w: textWidth(t.text, t.size, (t.weight ?? 400) >= 600),
        h: t.size,
    });
    const apart = (a: Box, b: Box) =>
        a.x + a.w <= b.x + 0.5 ||
        b.x + b.w <= a.x + 0.5 ||
        a.y + a.h <= b.y + 0.5 ||
        b.y + b.h <= a.y + 0.5;
    const noteOf = (strip: { note: TextItem[] }) =>
        strip.note.map((t) => t.text).join(' ');

    it('prints the line on every size and shape: the outlines on the map always have their key', () => {
        for (const size of SIZES)
            for (const aspect of [0.6, 1.05, 1.5, 2.3]) {
                const strip = layout(county, size, aspect).leaders!;
                expect(noteOf(strip), `${size} ${aspect}`).toBe(
                    'MPs (outlines): JP 1, ODM 1',
                );
                const others = [
                    ...strip.rows.flatMap((r) => r.texts),
                    ...(strip.more ? [strip.more] : []),
                ].map(textBox);
                for (const line of strip.note.map(textBox)) {
                    for (const t of others)
                        expect(apart(line, t), `${size} ${aspect}`).toBe(true);
                    expect(line.y + line.h).toBeLessThanOrEqual(
                        strip.box.y + strip.box.h + 0.5,
                    );
                    expect(line.x + line.w).toBeLessThanOrEqual(
                        strip.box.x + strip.box.w + 0.5,
                    );
                }
            }
    });

    const rows = leadersFor(index.get('county', 47)!, seats, index);
    const base = {
        x: 0,
        y: 0,
        w: 900,
        maxH: 400,
        rows,
        font: 24,
        link: 'example.org/county/47',
        columns: 1 as const,
    };

    it('wraps a long line (a county with many parties) rather than cut or drop it', () => {
        const long = `MPs (outlines): ${Array.from({ length: 17 }, (_, i) => `PARTY${i} 1`).join(', ')}`;
        const strip = leadersStrip({ ...base, note: long })!;
        expect(strip.note.length).toBeGreaterThan(1);
        expect(noteOf(strip)).toBe(long);
        for (const t of strip.note) expect(t.text).not.toContain('…');
        // Each line stands clear of the one above.
        const boxes = strip.note.map(textBox);
        for (let i = 1; i < boxes.length; i++)
            expect(apart(boxes[i - 1], boxes[i])).toBe(true);
    });

    it('never costs a leader row for nothing: the rows shorten only when rows and line together do not fit, and the line still shows', () => {
        const note = 'MPs (outlines): ODM 8';
        const full = leadersStrip({ ...base, note })!;
        expect(full.rows).toHaveLength(3);
        const rowsOnly = leadersStrip(base)!.box.h;
        // Room for the three rows but not for the line as well: the line is the map's key, so
        // the rows give way ("+1 more"), and the line is printed under them.
        const tight = leadersStrip({ ...base, maxH: rowsOnly + 4, note })!;
        expect(tight.rows.map((r) => r.seat)).toEqual(['governor', 'senator']);
        expect(tight.more?.text).toBe('+1 more at example.org/county/47');
        expect(noteOf(tight)).toBe(note);
        expect(apart(textBox(tight.more!), textBox(tight.note[0]))).toBe(true);
        // With the room for both, nothing is shortened.
        const roomy = leadersStrip({ ...base, maxH: full.box.h, note })!;
        expect(roomy.rows).toHaveLength(3);
        expect(roomy.more).toBeNull();
        expect(noteOf(roomy)).toBe(note);
        // And without a line the rows alone decide.
        expect(leadersStrip({ ...base, maxH: rowsOnly })!.rows).toHaveLength(3);
    });

    it('names the MPs’ sources in the footer with the card’s own', () => {
        const other = snapshotView({
            seats: {
                ...seats,
                holders: seats.holders.map((h) =>
                    h.seat === 'mp' && h.code === 289
                        ? { ...h, source_url: 'https://www.parliament.go.ke/x' }
                        : h,
                ),
            },
            index,
            seat: 'mca',
            focus: { level: 'county', code: 47 },
            only: [],
            showSurroundings: false,
            theme: 'dark',
        });
        expect(other.sources).toContain('parliament.go.ke');
        // With the outlines off, the MPs are not on the card, and neither is their source.
        expect(
            snapshotView({
                seats: {
                    ...seats,
                    holders: seats.holders.map((h) =>
                        h.seat === 'mp' && h.code === 289
                            ? { ...h, source_url: 'https://www.parliament.go.ke/x' }
                            : h,
                    ),
                },
                index,
                seat: 'mca',
                focus: { level: 'county', code: 47 },
                only: [],
                showSurroundings: false,
                theme: 'dark',
                mpOutlines: false,
            }).sources,
        ).not.toContain('parliament.go.ke');
    });

    it('is drawn on the card', () => {
        const w = mount(ViewCard, {
            props: {
                view: county,
                size: 'portrait',
                headline: headlineFor(county),
                mapImage: 'data:image/png;base64,AAAA',
                url: URL,
                theme: T,
                mapAspect: 1.5,
            },
        });
        expect(w.get('[data-leaders-note]').text()).toBe(
            'MPs (outlines): JP 1, ODM 1',
        );
    });
});
