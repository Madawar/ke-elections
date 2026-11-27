// The county tiles card laid out and drawn: equal square tiles on one pitch, names whole and inside
// their tiles, the key in the grid's empty corner when it fits there, nothing overlapping or off
// the card, story zones kept, and the component drawing what the layout returns.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TilesCard from '@/components/export/TilesCard.vue';
import { COUNTY_TILES, TILE_COLUMNS, TILE_ROWS } from '@/lib/export/countyTiles';
import type { Box } from '@/lib/export/layout';
import { componentOf, layoutOf } from '@/lib/export/shareView';
import {
    type TileSeat,
    type TilesCardView,
    tilesCardView,
    tilesHeadline,
} from '@/lib/export/tilesCard';
import { type TilesLayout, nameLines, tilesLayout } from '@/lib/export/tilesLayout';
import { HEADLINE_STRETCH, SPECS } from '@/lib/export/viewLayout';
import { CODES_CREDIT, THEMES, type ThemeName } from '@/lib/map/theme';
import { type SeatsData, withIndependentColour } from '@/lib/seats';
import { apart, inside, textBox, within } from './ballotsChecks';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';
import { tilesFaults, manyParties, without } from './tilesChecks';

const SIZES = ['portrait', 'story'] as const;
const URL = 'https://example.org/?seat=governor';
const themed = (data: SeatsData, theme: ThemeName) =>
    withIndependentColour(data, THEMES[theme].independent);
const view = (
    seat: TileSeat = 'governor',
    data: SeatsData = NUMBERS_SEATS,
    theme: ThemeName = 'light',
) => tilesCardView({ seats: themed(data, theme), index, seat, theme });
const layout = (c: TilesCardView, size: (typeof SIZES)[number], headline = tilesHeadline(c)) =>
    tilesLayout(size, c, { headline, url: URL });
const card = view();

/** The lines of a name joined back: no space after a break inside a word ("Elgeyo/" "Marakwet"). */
const joined = (lines: string[]) =>
    lines.reduce((s, l, i) => (i === 0 ? l : /[^\s][/-]$/.test(s) ? s + l : `${s} ${l}`), '');

describe('nameLines', () => {
    it('breaks at spaces, and after a slash or hyphen inside a word, never cutting', () => {
        expect(nameLines('Elgeyo/Marakwet', 90, 16)).toEqual(['Elgeyo/', 'Marakwet']);
        expect(nameLines('Elgeyo/Marakwet', 400, 16)).toEqual(['Elgeyo/Marakwet']);
        expect(nameLines('Tharaka - Nithi', 90, 16)).toEqual(['Tharaka -', 'Nithi']);
        expect(nameLines('Trans Nzoia', 90, 16)).toEqual(['Trans', 'Nzoia']);
        expect(nameLines('Mombasa', 400, 16)).toEqual(['Mombasa']);
        // A word that does not fit at this size: no lines, so the caller takes a smaller size.
        expect(nameLines('Nyandarua', 20, 16)).toBeNull();
    });
});

