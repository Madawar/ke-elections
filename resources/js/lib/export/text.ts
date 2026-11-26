// SVG text has no automatic wrapping, so the cards measure and wrap their own lines. Widths are
// estimated per character class for Archivo at the UI width (wdth 92), rounded up so that real
// text comes out a little narrower than measured, never wider.

const NARROW = new Set("iljtfrI.,:;'’!|()[]".split(''));
const WIDE = new Set('mwMW@%'.split(''));

function charEm(ch: string): number {
    if (ch === ' ') return 0.26;
    if (NARROW.has(ch)) return 0.32;
    if (WIDE.has(ch)) return 0.86;
    if (ch >= '0' && ch <= '9') return 0.58;
    if (ch === '·' || ch === '-' || ch === '–') return 0.4;
    if (ch !== ch.toLowerCase()) return 0.68; // capitals
    return 0.56;
}

/** Estimated width in px of `text` at `size` px. Bold text is about 5% wider. */
export function textWidth(text: string, size: number, bold = false): number {
    let em = 0;
    for (const ch of text) em += charEm(ch);
    return em * size * (bold ? 1.05 : 1);
}

function truncate(text: string, maxWidth: number, size: number, bold: boolean) {
    if (textWidth(text, size, bold) <= maxWidth) return text;
    let out = text;
    while (out.length > 1 && textWidth(`${out}…`, size, bold) > maxWidth)
        out = out.slice(0, -1);
    return `${out.trimEnd()}…`;
}

/**
 * Break `text` into lines no wider than `maxWidth`, on spaces. When it needs more than
 * `maxLines`, the last line ends with an ellipsis. A single word wider than a line is cut.
 */
export function wrapText(
    text: string,
    maxWidth: number,
    size: number,
    maxLines = Infinity,
    bold = false,
): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (!line || textWidth(next, size, bold) <= maxWidth) {
            line = next;
            continue;
        }
        lines.push(line);
        line = word;
    }
    if (line) lines.push(line);
    const fitted = lines.map((l) => truncate(l, maxWidth, size, bold));
    if (fitted.length <= maxLines) return fitted;
    // The rest spans two or more lines, so it is too wide and truncate() adds the ellipsis.
    const kept = fitted.slice(0, maxLines - 1);
    kept.push(
        truncate(lines.slice(maxLines - 1).join(' '), maxWidth, size, bold),
    );
    return kept;
}

/** The largest size (from `base` down to `min`) at which `text` fits on one line. */
export function fitFontSize(
    text: string,
    maxWidth: number,
    base: number,
    min: number,
    bold = false,
): number {
    const at = textWidth(text, base, bold);
    if (at <= maxWidth) return base;
    return Math.max(min, Math.floor((base * maxWidth) / at));
}
