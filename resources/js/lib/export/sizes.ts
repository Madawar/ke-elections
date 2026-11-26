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