describe('tilesLayout', () => {
    it('draws 47 equal square tiles on one pitch, in their grid cells, with even gutters', () => {
        for (const size of SIZES) {
            const l = layout(card, size);
            expect(l.tiles).toHaveLength(47);
            const s = l.tile;
            const pitch = s + l.gutter;
            expect(l.gutter).toBeGreaterThan(0);
            for (const t of l.tiles) {
                const cell = COUNTY_TILES[t.code];
                expect(t.box, `${size} ${t.code}`).toEqual({
                    x: l.grid.x + cell.col * pitch,
                    y: l.grid.y + cell.row * pitch,
                    w: s,
                    h: s,
                });
            }
            expect(l.grid.w).toBe(TILE_COLUMNS * pitch - l.gutter);
            expect(l.grid.h).toBe(TILE_ROWS * pitch - l.gutter);
        }
    });

    it('fills each tile with its county’s colour and writes the name in the tile’s ink', () => {
        for (const theme of ['light', 'dark'] as const) {
            const c = view('woman_rep', NUMBERS_SEATS, theme);
            const l = layout(c, 'portrait');
            for (const t of l.tiles) {
                const tile = c.tiles.find((x) => x.code === t.code)!;
                expect(t.colour).toBe(tile.colour);
                expect(t.ink).toBe(tile.ink);
            }
        }
    });

    it('writes every name whole, as the index spells it, inside its tile, at one size for all', () => {
        for (const size of SIZES) {
            const l = layout(card, size);
            const sizes = new Set(l.tiles.flatMap((t) => t.name.map((n) => n.size)));
            expect(sizes.size, size).toBe(1);
            for (const t of l.tiles) {
                const name = index.get('county', t.code)!.n;
                expect(joined(t.name.map((n) => n.text)), `${size} ${t.code}`).toBe(name);
                const inner: Box = {
                    x: t.box.x + 4,
                    y: t.box.y + 4,
                    w: t.box.w - 8,
                    h: t.box.h - 8,
                };
                for (const n of t.name) {
                    expect(n.text).not.toContain('…');
                    expect(within(textBox(n), inner), `${size} "${n.text}"`).toBe(true);
                    expect(n.weight).toBe(700);
                }
            }
            const lines = (code: number) => l.tiles.find((t) => t.code === code)!.name.map((n) => n.text);
            expect(lines(28)).toEqual(['Elgeyo/', 'Marakwet']);
            expect(lines(13)).toEqual(['Tharaka -', 'Nithi']);
        }
    });

    it('keeps the names readable: not below a floor of the tile size', () => {
        for (const size of SIZES) {
            const l = layout(card, size);
            expect(l.tiles[0].name[0].size).toBeGreaterThanOrEqual(Math.round(l.tile * 0.12));
            expect(l.tiles[0].name[0].size).toBeGreaterThanOrEqual(SPECS[size].footer.small - 3);
        }
    });

    it('lists the key as the card has it, with counts, in two columns, "No approved holder yet" on a line of its own', () => {
        const vacant = view('governor', without('governor', 2));
        for (const c of [card, vacant])
            for (const size of SIZES) {
                const l = layout(c, size);
                expect(l.key.entries.map((e) => [e.key, e.label.text, e.count.text])).toEqual(
                    c.key.map((k) => [k.key, k.label, String(k.count)]),
                );
                expect(l.key.entries.map((e) => e.chip.colour)).toEqual(c.key.map((k) => k.colour));
                // "Other parties" may have a line of its own under the columns, as "No approved
                // holder yet" always has.
                const other = l.key.entries.findIndex((e) => e.key === 'other');
                const ownOther =
                    other > 0 &&
                    l.key.entries[other].label.y >
                        Math.max(...l.key.entries.slice(0, other).map((e) => e.label.y));
                const cols = c.key.filter((k) => k.key !== 'none' && !(ownOther && k.key === 'other'));
                const per = Math.ceil(cols.length / 2);
                if (ownOther) expect(l.key.entries[other].chip.x).toBe(l.key.entries[0].chip.x);
                const xs = l.key.entries.map((e) => e.chip.x);
                expect(new Set(xs.slice(0, per)).size).toBe(1);
                expect(new Set(xs.slice(per, cols.length)).size).toBe(1);
                expect(xs[per]).toBeGreaterThan(xs[0]);
                for (const e of l.key.entries) {
                    expect(e.label.tone).toBe('ink');
                    expect(e.count.tone).toBe('muted');
                    expect(e.count.x).toBeGreaterThan(e.label.x);
                }
                if (c.vacant) {
                    const none = l.key.entries.at(-1)!;
                    expect(none.key).toBe('none');
                    expect(none.chip.x).toBe(xs[0]);
                    expect(none.label.y).toBeGreaterThan(Math.max(...l.key.entries.slice(0, -1).map((e) => e.label.y)));
                }
            }
    });

    it('puts the key in the grid’s empty bottom-left corner when it fits there, clear of every tile', () => {
        for (const size of SIZES) {
            const l = layout(card, size);
            expect(l.key.inCorner, size).toBe(true);
            // The key's box is inside the grid, on empty cells only.
            expect(within(l.key.box, l.grid), size).toBe(true);
            for (const t of l.tiles) expect(apart(l.key.box, t.box), `${size} ${t.code}`).toBe(true);
            // Its type is the card's small text or a little smaller, never below the footer's smallest.
            const keySize = l.key.entries[0].label.size;
            expect(keySize).toBeLessThanOrEqual(SPECS[size].callout.sub);
            expect(keySize).toBeGreaterThanOrEqual(SPECS[size].footer.small);
        }
    });

    it('gives "Other parties" a line of its own when that is what lets the key fit the corner', () => {
        // The fixtures' Woman Reps: "Independent 3" in the first column and "Other parties 3" in the
        // second are too wide together for the story's corner; on a line of its own it fits.
        const c = view('woman_rep');
        const l = layout(c, 'story');
        expect(l.key.inCorner).toBe(true);
        const other = l.key.entries.find((e) => e.key === 'other')!;
        expect(other.chip.x).toBe(l.key.entries[0].chip.x);
        expect(other.label.y).toBeGreaterThan(
            Math.max(...l.key.entries.filter((e) => e.key !== 'other').map((e) => e.label.y)),
        );
    });

    it('puts the key under the grid when it does not fit the corner, and the tiles give way', () => {
        const many = view('governor', manyParties(10));
        expect(many.key.length).toBe(19);
        for (const size of SIZES) {
            const l = layout(many, size);
            const plain = layout(card, size);
            expect(l.key.inCorner, size).toBe(false);
            expect(l.key.box.y).toBeGreaterThan(l.grid.y + l.grid.h);
            expect(l.tile).toBeLessThan(plain.tile);
            expect(l.key.entries[0].label.size).toBe(SPECS[size].callout.sub);
        }
    });

    it('keeps everything on the card and apart, cuts nothing and keeps the story zones', () => {
        const cases: [string, TilesCardView][] = [
            ['governor', card],
            ['woman rep', view('woman_rep')],
            ['vacant', view('senator', without('senator', 5))],
            ['many', view('governor', manyParties(6))],
            ['more', view('governor', manyParties(10))],
            ['dark', view('governor', NUMBERS_SEATS, 'dark')],
        ];
        for (const [name, c] of cases)
            for (const size of SIZES) {
                const l = layout(c, size);
                expect(tilesFaults(l, size, c), `${name} ${size}`).toEqual([]);
            }
    });

    it('fits an edited headline as the other cards do', () => {
        const l = layout(card, 'portrait', 'Every governor, county by county, by the party they hold');
        expect(tilesFaults(l, 'portrait', card)).toEqual([]);
        expect(l.headlineLines.length).toBeGreaterThanOrEqual(1);
        expect(l.headlineLines[0].size * HEADLINE_STRETCH).toBeGreaterThan(0);
    });

    it('credits only the codes the counts are joined on: it draws no map', () => {
        for (const size of SIZES) expect(layout(card, size).attribution).toBe(CODES_CREDIT);
    });

    it('is what the share dialog lays out and draws for the card', () => {
        const text = { headline: tilesHeadline(card), url: URL, mapAspect: 1 };
        expect(layoutOf('story', card, text)).toEqual(tilesLayout('story', card, text));
        expect(componentOf(card)).toBe(TilesCard);
    });
});

