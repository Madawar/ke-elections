// Social card sizes (spec: "Infographic exports") and the file names they download as.

export const CARD_SIZES = {
    square: { w: 1080, h: 1080 },
    portrait: { w: 1080, h: 1350 },
    story: { w: 1080, h: 1920 },
    landscape: { w: 1200, h: 630 },
} as const;

export type CardSize = keyof typeof CARD_SIZES;

export const SIZE_LABELS: Record<CardSize, string> = {
    square: 'Square',
    portrait: 'Portrait',
    story: 'Story',
    landscape: 'Link card',
};

export const exportFilename = (
    level: string,
    code: number,
    size: CardSize,
): string => `kenya-electoral-map-${level}-${code}-${size}.png`;

export const inPowerFilename = (size: CardSize): string =>
    `kenya-electoral-map-in-power-now-${size}.png`;

/** "Share this view" sizes: Instagram posts, stories (TikTok, Reels) and X. */
export const VIEW_SIZES = {
    square: { w: 1080, h: 1080 },
    portrait: { w: 1080, h: 1350 },
    story: { w: 1080, h: 1920 },
    x: { w: 1600, h: 900 },
} as const;

export type ViewSize = keyof typeof VIEW_SIZES;

export const VIEW_SIZE_LABELS: Record<ViewSize, string> = {
    square: 'Square',
    portrait: 'Portrait',
    story: 'Story',
    x: 'X',
};

/** `kenya-electoral-map-mca-kenya-uda-odm-square.png`, `…-mp-county-47-story.mp4` */
export function viewFilename(
    view: {
        seat: string;
        focus: { level: string; code: number } | null;
        only: readonly string[];
    },
    size: ViewSize,
    ext: 'png' | 'mp4' | 'webm' = 'png',
): string {
    const where = view.focus
        ? `${view.focus.level}-${view.focus.code}`
        : 'kenya';
    const parties = view.only
        .slice(0, 4)
        .map((a) => a.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
        .join('-');
    return `kenya-electoral-map-${view.seat.replace('_', '-')}-${where}${parties ? `-${parties}` : ''}-${size}.${ext}`;
}
