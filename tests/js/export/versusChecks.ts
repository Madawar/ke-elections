// Checks shared by the "Side by side" layout tests and its sweep: every fault of one laid-out card
// as a list of strings (cut text, a box off the card or past the footer, overlaps inside a half,
// a count that does not fit its part of the bar, story text in the covered zones), and whether
// the two halves line up row by row.
import { type Box, type TextItem, footerBlock } from '@/lib/export/layout';
import type { VersusHalfItem, VersusLayout } from '@/lib/export/versusLayout';
import { HEADLINE_STRETCH } from '@/lib/export/viewLayout';
import { ATTRIBUTION } from '@/lib/map/theme';
import { apart, inside, textBox, within } from './ballotsChecks';

const halfTexts = (hf: VersusHalfItem): TextItem[] => [
    ...hf.name,
    hf.units,
    ...hf.key.map((k) => k.label),
    ...hf.leaders.flatMap((l) => [l.label, l.party]),
];

export function versusFaults(
    l: VersusLayout,
    size: 'x' | 'story',
    card: { source: string },
    url = 'https://example.org/?seat=mca',
): string[] {
    const faults: string[] = [];
    const texts: [TextItem, number][] = [
        ...l.headlineLines.map((t): [TextItem, number] => [t, HEADLINE_STRETCH]),
        [l.scopeLine, 1],
        ...l.halves.flatMap((hf) => halfTexts(hf).map((t): [TextItem, number] => [t, 1])),
    ];
    for (const [t, s] of texts) {
        if (t.text.includes('…')) faults.push(`cut: "${t.text}"`);
        if (!inside(textBox(t, s), l.w, l.h)) faults.push(`off the card: "${t.text}"`);
    }
    const right = l.footerBox.x + l.footerBox.w;
    for (const t of l.headlineLines) {
        const b = textBox(t, HEADLINE_STRETCH);
        if (b.x + b.w > right + 0.5) faults.push(`headline past the margin: "${t.text}"`);
    }
    const blocks: [string, Box][] = [
        ['headline', l.headline],
        ['scope', textBox(l.scopeLine)],
        ['half a', l.halves[0].box],
        ['half b', l.halves[1].box],
        ['footer', l.footerBox],
    ];
    for (const [n, b] of blocks) if (!inside(b, l.w, l.h)) faults.push(`${n} off the card`);
    for (let i = 0; i < blocks.length; i++)
        for (let j = i + 1; j < blocks.length; j++)
            if (!apart(blocks[i][1], blocks[j][1])) faults.push(`overlap: ${blocks[i][0]} and ${blocks[j][0]}`);
    for (const hf of l.halves) {
        const tag = `${hf.code}`;
        const parts: [string, Box][] = [
            ...halfTexts(hf).map((t): [string, Box] => [t.text, textBox(t)]),
            ['bar', hf.bar.box],
            ['map', hf.map],
            ...hf.key.map((k): [string, Box] => [`chip ${k.key}`, k.chip]),
            ...hf.leaders.flatMap((x): [string, Box][] => [
                [`tick ${x.seat}`, x.tick],
                ...(x.chip ? [[`chip ${x.seat}`, x.chip] as [string, Box]] : []),
            ]),
        ];
        for (const [n, b] of parts) {
            if (!within(b, hf.box)) faults.push(`${tag}: "${n}" outside its half`);
            if (b.y + b.h > l.footerBox.y + 0.5) faults.push(`${tag}: "${n}" past the footer`);
        }
        for (let i = 0; i < parts.length; i++)
            for (let j = i + 1; j < parts.length; j++)
                if (!apart(parts[i][1], parts[j][1]))
                    faults.push(`${tag}: "${parts[i][0]}" and "${parts[j][0]}" overlap`);
        for (const k of hf.key) if (!within(textBox(k.label), hf.keyBox)) faults.push(`${tag}: "${k.label.text}" off its key row`);
        for (const x of hf.leaders)
            if (!within(textBox(x.party), hf.leadersBox)) faults.push(`${tag}: "${x.party.text}" off the leaders row`);
        for (const p of hf.bar.parts)
            if (p.label && !within(textBox(p.label), p)) faults.push(`${tag}: count ${p.label.text} does not fit its part`);
        if (hf.map.w < 50 || hf.map.h < 50) faults.push(`${tag}: map too small (${hf.map.w}x${hf.map.h})`);
    }
    if (size === 'story') {
        const foot = footerBlock(l.footerBox, l.footerFonts, {
            source: card.source,
            asOf: '16 July 2026',
            attribution: ATTRIBUTION,
            url,
        });
        for (const [t, s] of [...texts, ...foot.lines.map((t): [TextItem, number] => [t, 1])]) {
            const b = textBox(t, s);
            if (b.x + b.w > 960.5) faults.push(`"${t.text}" in the right-hand zone`);
            if (b.y + b.h > 1520.5) faults.push(`"${t.text}" in the bottom zone`);
        }
        for (const hf of l.halves)
            if (hf.map.x + hf.map.w > 960.5 || hf.map.y + hf.map.h > 1520.5) faults.push(`${hf.code}: map in a covered zone`);
        if (l.headline.y < 120) faults.push('headline in the top zone');
    }
    return faults;
}

/** The rows of a half, each as an offset from its half's top, and the map's size. */
const rowsOf = (hf: VersusHalfItem) => ({
    name: hf.name[0].y - hf.box.y,
    nameLines: hf.name.length,
    units: hf.units.y - hf.box.y,
    bar: [hf.bar.box.y - hf.box.y, hf.bar.box.h],
    key: [hf.keyBox.y - hf.box.y, hf.keyBox.h],
    map: [hf.map.y - hf.box.y, hf.map.w, hf.map.h],
    leaders: [hf.leadersBox.y - hf.box.y, hf.leadersBox.h],
    size: [hf.name[0].size, hf.units.size, hf.key[0]?.label.size, hf.leaders[0].label.size],
});

/** What differs between the two halves' rows; empty when they line up. */
export function misaligned(l: VersusLayout): string[] {
    const [a, b] = l.halves.map(rowsOf);
    return Object.keys(a).filter(
        (k) => JSON.stringify(a[k as keyof typeof a]) !== JSON.stringify(b[k as keyof typeof b]),
    );
}