describe('TilesCard', () => {
    const draw = (c: TilesCardView, size: (typeof SIZES)[number] = 'portrait', theme: ThemeName = 'light') =>
        mount(TilesCard, {
            props: {
                view: c,
                size,
                headline: tilesHeadline(c),
                url: URL,
                theme: THEMES[theme],
                mapImage: null,
                mapImages: {},
                mapPlaceholder: '',
                mapAspect: 1,
            },
        });

    it('draws each size with its own viewBox', () => {
        expect(draw(card, 'portrait').attributes('viewBox')).toBe('0 0 1080 1350');
        expect(draw(card, 'story').attributes('viewBox')).toBe('0 0 1080 1920');
    });

    it('draws a tile per county in its colour, the name in the tile’s ink, the key, the footer and no image', () => {
        const w = draw(card);
        const tiles = w.findAll('[data-tile]');
        expect(tiles).toHaveLength(47);
        for (const t of tiles) {
            const code = Number(t.attributes('data-tile'));
            const tile = card.tiles.find((x) => x.code === code)!;
            expect(t.find('rect').attributes('fill')).toBe(tile.colour);
            for (const text of t.findAll('text')) expect(text.attributes('fill')).toBe(tile.ink);
        }
        expect(w.find('[data-tile="28"]').text()).toContain('Elgeyo/');
        expect(w.find('[data-tile="28"]').text()).toContain('Marakwet');
        expect(w.findAll('[data-headline]').map((t) => t.text()).join(' ')).toBe('Governors by party');
        const key = w.find('[data-key]').text();
        expect(key).toContain('UDA');
        expect(key).toContain('20');
        expect(key).toContain('Other parties');
        const text = w.text();
        expect(text).toContain('Every county drawn the same size, so small ones count too');
        expect(text).toContain('Source: IEBC gazette notices.');
        expect(text).toContain('Data as of 16 July 2026.');
        expect(w.find('image').exists()).toBe(false);
        const footer = w.find('[data-footer]').text();
        expect(footer).toContain(CODES_CREDIT);
        expect(footer).not.toContain('Boundaries');
        expect(footer).not.toContain('OpenStreetMap');
    });

    it('marks sample data as sample', () => {
        expect(draw({ ...card, sample: true }).text()).toContain('SAMPLE DATA');
        expect(draw(card).find('[data-watermark]').exists()).toBe(false);
    });
});
