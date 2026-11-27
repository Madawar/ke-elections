// A card map with a frame and a marked unit inside it (the ward card's locators): the frame is the
// spec's focus, the marked unit is filled in the ink colour, the rest of the frame in the no-data
// colour, and nothing outside the frame is drawn. A marked unit too small to find gets a ring.
// Everything by IEBC code.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: Record<string, unknown>[] = [];
vi.mock('@/lib/export/renderMapImage', () => ({
    renderMapImage: vi.fn(async (opts: Record<string, unknown>) => {
        calls.push(opts);
        return 'data:image/png;base64,MAP';
    }),
}));

const {
    MARK_MIN_PX,
    markRing,
    renderViewMap,
    viewColouring,
    viewStyle,
} = await import('@/lib/export/viewMap');
import type { ViewMapSpec } from '@/lib/export/viewMap';
import { THEMES } from '@/lib/map/theme';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';

const ctx = {
    manifest: {},
    provinceOfCounty: new Map<number, number>(),
    index,
    seats: NUMBERS_SEATS,
};
const focusOf = (level: 'county' | 'constituency', code: number) => {
    const u = index.get(level, code)!;
    return { level, code, name: u.n, b: u.b };
};
// Kakamega (county 37), Shinyalu (constituency 209), Isukha West (ward 1046);
// Nairobi City (47), Mathare (290), Ngei (1448).
const isukha = index.get('ward', 1046)!;
const shinyalu = index.get('constituency', isukha.p!)!;
const kakamega = index.get('county', shinyalu.p!)!;

const spec = (
    focus: ReturnType<typeof focusOf>,
    mark: { level: 'constituency' | 'ward'; code: number },
): ViewMapSpec => ({
    seat: mark.level === 'ward' ? 'mca' : 'mp',
    only: [],
    focus,
    showSurroundings: false,
    mark,
    wardLines: false,
});

describe('a card map with a marked unit', () => {
    beforeEach(() => {
        calls.length = 0;
    });

    it('fills the marked unit, by code, in the ink colour and every other unit in the no-data colour', () => {
        for (const theme of ['light', 'dark'] as const) {
            const T = THEMES[theme];
            const ward = viewColouring(
                spec(focusOf('county', kakamega.c), { level: 'ward', code: 1046 }),
                NUMBERS_SEATS,
                T,
            );
            expect(ward.mode).toEqual({ kind: 'seat', seat: 'mca' });
            expect([...ward.colours]).toEqual([[1046, T.ink]]);
            expect(ward.fallback).toBe(T.noData);
            const constituency = viewColouring(
                spec(focusOf('county', kakamega.c), {
                    level: 'constituency',
                    code: shinyalu.c,
                }),
                NUMBERS_SEATS,
                T,
            );
            expect(constituency.mode).toEqual({ kind: 'seat', seat: 'mp' });
            expect([...constituency.colours]).toEqual([[shinyalu.c, T.ink]]);
        }
    });

    it('draws only the frame, on the paper’s surface colour when asked', () => {
        const s = { ...spec(focusOf('county', kakamega.c), { level: 'ward', code: 1046 }), onSurface: true };
        const style = viewStyle(s, ctx, THEMES.light);
        const bg = style.layers.find((l) => l.type === 'background') as {
            paint: Record<string, unknown>;
        };
        expect(bg.paint['background-color']).toBe(THEMES.light.surface);
        // The frame is the focus: the same filters as any focused card map.
        const plain = viewStyle(
            { seat: 'mca', only: [], focus: s.focus, showSurroundings: false, wardLines: false },
            ctx,
            THEMES.light,
        );
        const filters = (st: typeof style) =>
            st.layers
                .filter((l) => l.id.endsWith('-fill'))
                .map((l) => [l.id, (l as { filter?: unknown }).filter]);
        expect(filters(style)).toEqual(filters(plain));
        // Without the option the background is the card's land, as before.
        const land = viewStyle(plain, ctx, THEMES.light).layers.find(
            (l) => l.type === 'background',
        ) as { paint: Record<string, unknown> };
        expect(land.paint['background-color']).toBe(THEMES.light.land);
    });

    it('outlines the marked unit, not the frame', async () => {
        const s = spec(focusOf('constituency', shinyalu.c), { level: 'ward', code: 1046 });
        await renderViewMap(s, ctx, THEMES.light, { x: 0, y: 0, w: 200, h: 160 });
        expect(calls[0].highlight).toEqual({ level: 'ward', code: 1046 });
        expect(calls[0].bounds).toEqual(shinyalu.b);
        // A map with no mark outlines its focus, as before.
        const { mark: _m, ...plain } = s;
        await renderViewMap(plain, ctx, THEMES.light, { x: 0, y: 0, w: 200, h: 160 });
        expect(calls[1].highlight).toEqual({ level: 'constituency', code: shinyalu.c });
    });

    it('rings a marked unit drawn smaller than the least visible size, and only then', async () => {
        const box = { x: 0, y: 0, w: 220, h: 220 };
        // Ngei in Nairobi City is a few pixels across at this size.
        const ngei = spec(focusOf('county', 47), { level: 'ward', code: 1448 });
        const ring = markRing(ngei, ctx, box)!;
        expect(ring).not.toBeNull();
        expect(ring.drawn).toBeLessThan(MARK_MIN_PX);
        const ngeiB = index.get('ward', 1448)!.b;
        expect(ring.centre[0]).toBeCloseTo((ngeiB[0] + ngeiB[2]) / 2, 5);
        await renderViewMap(ngei, ctx, THEMES.dark, box);
        const layers = (calls[0].style as { layers: { id: string; paint?: Record<string, unknown> }[] }).layers;
        const drawn = layers.find((l) => l.id === 'mark-ring')!;
        expect(drawn.paint!['circle-stroke-color']).toBe(THEMES.dark.ink);
        // On top of everything.
        expect(layers.at(-1)!.id).toBe('mark-ring');
        // Shinyalu in Kakamega is large enough: no ring.
        const big = spec(focusOf('county', kakamega.c), {
            level: 'constituency',
            code: shinyalu.c,
        });
        expect(markRing(big, ctx, box)).toBeNull();
        await renderViewMap(big, ctx, THEMES.dark, box);
        expect(
            (calls[1].style as { layers: { id: string }[] }).layers.some(
                (l) => l.id === 'mark-ring',
            ),
        ).toBe(false);
    });

    it('leaves a map without a mark as it was', () => {
        const plain: ViewMapSpec = {
            seat: 'mca',
            only: [],
            focus: focusOf('county', 47),
            showSurroundings: false,
        };
        expect(markRing(plain, ctx, { x: 0, y: 0, w: 300, h: 300 })).toBeNull();
        expect(viewStyle(plain, ctx, THEMES.dark)).toEqual(
            viewStyle(plain, ctx, THEMES.dark, { x: 0, y: 0, w: 300, h: 300 }),
        );
    });
});
