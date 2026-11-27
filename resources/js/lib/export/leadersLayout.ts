// Layout for the leaders card, one arrangement per size, inside the same frame as the "Share this
// view" card (its sizes and safe zones, the ballot-lid strip, the headline block and the footer).
// Every block and every line of text is placed here, so the card component only draws what this
// returns and tests can check that nothing overlaps or runs off the card.
//
// The map sits above the leaders, or beside them when that draws its shape larger. Each leader
// is a block: the seat's ballot colour as a side bar, the seat, the name exactly as the data
// spells it, the party with its chip, and since when with the row's own source. When the blocks
// do not fit they shrink a little together, then the rows held above the unit give up their
// "since" line (their sources stay in the footer). Names are never cut.
import { formatAsOf } from './format';
import type { Box, FooterFonts, TextItem } from './layout';
import {
    type LeadersCardView,
    leadersScopeLines,
    mcaMixLabel,
} from './leadersCard';
import type { ViewSize } from './sizes';
import { fitFontSize, textWidth, wrapText } from './text';
import {
    type StripSegment,
    box,
    cardFrame,
    fittedArea,
    strip,
    titleBlock,
} from './viewLayout';
import { type LeaderRow, type LeaderSeat, leaderColour } from '@/lib/leaders';
import { THEMES } from '@/lib/map/theme';

export type LeaderText = TextItem & {
    role: 'seat' | 'name' | 'party' | 'meta' | 'empty';
};

export interface LeaderBlockItem {
    seat: LeaderSeat;
    box: Box;
    /** The ballot-lid bar beside the block, in the seat's colour. */
    lid: Box & { colour: string };
    /** The party's colour; none for a seat with no holder. */
    chip: (Box & { colour: string }) | null;
    texts: LeaderText[];
}

export interface McaMixLayout {
    box: Box;
    /** "MCAs in 6 wards: ODM 3, UDA 3", on a second line when one is too narrow. */
    label: TextItem[];
    /** One part per party, largest first, then the wards with no approved MCA. */
    bar: (Box & { colour: string; key: string })[];
}

export interface LeadersLayout {
    w: number;
    h: number;
    strip: StripSegment[];
    headline: Box;
    headlineLines: TextItem[];
    scopeLine: TextItem;
    map: Box;
    blocksBox: Box;
    blocks: LeaderBlockItem[];
    /** A constituency's MCAs by party; null on a county's or a ward's card. */
    mix: McaMixLayout | null;
    footerBox: Box;
    footerFonts: FooterFonts;
}

export interface LeadersText {
    headline: string;
    /** The card's link, as the footer prints it. */
    url: string;
    /** Width over height of the area the map shows. */
    mapAspect: number;
}

interface Fonts {
    label: number;
    name: number;
    sub: number;
    gap: number;
}

const sourceHost = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return 'the record';
    }
};

/**
 * One leader, laid out from `y` across `w`. `meta` adds the "In office since ... Source: ..."
 * line. Text shrinks a little to stay on one line, then wraps; it is never cut.
 */
function block(
    x: number,
    y: number,
    w: number,
    row: LeaderRow,
    f: Fonts,
    meta: boolean,
): LeaderBlockItem {
    const lidW = Math.max(8, Math.round(f.label * 0.34));
    const tx = x + lidW + Math.round(f.label * 0.7);
    const tw = x + w - tx;
    const texts: LeaderText[] = [];
    let at = y;
    const put = (
        role: LeaderText['role'],
        text: string,
        base: number,
        tone: TextItem['tone'],
        weight: number,
        lead: number,
        indent = 0,
    ) => {
        const bold = weight >= 600;
        const size = fitFontSize(
            text,
            tw - indent,
            base,
            Math.round(base * 0.8),
            bold,
        );
        const first = at + Math.round(size * lead);
        // As many lines as the text needs: wrapText only cuts a single word wider than a line.
        for (const line of wrapText(text, tw - indent, size, Infinity, bold)) {
            at += Math.round(size * lead);
            texts.push({
                role,
                x: tx + indent,
                y: at,
                text: line,
                size,
                weight,
                tone,
            });
        }
        return { size, first };
    };
    // The full seat title where it fits ("Woman Representative (Nairobi City, county-wide)"),
    // else the short one.
    const where = row.where ? ` (${row.where})` : '';
    const long = `${row.title}${where}`;
    put(
        'seat',
        textWidth(long, f.label) <= tw ? long : `${row.label}${where}`,
        f.label,
        'muted',
        400,
        1.0,
    );
    let chip: LeaderBlockItem['chip'] = null;
    const h = row.holder;
    if (h) {
        at += Math.round(f.name * 0.12);
        put('name', h.name, f.name, 'ink', 700, 1.1);
        if (h.party) {
            at += Math.round(f.label * 0.2);
            const sw = Math.round(f.label * 0.72);
            const party =
                h.partyLabel === 'Independent' || h.partyName === h.party
                    ? h.partyName
                    : `${h.partyName} (${h.party})`;
            const { size, first } = put(
                'party',
                party,
                f.label,
                'ink',
                600,
                1.25,
                sw + Math.round(f.label * 0.4),
            );
            chip = {
                x: tx,
                y: first - sw + Math.round(size * 0.06),
                w: sw,
                h: sw,
                colour: h.colour,
            };
        }
        if (meta) {
            const since = formatAsOf(h.startedOn);
            put(
                'meta',
                `${since ? `In office since ${since}. ` : ''}Source: ${sourceHost(h.sourceUrl)}`,
                f.sub,
                'muted',
                400,
                1.45,
            );
        }
    } else {
        at += Math.round(f.name * 0.12);
        put('empty', 'No approved data yet', Math.round(f.name * 0.8), 'muted', 600, 1.15);
    }
    const bottom = at + Math.round(f.sub * 0.35);
    return {
        seat: row.seat,
        box: { x, y, w, h: bottom - y },
        lid: { x, y, w: lidW, h: bottom - y, colour: leaderColour(row.seat) },
        chip,
        texts,
    };
}

