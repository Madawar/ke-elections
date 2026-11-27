import { describe, expect, it } from 'vitest';
import {
    STRIPE_PIXEL_RATIO,
    STRIPE_SIZE,
    addStripeImage,
    coloursOf,
    patternId,
    stripeIdsIn,
    stripePattern,
} from '@/lib/map/stripes';

const BLUE = '#2f5fa7';
const ORANGE = '#e07b24';
const YELLOW = '#e8c547';
const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** The colour of the pixel at (x, y). */
const at = (img: ReturnType<typeof stripePattern>, x: number, y: number) =>
    [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

describe('patternId', () => {
    it('is stable for the same colours, whatever their letter case', () => {
        expect(patternId([BLUE, ORANGE, YELLOW])).toBe(
            patternId([BLUE.toUpperCase(), ORANGE, YELLOW]),
        );
        expect(patternId([BLUE, ORANGE, YELLOW])).toBe(
            'stripes-2f5fa7-e07b24-e8c547',
        );
    });

    it('differs when the order differs: the order is by seat, never by colour', () => {
        const ids = new Set([
            patternId([BLUE, ORANGE, YELLOW]),
            patternId([ORANGE, BLUE, YELLOW]),
            patternId([YELLOW, ORANGE, BLUE]),
            patternId([BLUE, YELLOW, ORANGE]),
        ]);
        expect(ids.size).toBe(4);
    });

    it('gives back the colours it was made from, in order', () => {
        expect(coloursOf(patternId([BLUE, ORANGE, YELLOW]))).toEqual([
            BLUE,
            ORANGE,
            YELLOW,
        ]);
        expect(coloursOf('towns-dot')).toBeNull();
        expect(coloursOf('stripes-zzzzzz')).toBeNull();
    });
});

describe('stripePattern', () => {
    it('is a square image that tiles: its edges continue each other', () => {
        const img = stripePattern([BLUE, ORANGE, YELLOW]);
        expect(img.width).toBe(STRIPE_SIZE);
        expect(img.height).toBe(STRIPE_SIZE);
        expect(img.data).toHaveLength(STRIPE_SIZE * STRIPE_SIZE * 4);
        // A stripe keeps its colour one step right and one step down, and so across the edge
        // into the next tile (whose first row and column are this tile's own).
        const last = STRIPE_SIZE - 1;
        for (let i = 0; i < STRIPE_SIZE; i++) {
            expect(at(img, i, last)).toEqual(at(img, (i + 1) % STRIPE_SIZE, 0));
            expect(at(img, last, i)).toEqual(at(img, 0, (i + 1) % STRIPE_SIZE));
        }
    });

    it('draws three equal sets of stripes, one per colour, in the order given', () => {
        const img = stripePattern([BLUE, ORANGE, YELLOW]);
        const counts = new Map<string, number>();
        for (let y = 0; y < img.height; y++)
            for (let x = 0; x < img.width; x++) {
                const key = at(img, x, y).slice(0, 3).join(',');
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        const total = img.width * img.height;
        for (const c of [BLUE, ORANGE, YELLOW]) {
            const share = (counts.get(rgb(c).join(',')) ?? 0) / total;
            // A third each, less the few blended pixels along the edges.
            expect(share, c).toBeGreaterThan(0.27);
            expect(share, c).toBeLessThan(0.34);
        }
        // Along the top row, left to right: first, second, third.
        const third = STRIPE_SIZE / 3;
        expect(at(img, Math.floor(third * 0.5), 0).slice(0, 3)).toEqual(rgb(BLUE));
        expect(at(img, Math.floor(third * 1.5), 0).slice(0, 3)).toEqual(
            rgb(ORANGE),
        );
        expect(at(img, Math.floor(third * 2.5), 0).slice(0, 3)).toEqual(
            rgb(YELLOW),
        );
    });

    it('is solid when all three seats are one colour, and two-thirds when two are', () => {
        const solid = stripePattern([ORANGE, ORANGE, ORANGE]);
        for (let i = 0; i < solid.data.length; i += 4)
            expect([...solid.data.slice(i, i + 4)]).toEqual([...rgb(ORANGE), 255]);
        const two = stripePattern([ORANGE, BLUE, ORANGE]);
        let orange = 0;
        for (let i = 0; i < two.data.length; i += 4)
            if ([...two.data.slice(i, i + 3)].join() === rgb(ORANGE).join())
                orange++;
        const share = orange / (two.width * two.height);
        expect(share).toBeGreaterThan(0.6);
        expect(share).toBeLessThan(0.68);
    });

    it('is fully opaque, so the fill opacity alone decides how strong it reads', () => {
        const img = stripePattern([BLUE, ORANGE, YELLOW]);
        for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255);
    });

    it('takes another size when asked', () => {
        expect(stripePattern([BLUE, ORANGE, YELLOW], 24).width).toBe(24);
    });
});

describe('addStripeImage (the map asks for an image it does not have)', () => {
    const host = () => {
        const images = new Map<string, { width: number; ratio?: number }>();
        return {
            images,
            hasImage: (id: string) => images.has(id),
            addImage: (
                id: string,
                image: { width: number },
                options?: { pixelRatio?: number },
            ) => images.set(id, { width: image.width, ratio: options?.pixelRatio }),
        };
    };

    it('makes the pattern from its id alone and adds it at the pattern’s pixel ratio', () => {
        const map = host();
        const id = patternId([BLUE, ORANGE, YELLOW]);
        expect(addStripeImage(map, id)).toBe(true);
        expect(map.images.get(id)).toEqual({
            width: STRIPE_SIZE,
            ratio: STRIPE_PIXEL_RATIO,
        });
    });

    it('adds an image once, and leaves other missing images alone', () => {
        const map = host();
        const id = patternId([BLUE, ORANGE, YELLOW]);
        addStripeImage(map, id);
        expect(addStripeImage(map, id)).toBe(false);
        expect(addStripeImage(map, 'some-icon')).toBe(false);
        expect(map.images.size).toBe(1);
    });
});

describe('stripeIdsIn (the patterns a style will ask for)', () => {
    it('finds every pattern in the fill-pattern expressions, once each', () => {
        const a = patternId([BLUE, ORANGE, YELLOW]);
        const b = patternId([ORANGE, ORANGE, ORANGE]);
        const style = {
            layers: [
                { paint: { 'fill-color': '#ffffff' } },
                {
                    paint: {
                        'fill-pattern': [
                            'case',
                            ['!=', ['get', 'code'], 1],
                            b,
                            ['match', ['get', 'code'], 1, a, 2, b, 3, a, b],
                        ],
                    },
                },
                {},
            ],
        };
        expect(stripeIdsIn(style).sort()).toEqual([a, b].sort());
        expect(stripeIdsIn({ layers: [] })).toEqual([]);
    });
});
