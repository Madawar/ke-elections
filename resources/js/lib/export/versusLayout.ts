// Layout for "Side by side", X and story, inside the frame the other share cards use (cardFrame:
// sizes, safe zones, the ballot-lid strip, the footer). Every box and line is placed here, so the
// card only draws what this returns and tests can check that nothing overlaps or is cut.
//
// Two halves, one per county, lower IEBC code first: on X side by side, on the story the second
// under the first. Each half is, top to bottom: the county's name, its seat count, the mix bar,
// the key, the map and the leaders line (X); on the story the map stands at the right of the half,
// as tall as the half, and the words take the column beside it. Both halves are set in one type
// scale, and every row starts at the same offset in both: a row's height is the taller of the two
// (a key that wraps to two lines in one half leaves two lines of room in the other), so names,
// bars, keys, maps and leaders lines line up. The two map boxes are the same size.
import type { Box, FooterFonts, TextItem } from './layout';
import type { ViewSize } from './sizes';
import { textWidth, wrapText } from './text';
import {
    VERSUS_EMPTY,
    VERSUS_SCOPE,
    type VersusCardView,
    type VersusHalf,
} from './versusCard';
import { inkOn, spread } from './viewMix';
import {
    HEADLINE_STRETCH,
    SPECS,
    type StripSegment,
    box,
    cardFrame,
    strip,
} from './viewLayout';

export type VersusSize = Extract<ViewSize, 'x' | 'story'>;

export interface VersusBarPart extends Box {
    key: string;
    colour: string;
    /** The no-data part, near the card's own colour: drawn with a hairline. */
    outlined: boolean;
    /** The count, when it fits inside the part with room to spare. */
    label: TextItem | null;
    /** The colour of that count. */
    ink: string;
}

export interface VersusKeyItem {
    key: string;
    chip: Box & { colour: string; outlined: boolean };
    /** "ODM 35", "Other parties 4", "No approved holder yet 2". */
    label: TextItem;
}

export interface VersusLeaderItem {
    seat: string;
    /** The seat's ballot-colour tick. */
    tick: Box & { colour: string };
    /** "Governor", muted. */
    label: TextItem;
    /** The party's chip; none for a seat with no approved holder. */
    chip: (Box & { colour: string }) | null;
    /** "UDA", "Independent" in ink, or "No approved data yet", muted. */
    party: TextItem;
}

export interface VersusHalfItem {
    code: number;
    /** The half's whole area. */
    box: Box;
    name: TextItem[];
    units: TextItem;
    bar: { box: Box; parts: VersusBarPart[] };
    key: VersusKeyItem[];
    /** The rows' boxes, for the checks: as tall as the taller half's. */
    keyBox: Box;
    map: Box;
    leaders: VersusLeaderItem[];
    leadersBox: Box;
}

export interface VersusLayout {
    w: number;
    h: number;
    strip: StripSegment[];
    headline: Box;
    headlineLines: TextItem[];
    scopeLine: TextItem;
    halves: [VersusHalfItem, VersusHalfItem];
    /** The type scale both halves are set in. */
    scale: number;
    footerBox: Box;
    footerFonts: FooterFonts;
}

export interface VersusText {
    headline: string;
    url: string;
}

/** The half's type at scale 1. */
const TYPE: Record<VersusSize, { name: number; units: number; bar: number; count: number; key: number; leaders: number }> = {
    x: { name: 38, units: 21, bar: 38, count: 20, key: 20, leaders: 20 },
    story: { name: 46, units: 26, bar: 44, count: 24, key: 24, leaders: 24 },
};
/**
 * The scales tried, largest first, until the half fits. The story's words have a half's whole
 * height beside the map, so they may grow past their base size to fill it.
 */