/**
 * Which blocks say since when and give their own source: all of them, or only the unit's own
 * seat (the first). That one always does; the others' sources are in the footer all the same.
 */
const DETAIL = ['all', 'first'] as const;
const SCALES = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64];

interface Blocks {
    items: LeaderBlockItem[];
    mix: McaMixLayout | null;
    height: number;
    /** How roomy the blocks are: higher is better (full detail at full size is the best). */
    rank: number;
}

/** The blocks (and a constituency's MCA mix under them) from `y` across `w`, at one scale. */
function blocksAt(
    x: number,
    y: number,
    w: number,
    card: LeadersCardView,
    base: Fonts,
    scale: number,
    detail: (typeof DETAIL)[number],
): Blocks {
    const f: Fonts = {
        label: Math.round(base.label * scale),
        name: Math.round(base.name * scale),
        sub: Math.round(base.sub * scale),
        gap: Math.round(base.gap * scale),
    };
    const items: LeaderBlockItem[] = [];
    let at = y;
    card.rows.forEach((row, i) => {
        const meta = detail === 'all' || (detail === 'first' && i === 0);
        const b = block(x, at, w, row, f, meta);
        items.push(b);
        at = b.box.y + b.box.h + f.gap;
    });
    let mix: McaMixLayout | null = null;
    if (card.mcas) {
        const theme = THEMES[card.theme];
        const text = mcaMixLabel(card);
        const size = fitFontSize(text, w, f.label, Math.round(f.label * 0.8));
        // Never cut: what does not fit one line, even a little smaller, goes on a second.
        const label = wrapText(text, w, size).map(
            (line, i): TextItem => ({
                x,
                y: at + Math.round(size * 0.95 + i * size * 1.25),
                text: line,
                size,
                tone: 'ink',
            }),
        );
        const labelY = label[label.length - 1].y;
        const barY = labelY + Math.round(size * 0.55);
        const barH = Math.max(12, Math.round(f.label * 0.8));
        const parts = [
            ...card.mcas.parties.map((p) => ({
                key: p.key,
                colour: p.colour,
                count: p.count,
            })),
            ...(card.mcas.held < card.mcas.wards
                ? [
                      {
                          key: 'none',
                          colour: theme.noData,
                          count: card.mcas.wards - card.mcas.held,
                      },
                  ]
                : []),
        ];
        const gapW = 3;
        const total = parts.reduce((n, p) => n + p.count, 0) || 1;
        const room = w - gapW * Math.max(0, parts.length - 1);
        let done = 0;
        const bar = parts.map((p, i) => {
            const left = Math.round(x + (room * done) / total + gapW * i);
            done += p.count;
            const right = Math.round(x + (room * done) / total + gapW * i);
            return {
                key: p.key,
                colour: p.colour,
                x: left,
                y: barY,
                w: Math.max(1, right - left),
                h: barH,
            };
        });
        mix = {
            box: { x, y: at, w, h: barY + barH - at },
            label,
            bar,
        };
        at = barY + barH;
    } else at -= f.gap;
    return {
        items,
        mix,
        height: at - y,
        rank: (DETAIL.length - DETAIL.indexOf(detail)) * 10 + scale,
    };
}

