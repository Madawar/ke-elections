// Layout for the cover of the county carousel, inside the frame every card shares (`cardFrame`:
// its sizes and safe zones, the ballot-lid strip, the footer). From the top: the county's name,
// the headline (whole: it shrinks a little, then wraps, never cut), the seats spelled out (shrunk
// a little, then wrapped), the county's map as large as the room left allows, and the line that
// says what the map's colours are. Every line is placed here; CoverCard.vue only draws it.
import { type CoverCardView, COVER_NOTE, COVER_SWIPE, coverKicker, coverScope } from './coverCard';
import type { Box, FooterFonts, TextItem } from './layout';
import type { ViewSize } from './sizes';
import { fitFontSize, textWidth, wrapText } from './text';
import { type StripSegment, box, cardFrame, strip, titleBlock } from './viewLayout';

export interface CoverLayout {
    w: number;
    h: number;
    strip: StripSegment[];
    /** "Kakamega County", above the headline. */
    kicker: TextItem;
    headline: Box;
    headlineLines: TextItem[];
    /** "1 governor, 1 senator, …. Swipe for each.", on as many lines as it needs. */
    scopeLines: TextItem[];
    map: Box;
    /** "Wards coloured by the MCA’s party", under the map. */
    note: TextItem;
    footerBox: Box;
    footerFonts: FooterFonts;
}

export interface CoverText {
    headline: string;
    url: string;
    /** Width over height of the county's shape. */
    mapAspect: number;
}

export function coverLayout(size: ViewSize, card: CoverCardView, text: CoverText): CoverLayout {
    const { w, h, spec, innerW, top, footerBox, tight } = cardFrame(size, card, text.url);
    const { pad } = spec;

    // The county's name, small, in the muted ink: plain text, as the data spells it.
    const kickerText = coverKicker(card);
    const kSize = fitFontSize(kickerText, innerW, Math.round(spec.scope * 0.86), Math.round(spec.scope * 0.6), true);
    const kickerLines = wrapText(kickerText, innerW, kSize, 1, true);
    const kicker: TextItem = {
        x: pad,
        y: Math.round(top + kSize * 0.9),
        text: kickerLines[0] ?? kickerText,
        size: kSize,
        weight: 600,
        tone: 'muted',
    };

    // The headline under it, as every card's headline is fitted.
    const t = titleBlock(pad, Math.round(kicker.y + kSize * 0.45), innerW, spec, text.headline, '');
    const headBottom = t.headline.y + t.headline.h;

    // The seats spelled out: a little smaller to stay on one line, else wrapped. Never cut.
    const scope = coverScope(card);
    const sSize = fitFontSize(scope, innerW, spec.scope, Math.round(spec.scope * 0.85));
    const sLead = Math.round(sSize * 1.3);
    // "Swipe for each." stays together: the rest is wrapped, and it goes on the last line where
    // it fits there, else on a line of its own.
    const head = scope.slice(0, scope.length - COVER_SWIPE.length).trimEnd();
    const wrapped = wrapText(head, innerW, sSize, Infinity);
    const last = `${wrapped[wrapped.length - 1]} ${COVER_SWIPE}`;
    if (textWidth(last, sSize) <= innerW) wrapped[wrapped.length - 1] = last;
    else wrapped.push(COVER_SWIPE);
    const scopeLines: TextItem[] = wrapped.map((line, i) => ({
        x: pad,
        y: Math.round(headBottom + sSize * 1.45 + i * sLead),
        text: line,
        size: sSize,
        tone: 'muted',
    }));
    const scopeBottom = scopeLines[scopeLines.length - 1].y + Math.round(sSize * 0.35);

    // The map as large as its shape fits in what is left, centred, with the note under it; the
    // two together sit in the middle of that room.
    const nSize = Math.round(spec.scope * 0.8);
    const noteH = Math.round(nSize * 1.7);
    const roomTop = Math.round(scopeBottom + tight);
    const roomBottom = Math.round(footerBox.y - tight);
    const roomH = roomBottom - roomTop - noteH;
    const aspect = text.mapAspect > 0 ? text.mapAspect : 1;
    const mapW = Math.round(Math.min(innerW, roomH * aspect));
    const mapH = Math.round(Math.min(roomH, mapW / aspect));
    const mapY = Math.round(roomTop + (roomH - mapH) / 2);
    const map = box(Math.round(pad + (innerW - mapW) / 2), mapY, mapW, mapH);
    const note: TextItem = {
        x: pad,
        y: Math.round(mapY + mapH + nSize * 1.35),
        text: COVER_NOTE,
        size: nSize,
        tone: 'muted',
    };

    return {
        w,
        h,
        // No one seat's lid stands out: the cover is about every seat in the county.
        strip: strip(w, spec.stripH),
        kicker,
        headline: t.headline,
        headlineLines: t.headlineLines,
        scopeLines,
        map,
        note,
        footerBox,
        footerFonts: spec.footer,
    };
}
