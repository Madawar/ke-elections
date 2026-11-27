// Checks shared by the carousel's tests and its sweep: every fault of a laid-out cover (cut or
// broken text, a box off the card, overlaps, the map past the footer or too small for its room,
// story text in the covered zones), and every fault of a slide's footer with its page text.
import type { CoverCardView } from '@/lib/export/coverCard';
import { coverKicker, coverScope } from '@/lib/export/coverCard';
import type { CoverLayout } from '@/lib/export/coverLayout';
import { type Box, type FooterFonts, type TextItem, footerBlock } from '@/lib/export/layout';
import { HEADLINE_STRETCH, headlineText } from '@/lib/export/viewLayout';
import { ATTRIBUTION } from '@/lib/map/theme';
import { apart, inside, textBox, within } from './ballotsChecks';

/** The zones TikTok and Reels cover on a story: the bottom 400px and the right 120px. */
const STORY_RIGHT = 960;
const STORY_BOTTOM = 1520;

export function coverFaults(
    l: CoverLayout,
    size: 'portrait' | 'story',
    card: CoverCardView,
    headline: string,
    url: string,
): string[] {
    const faults: string[] = [];
    const texts: [TextItem, number][] = [
        [l.kicker, 1],
        ...l.headlineLines.map((t): [TextItem, number] => [t, HEADLINE_STRETCH]),
        ...l.scopeLines.map((t): [TextItem, number] => [t, 1]),
        [l.note, 1],
    ];
    for (const [t, s] of texts) {
        if (t.text.includes('…')) faults.push(`cut: "${t.text}"`);
        const b = textBox(t, s);
        if (!inside(b, l.w, l.h)) faults.push(`off the card: "${t.text}"`);
        if (b.x + b.w > l.footerBox.x + l.footerBox.w + 0.5) faults.push(`past the margin: "${t.text}"`);
    }
    if (headlineText(l.headlineLines) !== headline) faults.push(`headline not whole: ${l.headlineLines.map((t) => t.text).join(' / ')}`);
    if (l.scopeLines.map((t) => t.text).join(' ') !== coverScope(card)) faults.push('scope not whole');
    if (l.kicker.text !== coverKicker(card)) faults.push(`kicker not whole: ${l.kicker.text}`);
    const boxes: [string, Box][] = [
        ['kicker', textBox(l.kicker)],
        ['headline', l.headline],
        ...l.scopeLines.map((t, i): [string, Box] => [`scope ${i}`, textBox(t)]),
        ['map', l.map],
        ['note', textBox(l.note)],
        ['footer', l.footerBox],
    ];
    for (const [n, b] of boxes) if (!inside(b, l.w, l.h)) faults.push(`${n} off the card`);
    for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
            if (!apart(boxes[i][1], boxes[j][1])) faults.push(`overlap: ${boxes[i][0]} and ${boxes[j][0]}`);
    if (!within(l.map, { x: l.footerBox.x, y: 0, w: l.footerBox.w, h: l.footerBox.y })) faults.push('map outside the content column');
    // In reading order, the note right under the map.
    const scopeBottom = Math.max(...l.scopeLines.map((t) => t.y));
    if (l.map.y <= scopeBottom) faults.push('map above the scope line');
    if (l.note.y < l.map.y + l.map.h) faults.push('note above the map’s foot');
    if (l.note.y - (l.map.y + l.map.h) > l.note.size * 2) faults.push('note far from the map');
    // The map as large as its room allows: as wide as the column, or as tall as the room.
    const room = l.footerBox.y - scopeBottom;
    if (l.map.w < l.footerBox.w - 1 && l.map.h < room - l.note.size * 6)
        faults.push(`map smaller than its room (${l.map.w}x${l.map.h}, room ${l.footerBox.w}x${Math.round(room)})`);
    if (size === 'story') {
        const foot = footerBlock(l.footerBox, l.footerFonts, { source: card.source, asOf: '16 July 2026', attribution: ATTRIBUTION, url, page: '1 of 4' });
        for (const [t, s] of [...texts, ...[...foot.lines, foot.page!].map((t): [TextItem, number] => [t, 1])]) {
            const b = textBox(t, s);
            if (b.x + b.w > STORY_RIGHT + 0.5) faults.push(`"${t.text}" in the right-hand zone`);
            if (b.y + b.h > STORY_BOTTOM + 0.5) faults.push(`"${t.text}" in the bottom zone`);
        }
        if (l.map.x + l.map.w > STORY_RIGHT + 0.5 || l.map.y + l.map.h > STORY_BOTTOM + 0.5) faults.push('map in a covered zone');
        if (textBox(l.kicker).y < 119.5) faults.push('kicker in the top zone');
    }
    return faults;
}

/**
 * A slide's footer with its page text: the page text on the link's line, apart from the brand
 * and the link, inside the footer box, the footer no taller than without it, and on a story out
 * of the covered zones.
 */
export function pageFaults(
    footerBox: Box,
    fonts: FooterFonts,
    input: { source: string; asOf: string | null; url: string; attribution?: string },
    page: string,
    size: string,
): string[] {
    const faults: string[] = [];
    const attribution = input.attribution ?? ATTRIBUTION;
    const plain = footerBlock(footerBox, fonts, { ...input, attribution });
    const b = footerBlock(footerBox, fonts, { ...input, attribution, page });
    const p = b.page;
    if (!p) return ['no page text'];
    if (p.text !== page) faults.push(`page text "${p.text}"`);
    if (b.bottom !== plain.bottom) faults.push('footer taller with the page text');
    if (b.bottom > footerBox.y + footerBox.h + 0.5) faults.push('footer past its box');
    const line = b.lines.filter((l) => l.y === p.y);
    if (!line.some((l) => l.text.includes('/'))) faults.push('page text not on the link’s line');
    const pb = textBox(p);
    for (const l of line) if (!apart(pb, textBox(l))) faults.push(`page text on "${l.text}"`);
    for (const t of [p, ...line]) {
        const tb = textBox(t);
        if (tb.x < footerBox.x - 0.5 || tb.x + tb.w > footerBox.x + footerBox.w + 0.5) faults.push(`"${t.text}" outside the footer`);
        if (size === 'story' && (tb.x + tb.w > STORY_RIGHT + 0.5 || tb.y + tb.h > STORY_BOTTOM + 0.5)) faults.push(`"${t.text}" in a covered zone`);
    }
    return faults;
}