/** The roomiest blocks that fit `maxH`: full detail first, then a little smaller, then less. */
function fitBlocks(
    x: number,
    y: number,
    w: number,
    maxH: number,
    card: LeadersCardView,
    base: Fonts,
): Blocks {
    let last: Blocks | null = null;
    for (const detail of DETAIL)
        for (const scale of SCALES) {
            last = blocksAt(x, y, w, card, base, scale, detail);
            if (last.height <= maxH) return last;
        }
    return last!;
}

export function leadersLayout(
    size: ViewSize,
    card: LeadersCardView,
    text: LeadersText,
): LeadersLayout {
    const { w, h, spec, innerW, top, footerBox, tight } = cardFrame(
        size,
        card,
        text.url,
    );
    const { pad, gap } = spec;
    const fonts: Fonts = {
        label: spec.callout.label,
        name: Math.round(spec.callout.number * 0.42),
        sub: spec.callout.sub,
        gap: Math.round(gap * 0.7),
    };
    /** The title with the longest scope line that fits whole. */
    const title = (x: number, width: number) => {
        const lines = leadersScopeLines(card);
        for (const scope of lines) {
            const t = titleBlock(x, top, width, spec, text.headline, scope);
            if (t.scopeLine.text === scope) return t;
        }
        return titleBlock(
            x,
            top,
            width,
            spec,
            text.headline,
            lines[lines.length - 1],
        );
    };
    const done = (
        t: ReturnType<typeof titleBlock>,
        map: Box,
        blocks: Blocks,
        blocksBox: Box,
    ): LeadersLayout => ({
        w,
        h,
        // No one seat's lid stands out: the card is about every seat that covers the unit.
        strip: strip(w, spec.stripH),
        headline: t.headline,
        headlineLines: t.headlineLines,
        scopeLine: t.scopeLine,
        map,
        blocksBox,
        blocks: blocks.items,
        mix: blocks.mix,
        footerBox,
        footerFonts: spec.footer,
    });

    if (size === 'x') {
        // The map on the left at full height; the headline and the leaders on the right.
        const bodyBottom = Math.round(footerBox.y - tight);
        const mapW = Math.round(
            Math.min(
                (w - 2 * pad) * 0.5,
                Math.max(480, (bodyBottom - top) * text.mapAspect),
            ),
        );
        const colX = Math.round(pad + mapW + gap * 1.5);
        const colW = w - pad - colX;
        const t = title(colX, colW);
        const y = Math.round(t.bottom + tight);
        const blocks = fitBlocks(colX, y, colW, bodyBottom - y, card, fonts);
        return done(
            t,
            box(pad, top, mapW, bodyBottom - top),
            blocks,
            box(colX, y, colW, blocks.height),
        );
    }

    const t = title(pad, innerW);
    const bodyTop = Math.round(t.bottom + tight);
    const bodyBottom = Math.round(footerBox.y - tight);
    const bodyH = bodyBottom - bodyTop;

    // The map above the leaders: it keeps at least a third of the body, and the leaders take
    // what they need of the rest.
    const under = fitBlocks(
        pad,
        0,
        innerW,
        Math.round(bodyH * 0.66) - tight,
        card,
        fonts,
    );
    const stackMap = box(
        pad,
        bodyTop,
        innerW,
        Math.round(
            Math.min(
                bodyH - under.height - tight,
                // No taller than the shape drawn across the width: the rest stays with the leaders.
                innerW / text.mapAspect,
            ),
        ),
    );
    // The map beside the leaders (not on a story, which is too narrow for two columns).
    const sideW = Math.round(innerW * 0.46);
    const colX = pad + sideW + gap;
    const colW = pad + innerW - colX;
    const beside =
        size === 'story' ? null : fitBlocks(colX, bodyTop, colW, bodyH, card, fonts);
    const sideMap = box(pad, bodyTop, sideW, bodyH);
    const y = Math.round(stackMap.y + stackMap.h + tight);
    const below = fitBlocks(pad, y, innerW, bodyBottom - y, card, fonts);
    // Beside the map when that keeps the leaders easier to read (bigger type, more of their
    // detail); when both read the same, whichever draws the map larger.
    if (
        beside &&
        beside.height <= bodyH &&
        (beside.rank > below.rank ||
            (beside.rank === below.rank &&
                fittedArea(sideMap, text.mapAspect) >
                    fittedArea(stackMap, text.mapAspect)))
    ) {
        // The blocks sit in the middle of the height the map has.
        const dy = Math.round((bodyH - beside.height) / 2);
        const centred = dy
            ? fitBlocks(colX, bodyTop + dy, colW, bodyH, card, fonts)
            : beside;
        return done(
            t,
            sideMap,
            centred,
            box(colX, bodyTop + dy, colW, centred.height),
        );
    }
    return done(t, stackMap, below, box(pad, y, innerW, below.height));
}
