// Stripe patterns for the "County seats" view: each county is filled with three equal sets of
// diagonal stripes, one per county-wide seat, always in the order Governor, Senator, Woman Rep
// (the caller passes the colours in that order). The image is made at runtime, one per colour
// triple, and its id spells the colours, so the visible map and the export map can each make the
// image from the id alone when the style asks for it (MapLibre's `styleimagemissing`).

/** Pixels across one tile of the pattern (drawn at pixel ratio 2: half this many CSS pixels). */
export const STRIPE_SIZE = 36;
/** The pixel ratio the pattern is added to the map with. */
export const STRIPE_PIXEL_RATIO = 2;

const PREFIX = 'stripes-';

/** What MapLibre's addImage takes: raw RGBA pixels. */
export interface StripeImage {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

const hex = (colour: string) => colour.replace('#', '').toLowerCase();

/** A stable id for a colour triple. The order is part of it: it is the order of the seats. */
export const patternId = (colours: readonly string[]): string =>
    `${PREFIX}${colours.map(hex).join('-')}`;

/** The colours a pattern id was made from, in order; null for any other image id. */
export function coloursOf(id: string): string[] | null {
    if (!id.startsWith(PREFIX)) return null;
    const parts = id.slice(PREFIX.length).split('-');
    return parts.length > 0 && parts.every((p) => /^[0-9a-f]{6}$/.test(p))
        ? parts.map((p) => `#${p}`)
        : null;
}

const rgb = (colour: string): [number, number, number] => {
    const h = hex(colour);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
        number,
        number,
        number,
    ];
};

/**
 * The pattern tile: diagonal stripes, one equal band per colour, in the order given. A pixel's
 * band depends only on x + y, so the tile repeats without a seam. Pixels on an edge between two
 * bands are blended (2×2 samples), so the diagonals are not jagged. Three equal colours give a
 * solid tile.
 */
export function stripePattern(
    colours: readonly string[],
    size = STRIPE_SIZE,
): StripeImage {
    const bands = colours.map(rgb);
    const n = bands.length;
    const data = new Uint8ClampedArray(size * size * 4);
    const SUB = [0.25, 0.75];
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const sum = [0, 0, 0];
            for (const dx of SUB)
                for (const dy of SUB) {
                    // Top row, left to right, reads first, second, third.
                    const t = (((x + dx + size - (y + dy)) % size) + size) % size;
                    const band = bands[Math.min(n - 1, Math.floor((t / size) * n))];
                    sum[0] += band[0];
                    sum[1] += band[1];
                    sum[2] += band[2];
                }
            const i = (y * size + x) * 4;
            data[i] = Math.round(sum[0] / 4);
            data[i + 1] = Math.round(sum[1] / 4);
            data[i + 2] = Math.round(sum[2] / 4);
            data[i + 3] = 255;
        }
    return { width: size, height: size, data };
}

/** The part of a MapLibre map that images are added through. */
export interface ImageHost {
    hasImage(id: string): boolean;
    addImage(
        id: string,
        image: StripeImage,
        options?: { pixelRatio?: number },
    ): unknown;
}

/**
 * Make and add the stripe image an id names, if it is one of ours and not on the map yet. Both
 * the visible map and the export map call this from `styleimagemissing`, so neither keeps a list
 * of patterns: a new theme or highlight is simply a new id.
 */
export function addStripeImage(map: ImageHost, id: string): boolean {
    const colours = coloursOf(id);
    if (!colours || map.hasImage(id)) return false;
    map.addImage(id, stripePattern(colours), {
        pixelRatio: STRIPE_PIXEL_RATIO,
    });
    return true;
}

/** Every stripe pattern a style names, wherever it sits in a paint expression. */
export function stripeIdsIn(style: {
    layers: { paint?: Record<string, unknown> }[];
}): string[] {
    const ids = new Set<string>();
    const walk = (value: unknown) => {
        if (typeof value === 'string') {
            if (coloursOf(value)) ids.add(value);
        } else if (Array.isArray(value)) value.forEach(walk);
    };
    for (const layer of style.layers) walk(layer.paint?.['fill-pattern']);
    return [...ids];
}
