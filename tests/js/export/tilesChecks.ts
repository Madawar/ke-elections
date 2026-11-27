// Checks and fixtures shared by the county tiles card's layout tests and its sweep: every fault of
// one laid-out card as a list of strings (cut text, a box off the card, overlaps, a name outside
// its tile, the key on a tile, story text in the covered zones), and seats data built to stress
// the key. Holder names are placeholders; party abbreviations beyond the registry's are invented
// placeholders ("P01"), never real parties.
import { type Box, type TextItem, footerBlock } from '@/lib/export/layout';
import type { TilesCardView } from '@/lib/export/tilesCard';
import type { TilesLayout } from '@/lib/export/tilesLayout';
import { HEADLINE_STRETCH } from '@/lib/export/viewLayout';
import { CODES_CREDIT } from '@/lib/map/theme';
import type { Holder, SeatsData } from '@/lib/seats';
import { apart, inside, textBox, within } from './ballotsChecks';
import { NUMBERS_SEATS } from './numbersFixtures';

export function tilesFaults(
    l: TilesLayout,
    size: 'portrait' | 'story',
    card: Pick<TilesCardView, 'source'>,
): string[] {
    const faults: string[] = [];
    const keyTexts = l.key.entries.flatMap((e) => [e.label, e.count]);
    const texts: [TextItem, number][] = [
        ...l.headlineLines.map((t): [TextItem, number] => [t, HEADLINE_STRETCH]),
        [l.scopeLine, 1],
        ...l.tiles.flatMap((t) => t.name.map((n): [TextItem, number] => [n, 1])),
        ...keyTexts.map((t): [TextItem, number] => [t, 1]),
    ];
    for (const [t, stretch] of texts) {
        if (t.text.includes('…')) faults.push(`cut: "${t.text}"`);
        if (!inside(textBox(t, stretch), l.w, l.h)) faults.push(`off the card: "${t.text}"`);
    }
    // The blocks: headline, scope line, grid, key (when under the grid), footer.
    const blocks: [string, Box][] = [
        ['headline', l.headline],
        ['scope', textBox(l.scopeLine)],
        ['grid', l.grid],
        ['footer', l.footerBox],
        ...(l.key.inCorner ? [] : [['key', l.key.box] as [string, Box]]),
    ];
    for (const [n, b] of blocks) if (!inside(b, l.w, l.h)) faults.push(`${n} off the card`);
    for (let i = 0; i < blocks.length; i++)
        for (let j = i + 1; j < blocks.length; j++)
            if (!apart(blocks[i][1], blocks[j][1]))
                faults.push(`overlap: ${blocks[i][0]} and ${blocks[j][0]}`);
    // Tiles: inside the grid, apart, each name inside its tile.
    for (const t of l.tiles) {
        if (!within(t.box, l.grid)) faults.push(`tile ${t.code} off the grid`);
        for (const n of t.name)
            if (!within(textBox(n), t.box)) faults.push(`"${n.text}" off its tile`);
        if (!apart(t.box, l.key.box)) faults.push(`key on tile ${t.code}`);
    }
    for (let i = 0; i < l.tiles.length; i++)
        for (let j = i + 1; j < l.tiles.length; j++)
            if (!apart(l.tiles[i].box, l.tiles[j].box))
                faults.push(`tiles ${l.tiles[i].code} and ${l.tiles[j].code} overlap`);
    // The key: every chip and text inside its box, none on another.
    const keyBoxes: [string, Box][] = [
        ...l.key.entries.map((e): [string, Box] => [`chip ${e.key}`, e.chip]),
        ...keyTexts.map((t): [string, Box] => [t.text, textBox(t)]),
    ];
    for (const [n, b] of keyBoxes) if (!within(b, l.key.box)) faults.push(`"${n}" off the key`);
    for (let i = 0; i < keyBoxes.length; i++)
        for (let j = i + 1; j < keyBoxes.length; j++)
            if (!apart(keyBoxes[i][1], keyBoxes[j][1]))
                faults.push(`key: "${keyBoxes[i][0]}" and "${keyBoxes[j][0]}" overlap`);
    if (size === 'story') {
        const foot = footerBlock(l.footerBox, l.footerFonts, {
            source: card.source,
            asOf: '16 July 2026',
            attribution: CODES_CREDIT,
            url: 'https://example.org/?seat=governor',
        });
        for (const [t, stretch] of [...texts, ...foot.lines.map((t): [TextItem, number] => [t, 1])]) {
            const b = textBox(t, stretch);
            if (b.x + b.w > 960) faults.push(`"${t.text}" in the right-hand zone`);
            if (t.y > 1520) faults.push(`"${t.text}" in the bottom zone`);
        }
        for (const [n, b] of [['grid', l.grid], ['key', l.key.box]] as const)
            if (b.x + b.w > 960 || b.y + b.h > 1520) faults.push(`${n} in a covered zone`);
        if (l.headline.y < 120) faults.push('headline in the top zone');
    }
    return faults;
}

/** The fixture seats with the first `n` holders of a seat taken out: those counties have none. */
export const without = (seat: string, n: number): SeatsData => {
    let left = n;
    return {
        ...NUMBERS_SEATS,
        holders: NUMBERS_SEATS.holders.filter((h) => h.seat !== seat || left-- <= 0),
    };
};

/**
 * Governors from `n` more placeholder parties with colours of their own (P01, P02, …), two
 * counties each, the rest as the fixtures have them: a key of `n` more entries.
 */
export function manyParties(n: number): SeatsData {
    const extra = Array.from({ length: n }, (_, i) => ({
        abbrev: `P${String(i + 1).padStart(2, '0')}`,
        name: `Placeholder party ${i + 1}`,
        coalition_2022: null,
        colour: `#${(0x203040 + i * 0x0a0b0c).toString(16).padStart(6, '0')}`,
    }));
    const governors = NUMBERS_SEATS.holders.filter((h) => h.seat === 'governor');
    const holders: Holder[] = governors.map((h, i) =>
        i < 2 * n ? { ...h, party: extra[Math.floor(i / 2)].abbrev } : h,
    );
    return {
        ...NUMBERS_SEATS,
        parties: [...NUMBERS_SEATS.parties, ...extra],
        holders: [...NUMBERS_SEATS.holders.filter((h) => h.seat !== 'governor'), ...holders],
    };
}
