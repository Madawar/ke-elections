// Checks shared by the ward card's layout tests: boxes on the card, apart and whole, and every
// fault of one laid-out card as a list of strings, so a sweep over every ward can report them all.
import type { BallotsLayout } from '@/lib/export/ballotsLayout';
import { type Box, type TextItem, footerBlock } from '@/lib/export/layout';
import { textWidth } from '@/lib/export/text';
import { HEADLINE_STRETCH, headlineText } from '@/lib/export/viewLayout';
import { ATTRIBUTION } from '@/lib/map/theme';

export const inside = (b: Box, w: number, h: number) =>
    b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= w + 0.5 && b.y + b.h <= h + 0.5;
export const within = (b: Box, outer: Box) =>
    b.x >= outer.x - 0.5 &&
    b.y >= outer.y - 0.5 &&
    b.x + b.w <= outer.x + outer.w + 0.5 &&
    b.y + b.h <= outer.y + outer.h + 0.5;
export const apart = (a: Box, b: Box) =>
    a.x + a.w <= b.x + 0.5 ||
    b.x + b.w <= a.x + 0.5 ||
    a.y + a.h <= b.y + 0.5 ||
    b.y + b.h <= a.y + 0.5;
export const textBox = (t: TextItem, stretch = 1): Box => {
    const w = textWidth(t.text, t.size, (t.weight ?? 400) >= 600) * stretch;
    return { x: t.anchor === 'end' ? t.x - w : t.x, y: t.y - t.size * 0.8, w, h: t.size };
};
export const seatTexts = (l: BallotsLayout) =>
    l.papers.flatMap((p) =>
        p.seats.flatMap((s) => [...s.title, ...s.name, ...s.party, ...(s.since ? [s.since] : [])]),
    );

/** The bottom of the last paper: never below the footer's top. */
export const papersBottom = (l: BallotsLayout) => {
    const last = l.papers.at(-1)!;
    return last.box.y + last.box.h;
};

/**
 * Every fault of one card: cut text, a box off the card, two boxes overlapping, a seat's words
 * outside its paper or into its map, a paper past the footer, story text in the zones TikTok and
 * Reels cover. Empty when the card is sound.
 */
export function ballotsFaults(
    l: BallotsLayout,
    size: 'portrait' | 'story',
    footer: { source: string; url: string },
    headline?: string,
): string[] {
    const faults: string[] = [];
    const boxes: (readonly [string, Box])[] = [
        ...seatTexts(l).map((t) => [t.text, textBox(t)] as const),
        ...l.papers.map((p) => [`map ${p.key}`, p.map] as const),
        ...l.papers.flatMap((p) =>
            p.seats.flatMap((s) => (s.chip ? [[`chip ${s.seat}`, s.chip] as const] : [])),
        ),
        [l.scopeLine.text, textBox(l.scopeLine)],
        ['footer', l.footerBox],
        ...l.headlineLines.map((t) => [t.text, textBox(t, HEADLINE_STRETCH)] as const),
    ];
    for (const [t, b] of boxes) {
        if (t.includes('…')) faults.push(`cut: "${t}"`);
        if (!inside(b, l.w, l.h)) faults.push(`off the card: "${t}"`);
    }
    for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
            if (!apart(boxes[i][1], boxes[j][1]))
                faults.push(`overlap: "${boxes[i][0]}" and "${boxes[j][0]}"`);
    // The words as one string, spaces as the data has them or not (two ward names hold a double space).
    const words = (t: string) => t.trim().split(/\s+/).join(' ');
    if (headline !== undefined && words(headlineText(l.headlineLines)) !== words(headline))
        faults.push(`headline not whole: ${l.headlineLines.map((t) => t.text).join(' / ')}`);
    const bottom = papersBottom(l);
    if (bottom > l.footerBox.y) faults.push(`papers end at ${bottom}, past the footer at ${l.footerBox.y}`);
    for (const [i, p] of l.papers.entries()) {
        if (!apart(p.box, l.footerBox)) faults.push(`paper ${p.key} on the footer`);
        if (p.box.y <= l.scopeLine.y) faults.push(`paper ${p.key} on the scope line`);
        if (i && p.box.y <= l.papers[i - 1].box.y + l.papers[i - 1].box.h)
            faults.push(`paper ${p.key} on the one above`);
        if (!within(p.map, p.box)) faults.push(`map ${p.key} off its paper`);
        for (const s of p.seats) {
            if (!within(s.edge, p.box)) faults.push(`edge ${s.seat} off its paper`);
            for (const t of [...s.title, ...s.name, ...s.party, ...(s.since ? [s.since] : [])])
                if (!within(textBox(t), p.box)) faults.push(`"${t.text}" off its paper`);
            for (const t of [...s.title, ...s.name, ...s.party])
                if (textBox(t).x + textBox(t).w > p.map.x - 8) faults.push(`"${t.text}" into the map`);
        }
    }
    if (size === 'story') {
        const foot = footerBlock(l.footerBox, l.footerFonts, {
            source: footer.source,
            asOf: '16 July 2026',
            attribution: ATTRIBUTION,
            url: footer.url,
        });
        const all: [TextItem, number][] = [
            ...l.headlineLines.map((t): [TextItem, number] => [t, HEADLINE_STRETCH]),
            ...[l.scopeLine, ...seatTexts(l), ...foot.lines].map((t): [TextItem, number] => [t, 1]),
        ];
        for (const [t, stretch] of all) {
            const b = textBox(t, stretch);
            if (b.x + b.w > 960) faults.push(`"${t.text}" in the right-hand zone`);
            if (t.y > 1520) faults.push(`"${t.text}" in the bottom zone`);
        }
        for (const p of l.papers)
            if (p.box.y + p.box.h > 1520 || p.box.x + p.box.w > 960)
                faults.push(`paper ${p.key} in a covered zone`);
        if (l.headline.y < 120) faults.push('headline in the top zone');
    }
    return faults;
}