const SCALES: Record<VersusSize, number[]> = {
    x: [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
    story: [1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
};
/** On X, the map keeps at least this share of a half's height, or the type steps down. */
const X_MAP_MIN = 0.4;
/** On the story, the map's share of the content width. */
const STORY_MAP = 0.42;
/** The headline goes on one line when it fits there at this share of its size or more. */
const ONE_LINE = 0.8;

/**
 * The headline, whole: on one line when it fits at ONE_LINE of its size or more, else on two
 * broken before " and " ("MCA seats: Elgeyo/Marakwet" / "and Tharaka - Nithi"), at the largest
 * size at which both lines fit. Never cut.
 */
export function versusHeadlineLines(
    text: string,
    w: number,
    base: number,
): { size: number; lines: string[] } {
    const fits = (t: string, s: number) => textWidth(t, s, true) <= w;
    for (let s = base; s >= Math.round(base * ONE_LINE); s -= 2)
        if (fits(text, s)) return { size: s, lines: [text] };
    const at = text.indexOf(' and ', text.indexOf(': ') + 1);
    const lines =
        at > 0 ? [text.slice(0, at), text.slice(at + 1)] : wrapText(text, w, base, 2, true);
    let s = base;
    while (s > 12 && !lines.every((l) => fits(l, s))) s--;
    return { size: s, lines };
}

/** Pieces laid left to right with `gap` between them, onto as many lines as `w` needs. */
function flow(widths: number[], w: number, gap: number): { line: number; x: number }[] {
    const out: { line: number; x: number }[] = [];
    let line = 0;
    let x = 0;
    for (const pw of widths) {
        if (x > 0 && x + gap + pw > w) {
            line++;
            x = 0;
        }
        const at = x > 0 ? x + gap : 0;
        out.push({ line, x: at });
        x = at + pw;
    }
    return out;
}

const keyText = (k: VersusHalf['key'][number]) => `${k.label} ${k.count.toLocaleString('en-GB')}`;

interface Type {
    name: number;
    units: number;
    bar: number;
    count: number;
    key: number;
    leaders: number;
}

const keyMetrics = (t: Type) => ({
    chip: Math.round(t.key * 0.8),
    chipGap: Math.round(t.key * 0.4),
    gap: Math.round(t.key * 1.1),
    lead: Math.round(t.key * 1.45),
});
const keyWidths = (h: VersusHalf, t: Type) => {
    const m = keyMetrics(t);
    return h.key.map((k) => m.chip + m.chipGap + Math.ceil(textWidth(keyText(k), t.key)));
};

const leaderMetrics = (t: Type) => ({
    tick: Math.max(4, Math.round(t.leaders * 0.22)),
    tickGap: Math.round(t.leaders * 0.45),
    chip: Math.round(t.leaders * 0.75),
    chipGap: Math.round(t.leaders * 0.35),
    labelGap: Math.round(t.leaders * 0.5),
    /** Between one seat and the next: a real gap, no separator. */
    gap: Math.round(t.leaders * 1.6),
    lead: Math.round(t.leaders * 1.5),
});
const leaderWidth = (l: VersusHalf['leaders'][number], t: Type) => {
    const m = leaderMetrics(t);
    const label = Math.ceil(textWidth(l.label, t.leaders));
    return l.party
        ? m.tick + m.tickGap + label + m.labelGap + m.chip + m.chipGap + Math.ceil(textWidth(l.party.label, t.leaders, true))
        : m.tick + m.tickGap + label + m.labelGap + Math.ceil(textWidth(VERSUS_EMPTY, t.leaders));
};

/** The rows' heights for one scale and column width, the taller of the two halves for each. */
function rows(card: VersusCardView, t: Type, w: number) {
    const nameLines = Math.max(
        ...card.halves.map((h) => wrapText(h.name, w, t.name, Infinity, true).length),
    );
    const km = keyMetrics(t);
    const keyLines = Math.max(
        ...card.halves.map((h) => (flow(keyWidths(h, t), w, km.gap).at(-1)?.line ?? 0) + 1),
    );
    const lm = leaderMetrics(t);
    const leaderLines = Math.max(
        ...card.halves.map(
            (h) => (flow(h.leaders.map((l) => leaderWidth(l, t)), w, lm.gap).at(-1)?.line ?? 0) + 1,
        ),
    );
    const nameLead = Math.round(t.name * 1.1);
    const name = 0;
    const units = nameLines * nameLead + Math.round(t.units * 0.25);
    const bar = units + Math.round(t.units * 1.55);
    const key = bar + t.bar + Math.round(t.key * 0.7);
    const keyH = keyLines * km.lead;
    const afterKey = key + keyH + Math.round(t.key * 0.5);
    const leadersH = leaderLines * lm.lead;
    return { nameLines, nameLead, name, units, bar, key, keyH, keyLines, afterKey, leadersH, leaderLines };
}

export function versusLayout(
    size: VersusSize,
    card: VersusCardView,
    text: VersusText,
): VersusLayout {
    const { w, h, spec, innerW, top, footerBox, tight } = cardFrame(size, card, text.url);
    const { pad } = spec;
    const story = size === 'story';
    // The headline, whole, and the scope line under it.
    const headW = innerW / HEADLINE_STRETCH;
    const head = versusHeadlineLines(text.headline, headW, spec.headline);
    const lead = head.size * 1.08;
    const headlineLines: TextItem[] = head.lines.map((line, i) => ({
        x: pad,
        y: Math.round(top + head.size * 0.9 + i * lead),
        text: line,
        size: head.size,
        weight: 700,
        tone: 'ink',
    }));
    const headBottom = top + head.size * 0.9 + (head.lines.length - 1) * lead + head.size * 0.26;
    const scopeSize = spec.scope;
    const scopeY = Math.round(headBottom + scopeSize * 1.45);
    const scopeLine: TextItem = { x: pad, y: scopeY, text: VERSUS_SCOPE, size: scopeSize, tone: 'muted' };
    const bodyTop = Math.round(scopeY + scopeSize * 0.35 + tight * 1.4);
    const bodyBottom = Math.round(footerBox.y - tight);

    const halfGap = story ? Math.round(spec.gap * 1.2) : Math.round(spec.gap * 1.55);
    const halfW = story ? innerW : Math.floor((innerW - halfGap) / 2);
    const halfH = story
        ? Math.floor((bodyBottom - bodyTop - halfGap) / 2)
        : bodyBottom - bodyTop;
    const mapGap = spec.gap;
    const storyMapW = Math.round(innerW * STORY_MAP);
    // The words' column: the half on X, the room beside the map on the story.
    const colW = story ? innerW - storyMapW - mapGap : halfW;
    const floor = spec.footer.small;
    const typeAt = (k: number): Type => {
        const b = TYPE[size];
        const s = (n: number) => Math.max(floor, Math.round(n * k));
        // Names are never cut: one size for both, small enough that no word of either is wider
        // than the column (a name with spaces may still wrap, and both halves leave that room).
        let name = s(b.name);
        const words = card.halves.flatMap((hv) => hv.name.split(/\s+/));
        while (name > floor && words.some((wd) => textWidth(wd, name, true) > colW)) name--;
        return { name, units: s(b.units), bar: Math.round(b.bar * k), count: s(b.count), key: s(b.key), leaders: s(b.leaders) };
    };
    const fits = (k: number) => {
        const t = typeAt(k);
        // Each key entry and each county seat is one piece that never breaks: the widest of either
        // half must fit the words' column, or it would run into the map (a vacant Woman Rep).
        const widest = Math.max(
            ...card.halves.flatMap((hv) => [
                ...keyWidths(hv, t),
                ...hv.leaders.map((l) => leaderWidth(l, t)),
            ]),
        );
        if (widest > colW) return false;
        const r = rows(card, t, colW);
        if (story) return r.afterKey + r.leadersH <= halfH;
        const mapH = halfH - r.afterKey - r.leadersH - Math.round(t.leaders * 0.5);
        return mapH >= halfH * X_MAP_MIN;
    };
    const scale = SCALES[size].find(fits) ?? SCALES[size].at(-1)!;
    const t = typeAt(scale);
    const r = rows(card, t, colW);
    const km = keyMetrics(t);
    const lm = leaderMetrics(t);
    // On X the map takes what the rows leave; the leaders line sits under it, at the half's foot.
    const leadersTop = story ? r.afterKey : halfH - r.leadersH;
    const mapBox = (x: number, y: number): Box =>
        story
            ? box(x + innerW - storyMapW, y, storyMapW, halfH)
            : box(x, y + r.afterKey, halfW, Math.max(0, leadersTop - Math.round(t.leaders * 0.5) - r.afterKey));

    const halfAt = (hv: VersusHalf, i: number): VersusHalfItem => {
        const x = story ? pad : pad + i * (halfW + halfGap);
        const y = story ? bodyTop + i * (halfH + halfGap) : bodyTop;
        const nameLines = wrapText(hv.name, colW, t.name, Infinity, true);
        const name: TextItem[] = nameLines.map((line, j) => ({
            x,
            y: Math.round(y + t.name * 0.9 + j * r.nameLead),
            text: line,
            size: t.name,
            weight: 700,
            tone: 'ink',
        }));
        const units: TextItem = {
            x,
            y: Math.round(y + r.units + t.units * 1.0),
            text: hv.units,
            size: t.units,
            tone: 'muted',
        };
        // The bar: the key's parts in its order, with a gap in the card's colour between them.
        const barBox = box(x, y + r.bar, colW, t.bar);
        const barPad = Math.round(t.count * 0.45);
        const parts: VersusBarPart[] = spread(hv.key, x, colW, 3).map((p) => {
            const count = p.count.toLocaleString('en-GB');
            const room = textWidth(count, t.count, true) + 2 * barPad <= p.w;
            return {
                key: p.key,
                colour: p.colour,
                outlined: p.key === 'none',
                x: p.x,
                y: barBox.y,
                w: p.w,
                h: barBox.h,
                ink: inkOn(p.colour),
                label: room
                    ? {
                          x: p.x + barPad,
                          y: Math.round(barBox.y + barBox.h / 2 + t.count * 0.36),
                          text: count,
                          size: t.count,
                          weight: 700,
                          tone: 'ink',
                      }
                    : null,
            };
        });
        // The key, flowing onto as many lines as it needs.
        const keyTop = y + r.key;
        const placed = flow(keyWidths(hv, t), colW, km.gap);
        const key: VersusKeyItem[] = hv.key.map((k, j) => {
            const at = placed[j];
            const baseline = Math.round(keyTop + at.line * km.lead + t.key * 0.95);
            return {
                key: k.key,
                chip: {
                    x: x + at.x,
                    y: baseline - Math.round(t.key * 0.76),
                    w: km.chip,
                    h: km.chip,
                    colour: k.colour,
                    outlined: k.key === 'none',
                },
                label: { x: x + at.x + km.chip + km.chipGap, y: baseline, text: keyText(k), size: t.key, tone: 'ink' },
            };
        });
        // The three county seats, each its own item with its tick; real gaps, no separators.
        const lTop = y + leadersTop;
        const lPlaced = flow(hv.leaders.map((l) => leaderWidth(l, t)), colW, lm.gap);
        const leaders: VersusLeaderItem[] = hv.leaders.map((l, j) => {
            const at = lPlaced[j];
            const mid = lTop + at.line * lm.lead + lm.lead / 2;
            const baseline = Math.round(mid + t.leaders * 0.36);
            const lx = x + at.x;
            const labelX = lx + lm.tick + lm.tickGap;
            const afterLabel = labelX + Math.ceil(textWidth(l.label, t.leaders)) + lm.labelGap;
            return {
                seat: l.seat,
                tick: { x: lx, y: Math.round(mid - t.leaders * 0.55), w: lm.tick, h: Math.round(t.leaders * 1.1), colour: l.tick },
                label: { x: labelX, y: baseline, text: l.label, size: t.leaders, tone: 'muted' },
                chip: l.party
                    ? { x: afterLabel, y: Math.round(mid - lm.chip / 2), w: lm.chip, h: lm.chip, colour: l.party.colour }
                    : null,
                party: l.party
                    ? { x: afterLabel + lm.chip + lm.chipGap, y: baseline, text: l.party.label, size: t.leaders, weight: 600, tone: 'ink' }
                    : { x: afterLabel, y: baseline, text: VERSUS_EMPTY, size: t.leaders, tone: 'muted' },
            };
        });
        return {
            code: hv.code,
            box: box(x, y, halfW, halfH),
            name,
            units,
            bar: { box: barBox, parts },
            key,
            keyBox: box(x, keyTop, colW, r.keyH),
            map: mapBox(x, y),
            leaders,
            leadersBox: box(x, lTop, colW, r.leadersH),
        };
    };

    return {
        w,
        h,
        strip: strip(w, spec.stripH, card.seat),
        headline: box(pad, top, innerW, Math.ceil(headBottom - top)),
        headlineLines,
        scopeLine,
        halves: [halfAt(card.halves[0], 0), halfAt(card.halves[1], 1)],
        scale,
        footerBox,
        footerFonts: spec.footer,
    };
}

/** The sizes the card comes in. */
export const VERSUS_SIZES: readonly VersusSize[] = ['x', 'story'];
/** The spec of each size, for the tests. */
export const versusSpecOf = (size: VersusSize) => SPECS[size];
