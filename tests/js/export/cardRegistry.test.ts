// The registry of card kinds (lib/export/shareView.ts). The three kinds that came before it (the
// seat view, the party card and the leaders card) must give exactly what their own functions
// give, so moving them into the registry changed nothing.
import { describe, expect, it } from 'vitest';
import {
    captionFor,
    leadersCaption,
    partyCaption,
} from '@/lib/export/caption';
import { leadersCardView, leadersHeadline } from '@/lib/export/leadersCard';
import { leadersLayout } from '@/lib/export/leadersLayout';
import { partyCardView, partyHeadline } from '@/lib/export/partyCard';
import { partyLayout } from '@/lib/export/partyLayout';
import {
    type ShareableView,
    aspectOf,
    captionOf,
    dialogCopy,
    filenameOf,
    headlineEditable,
    headlineOf,
    inTheme,
    layoutOf,
    mapSlotsOf,
    shareCards,
    sizesOf,
} from '@/lib/export/shareView';
import { VIEW_SIZES, type ViewSize, viewFilename } from '@/lib/export/sizes';
import { viewLayout } from '@/lib/export/viewLayout';
import {
    viewColouring,
    viewMapAspect,
} from '@/lib/export/viewMap';
import {
    headlineFor,
    seatsInTheme,
    snapshotView,
    withTheme,
} from '@/lib/export/viewState';
import { THEMES } from '@/lib/map/theme';
import { PARTY_SEATS } from '../party/partyFixtures';
import { VIEW_SEATS, viewIndex } from './viewFixtures';

const SIZES = Object.keys(VIEW_SIZES) as ViewSize[];
const URL = 'https://example.org/x';
const ctx = { seats: VIEW_SEATS, index: viewIndex };

const seatView = snapshotView({
    seats: VIEW_SEATS,
    index: viewIndex,
    seat: 'mca',
    focus: null,
    only: ['UDA'],
    showSurroundings: false,
    theme: 'dark',
});
const countyView = snapshotView({
    seats: VIEW_SEATS,
    index: viewIndex,
    seat: 'mp',
    focus: { level: 'county', code: 47 },
    only: [],
    showSurroundings: false,
    theme: 'dark',
});
const party = partyCardView({
    seats: seatsInTheme(PARTY_SEATS, 'dark'),
    abbrev: 'UDA',
    theme: 'dark',
})!;
const county = leadersCardView({
    seats: VIEW_SEATS,
    index: viewIndex,
    focus: { level: 'county', code: 47 },
    theme: 'dark',
})!;
const constituency = leadersCardView({
    seats: VIEW_SEATS,
    index: viewIndex,
    focus: { level: 'constituency', code: 290 },
    theme: 'dark',
})!;

describe('the card registry, for the kinds that came before it', () => {
    it('gives each kind its own headline and caption, as before', () => {
        expect(headlineOf(seatView)).toBe(headlineFor(seatView));
        expect(headlineOf(party)).toBe(partyHeadline(party));
        expect(headlineOf(county)).toBe(leadersHeadline(county));
        for (const platform of ['instagram', 'x'] as const) {
            expect(captionOf(seatView, URL, platform, 'H')).toBe(
                captionFor(seatView, URL, platform, 'H'),
            );
            expect(captionOf(party, URL, platform, 'H')).toBe(
                partyCaption(party, URL, platform, 'H'),
            );
            expect(captionOf(county, URL, platform, 'H')).toBe(
                leadersCaption(county, URL, platform, 'H'),
            );
        }
    });

    it('lays each kind out with its own layout, in all four sizes', () => {
        for (const size of SIZES) {
            const text = (v: ShareableView) => ({
                headline: headlineOf(v),
                url: URL,
                mapAspect: 0.82,
            });
            expect(layoutOf(size, seatView, text(seatView))).toEqual(
                viewLayout(size, seatView, text(seatView)),
            );
            expect(layoutOf(size, party, text(party))).toEqual(
                partyLayout(size, party, text(party)),
            );
            expect(layoutOf(size, county, text(county))).toEqual(
                leadersLayout(size, county, text(county)),
            );
        }
    });

    it('comes in all four sizes, with an editable headline', () => {
        for (const v of [seatView, party, county]) {
            expect(sizesOf(v)).toEqual(SIZES);
            expect(headlineEditable(v)).toBe(true);
        }
    });

    it('has one map, "map", in the box its layout gives, drawn from the card itself', () => {
        for (const v of [seatView, countyView, party, county, constituency])
            for (const size of SIZES) {
                const text = { headline: headlineOf(v), url: URL, mapAspect: 1.2 };
                const slots = mapSlotsOf(size, v, text);
                expect(slots).toHaveLength(1);
                expect(slots[0].key).toBe('map');
                expect(slots[0].box).toEqual(
                    (layoutOf(size, v, text) as { map: unknown }).map,
                );
                expect(slots[0].spec).toBe(v);
            }
        expect(aspectOf(countyView)).toBe(viewMapAspect(countyView));
        expect(aspectOf(party)).toBe(viewMapAspect(party));
    });

    it('keeps the dialog copy and the file names', () => {
        expect(dialogCopy(seatView).title).toBe('Share this view');
        expect(dialogCopy(party).title).toBe('Share party card');
        expect(dialogCopy(county).title).toBe('Share leaders card');
        for (const v of [seatView, countyView, party, county, constituency])
            for (const size of SIZES)
                expect(filenameOf(v, size)).toBe(viewFilename(v, size));
    });

    it('takes each kind into the other theme as before', () => {
        expect(inTheme(seatView, 'light', ctx)).toEqual(
            withTheme(seatView, 'light', ctx),
        );
        expect(inTheme(party, 'light', ctx)).toEqual({
            ...party,
            theme: 'light',
        });
        expect(inTheme(county, 'light', ctx)).toEqual(
            leadersCardView({
                seats: seatsInTheme(VIEW_SEATS, 'light'),
                index: viewIndex,
                focus: { level: 'county', code: 47 },
                theme: 'light',
            }),
        );
        // The same theme is the same card, not a copy.
        expect(inTheme(county, 'dark', ctx)).toBe(county);
    });
});

describe('shareCards: the "Card" choice', () => {
    it('names each card as the dialog offers it, in the order given, and skips what is missing', () => {
        expect(
            shareCards([countyView, county, null, false]).map((c) => [
                c.key,
                c.label,
            ]),
        ).toEqual([
            ['view', 'This view'],
            ['leaders', 'County leaders'],
        ]);
        expect(shareCards([constituency])[0].label).toBe('Leaders');
        expect(shareCards([party])[0]).toEqual({
            key: 'partyCard',
            label: 'Party card',
            view: party,
        });
    });
});

describe('a map spec with its own colouring', () => {
    it('is drawn with that colouring as it is, not the seat colouring', () => {
        const own = {
            mode: { kind: 'seat', seat: 'mca' },
            colours: new Map([[47, '#123456']]),
            fallback: '#abcdef',
        } as const;
        const spec = {
            ...seatView,
            colouring: { ...own, mode: { ...own.mode } },
        } as Parameters<typeof viewColouring>[0];
        expect(viewColouring(spec, VIEW_SEATS, THEMES.dark)).toBe(
            spec.colouring,
        );
        // Without one, the seat colouring as before.
        expect(
            viewColouring(seatView, VIEW_SEATS, THEMES.dark).colours.size,
        ).toBeGreaterThan(0);
    });
});
