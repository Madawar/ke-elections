// What the share dialog can make: one registry of card kinds. Each kind says how its card is
// titled, captioned and laid out, what the dialog says about it, how it looks in the other theme,
// what its file is called, which sizes it comes in, whether its headline may be edited, and the
// map images its layout needs, and the component that draws it. The dialog only looks things up
// here, so a new kind of card is a new entry, not a new branch in the dialog.
import type { Component } from 'vue';
import {
    type BallotsCardView,
    ballotsCardView,
    ballotsHeadline,
} from './ballotsCard';
import { type BallotsLayout, ballotsLayout } from './ballotsLayout';
import {
    ballotsCaption,
    captionFor,
    fiveSeatsCaption,
    leadersCaption,
    numbersCaption,
    partyCaption,
    topCountiesCaption,
    type CaptionPlatform,
} from './caption';
import {
    FIVE_SEATS_HEADLINE,
    type FiveSeatsCardView,
    fiveSeatsCardView,
    fiveSeatsSpec,
} from './fiveSeatsCard';
import { type FiveSeatsLayout, fiveSeatsLayout } from './fiveSeatsLayout';
import {
    type LeadersCardView,
    leadersCardView,
    leadersHeadline,
} from './leadersCard';
import { type LeadersLayout, leadersLayout } from './leadersLayout';
import {
    BALLOT_ORDER,
    type NumbersCardView,
    numbersCardView,
    numbersHeadline,
} from './numbersCard';
import { type NumbersLayout, numbersLayout } from './numbersLayout';
import { type PartyCardView, partyHeadline } from './partyCard';
import { type PartyLayout, partyLayout } from './partyLayout';
import { VIEW_SIZES, type ViewSize, viewFilename } from './sizes';
import {
    type TopCountiesCardView,
    topCountiesCardView,
    topCountiesColouring,
    topCountiesHeadline,
} from './topCountiesCard';
import { type TopCountiesLayout, topCountiesLayout } from './topCountiesLayout';
import type { Box } from './layout';
import { type ViewLayout, viewLayout } from './viewLayout';
import { type ViewMapSpec, viewMapAspect } from './viewMap';
import {
    type ViewState,
    headlineFor,
    seatsInTheme,
    withTheme,
} from './viewState';
import BallotsCard from '@/components/export/BallotsCard.vue';
import FiveSeatsCard from '@/components/export/FiveSeatsCard.vue';
import LeadersCard from '@/components/export/LeadersCard.vue';
import NumbersCard from '@/components/export/NumbersCard.vue';
import PartyCard from '@/components/export/PartyCard.vue';
import TopCountiesCard from '@/components/export/TopCountiesCard.vue';
import ViewCard from '@/components/export/ViewCard.vue';
import { type MapTheme, THEMES, type ThemeName } from '@/lib/map/theme';
import type { SeatsData } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';

export type ShareableView =
    | ViewState
    | PartyCardView
    | LeadersCardView
    | NumbersCardView
    | TopCountiesCardView
    | FiveSeatsCardView
    | BallotsCardView;
export type ShareLayout =
    | ViewLayout
    | PartyLayout
    | LeadersLayout
    | NumbersLayout
    | TopCountiesLayout
    | FiveSeatsLayout
    | BallotsLayout;
export type ShareKind = ShareableView['kind'];

/** What a layout is laid out for besides the card: its headline, link and map shape. */
export interface CardText {
    headline: string;
    /** The card's link, as the footer prints it. */
    url: string;
    /** Width over height of the area the card's main map shows. */
    mapAspect: number;
}

/** One map image a card needs: where it goes and what `renderViewMap` draws in it. */
export interface MapSlot {
    key: string;
    box: Box;
    spec: ViewMapSpec;
}

/** A card the dialog's "Card" choice offers. */
export interface ShareCard {
    key: string;
    label: string;
    view: ShareableView;
}

interface Context {
    seats: SeatsData;
    index: UnitIndex;
}

export interface HeadlineWording {
    /** Under the headline's input. */
    hint: string;
    /** The link that puts the default headline back, once it has been edited. */
    reset: string;
}

/** The dialog's words for a card whose headline is its numbers ("MCA seats across Kenya: …"). */
export const NUMBERS_WORDING: HeadlineWording = {
    hint: 'Keep it to the numbers, so the image stays neutral.',
    reset: 'Use the numbers again',
};
/** The dialog's words for a card whose headline has no numbers in it. */
export const FACTS_WORDING: HeadlineWording = {
    hint: 'Keep it to the facts, so the image stays neutral.',
    reset: 'Use the default again',
};

// Written as methods so that each entry may take its own view and layout types.
interface CardKind<V extends ShareableView> {
    /** The key of the card in the dialog's "Card" choice. */
    key: string;
    sizes: readonly ViewSize[];
    /** False for a card whose headline is a fixed template, so it stays neutral. */
    editableHeadline: boolean;
    /**
     * The line under an editable headline and its reset link, for a card whose default headline
     * is not a count ("Who represents Isukha West ward"); `NUMBERS_WORDING` when not given.
     */
    headlineWording?: HeadlineWording;
    label(view: V): string;
    headline(view: V): string;
    caption(
        view: V,
        url: string,
        platform: CaptionPlatform,
        headline: string,
    ): string;
    layout(size: ViewSize, view: V, text: CardText): ShareLayout;
    /** The map images the layout places, in the order they are drawn. */
    maps(layout: ShareLayout, view: V): MapSlot[];
    /** The shape of the main map, which the layout is arranged around. */
    aspect(view: V): number;
    copy(view: V): { title: string; description: string };
    /** The same card in another theme. */
    inTheme(view: V, theme: ThemeName, ctx: Context): V;
    filename(view: V, size: ViewSize): string;
    /**
     * The component that draws the card. The dialog gives every card the same props (`view`,
     * `size`, `headline`, `mapImage`, `mapImages`, `mapPlaceholder`, `mapAspect`, `url`,
     * `theme`; see `CardProps`), and each card declares them all, using what it needs.
     */
    component: Component;
}

/** What the dialog hands every card's component. */
export interface CardProps {
    view: ShareableView;
    size: ViewSize;
    headline: string;
    /** The "map" slot's image, for the one-map cards; null while it is drawn. */
    mapImage: string | null;
    /** Every slot's image drawn so far, by slot key. */
    mapImages: Record<string, string>;
    /** Shown where a map is while it is drawn. */
    mapPlaceholder: string;
    mapAspect: number;
    url: string;
    theme: MapTheme;
}

const ALL_SIZES = Object.keys(VIEW_SIZES) as ViewSize[];

/** The one map of the cards that have one, named "map", drawn from the card itself. */
const oneMap = (
    layout: { map: Box },
    view: ViewMapSpec,
): MapSlot[] => [{ key: 'map', box: layout.map, spec: view }];

const SEAT_VIEW: CardKind<ViewState> = {
    key: 'view',
    sizes: ALL_SIZES,
    editableHeadline: true,
    label: () => 'This view',
    headline: headlineFor,
    caption: captionFor,
    layout: viewLayout,
    maps: (layout: ViewLayout, view) => oneMap(layout, view),
    aspect: viewMapAspect,
    copy: () => ({
        title: 'Share this view',
        description:
            'The map as it is now, with its numbers, sized for Instagram, stories or X.',
    }),
    inTheme: withTheme,
    filename: viewFilename,
    component: ViewCard,
};

const PARTY_CARD: CardKind<PartyCardView> = {
    key: 'partyCard',
    sizes: ALL_SIZES,
    editableHeadline: true,
    label: () => 'Party card',
    headline: partyHeadline,
    caption: partyCaption,
    layout: partyLayout,
    maps: (layout: PartyLayout, view) => oneMap(layout, view),
    aspect: viewMapAspect,
    copy: (view) => ({
        title: 'Share party card',
        description: `The party’s seats ${view.scope ? `in ${view.scope.name}` : 'across Kenya'}, with its numbers, sized for Instagram, stories or X.`,
    }),
    inTheme: (view, theme) => ({ ...view, theme }),
    filename: viewFilename,
    component: PartyCard,
};

const LEADERS_CARD: CardKind<LeadersCardView> = {
    key: 'leaders',
    sizes: ALL_SIZES,
    editableHeadline: true,
    label: (card) =>
        card.unit.level === 'county' ? 'County leaders' : 'Leaders',
    headline: leadersHeadline,
    caption: leadersCaption,
    layout: leadersLayout,
    maps: (layout: LeadersLayout, view) => oneMap(layout, view),
    aspect: viewMapAspect,
    copy: (view) => ({
        title: 'Share leaders card',
        description: `Who represents ${view.unit.name}, with sources, sized for Instagram, stories or X.`,
    }),
    // Taken again from the seats in that theme, so independents follow it.
    inTheme: (view, theme, ctx) =>
        leadersCardView({
            seats: seatsInTheme(ctx.seats, theme),
            index: ctx.index,
            focus: { level: view.focus.level, code: view.focus.code },
            theme,
            sample: view.sample,
        }) ?? { ...view, theme },
    filename: viewFilename,
    component: LeadersCard,
};

const NUMBERS_CARD: CardKind<NumbersCardView> = {
    key: 'numbers',
    // No map: square for feeds, story for TikTok and Reels.
    sizes: ['square', 'story'],
    editableHeadline: true,
    label: () => 'By the numbers',
    headline: numbersHeadline,
    caption: numbersCaption,
    layout: numbersLayout,
    maps: () => [],
    aspect: () => 1,
    copy: () => ({
        title: 'Share by the numbers',
        description:
            'Every elected seat below the President and who holds them now, sized for Instagram or stories.',
    }),
    // Taken again from the seats in that theme, so independents follow it.
    inTheme: (view, theme, ctx) =>
        numbersCardView({
            seats: seatsInTheme(ctx.seats, theme),
            index: ctx.index,
            theme,
            sample: view.sample,
        }),
    filename: (_view, size) => `kenya-electoral-map-numbers-${size}.png`,
    component: NumbersCard,
};

const TOP_COUNTIES: CardKind<TopCountiesCardView> = {
    key: 'topCounties',
    // Ranked rows beside a map: square for feeds, story for TikTok and Reels.
    sizes: ['square', 'story'],
    // The group is the person's pick; the headline is a fixed template so the card stays neutral.
    editableHeadline: false,
    label: () => 'Top 10 counties',
    headline: topCountiesHeadline,
    caption: topCountiesCaption,
    layout: topCountiesLayout,
    // Kenya with the listed counties in the group's colour. The colouring fills counties, so the
    // spec names a seat held at the county (governor): that is what decides which fills are
    // coloured, and that no ward lines are drawn. The county lines get a halo so two listed
    // counties side by side stay apart.
    maps: (layout: TopCountiesLayout, view) => [
        {
            key: 'map',
            box: layout.map,
            spec: {
                seat: 'governor',
                only: [],
                focus: null,
                showSurroundings: false,
                colouring: topCountiesColouring(view, THEMES[view.theme]),
                haloCountyLines: true,
            },
        },
    ],
    aspect: () => viewMapAspect({ focus: null } as ViewMapSpec),
    copy: (view) => ({
        title: 'Share top 10 counties',
        description: `The counties where ${topCountiesHeadline(view).replace(/^Where /, '')}, sized for Instagram or stories.`,
    }),
    // Taken again from the seats in that theme, so independents follow it.
    inTheme: (view, theme, ctx) =>
        topCountiesCardView({
            seats: seatsInTheme(ctx.seats, theme),
            index: ctx.index,
            seat: view.seat,
            group: view.group,
            theme,
            sample: view.sample,
        }),
    filename: (view, size) =>
        `kenya-electoral-map-top-counties-${view.group.toLowerCase()}-${view.seat}-${size}.png`,
    component: TopCountiesCard,
};

const FIVE_SEATS: CardKind<FiveSeatsCardView> = {
    key: 'fiveSeats',
    // Five maps and a key: square for feeds, story for TikTok and Reels.
    sizes: ['square', 'story'],
    editableHeadline: true,
    headlineWording: FACTS_WORDING,
    label: () => 'Five seats',
    headline: () => FIVE_SEATS_HEADLINE,
    caption: fiveSeatsCaption,
    layout: fiveSeatsLayout,
    // One map per seat, in ballot order: that seat across Kenya, as the seat view colours it.
    maps: (layout: FiveSeatsLayout, view) =>
        BALLOT_ORDER.map((seat, i) => ({
            key: seat,
            box: layout.maps[i].box,
            spec: fiveSeatsSpec(view, seat),
        })),
    aspect: () => viewMapAspect({ focus: null } as ViewMapSpec),
    copy: () => ({
        title: 'Share five seats',
        description:
            'All five elected seats on one card, each map coloured by party, sized for Instagram or stories.',
    }),
    // Taken again from the seats in that theme, so independents follow it.
    inTheme: (view, theme, ctx) =>
        fiveSeatsCardView({
            seats: seatsInTheme(ctx.seats, theme),
            index: ctx.index,
            theme,
            sample: view.sample,
        }),
    filename: (_view, size) => `kenya-electoral-map-five-seats-${size}.png`,
    component: FiveSeatsCard,
};

const BALLOTS: CardKind<BallotsCardView> = {
    key: 'ballots',
    // Five papers down the card: portrait for feeds, story for TikTok and Reels.
    sizes: ['portrait', 'story'],
    // Editable, as the leaders card it replaces on a ward.
    editableHeadline: true,
    headlineWording: FACTS_WORDING,
    label: () => 'Who represents',
    headline: ballotsHeadline,
    caption: ballotsCaption,
    layout: ballotsLayout,
    // One map per paper, each framed and marked by code, on the paper's surface: the county with
    // the ward marked, the county with the constituency, the constituency with the ward.
    maps: (layout: BallotsLayout, view) =>
        view.papers.map((paper, i) => ({
            key: paper.key,
            box: layout.papers[i].map,
            spec: {
                seat: paper.map.mark.level === 'ward' ? 'mca' : 'mp',
                only: [],
                focus: paper.map.frame,
                showSurroundings: false,
                mark: paper.map.mark,
                wardLines: false,
                onSurface: true,
            },
        })),
    aspect: (view) => viewMapAspect({ focus: view.papers[0].map.frame } as ViewMapSpec),
    copy: (view) => ({
        title: 'Share who represents this ward',
        description: `The five elected seats of ${view.ward.name} ward and who holds them, with sources, sized for Instagram or stories.`,
    }),
    // Taken again from the seats in that theme, so independents follow it.
    inTheme: (view, theme, ctx) =>
        ballotsCardView({
            seats: seatsInTheme(ctx.seats, theme),
            index: ctx.index,
            ward: view.ward.code,
            theme,
            sample: view.sample,
        }) ?? { ...view, theme },
    filename: (view, size) =>
        `kenya-electoral-map-ward-${view.ward.code}-who-represents-${size}.png`,
    component: BallotsCard,
};

type ViewOfKind = { [V in ShareableView as V['kind']]: V };

const CARDS: { [K in ShareKind]: CardKind<ViewOfKind[K]> } = {
    party: SEAT_VIEW,
    partyCard: PARTY_CARD,
    leaders: LEADERS_CARD,
    numbers: NUMBERS_CARD,
    topCounties: TOP_COUNTIES,
    fiveSeats: FIVE_SEATS,
    ballots: BALLOTS,
};

// TypeScript cannot follow a union of views to the matching entry, so this one lookup says it.
const kindOf = <V extends ShareableView>(view: V) =>
    CARDS[view.kind] as unknown as CardKind<V>;

export const isPartyCard = (v: ShareableView): v is PartyCardView =>
    v.kind === 'partyCard';
export const isLeadersCard = (v: ShareableView): v is LeadersCardView =>
    v.kind === 'leaders';

/** The same card in another theme. */
export function inTheme(
    view: ShareableView,
    theme: ThemeName,
    ctx: Context,
): ShareableView {
    return view.theme === theme ? view : kindOf(view).inTheme(view, theme, ctx);
}

/** The headline made from the numbers alone. */
export const headlineOf = (view: ShareableView): string =>
    kindOf(view).headline(view);

/** False for a card whose headline is fixed: the dialog shows it, with no input. */
export const headlineEditable = (view: ShareableView): boolean =>
    kindOf(view).editableHeadline;

/** The line under an editable headline and its reset link, for this card. */
export const headlineWording = (view: ShareableView): HeadlineWording =>
    kindOf(view).headlineWording ?? NUMBERS_WORDING;

export const captionOf = (
    view: ShareableView,
    url: string,
    platform: CaptionPlatform,
    headline: string,
): string => kindOf(view).caption(view, url, platform, headline);

export const layoutOf = (
    size: ViewSize,
    view: ShareableView,
    text: CardText,
): ShareLayout => kindOf(view).layout(size, view, text);

/** The map images the card needs at this size, each with its box on the card. */
export function mapSlotsOf(
    size: ViewSize,
    view: ShareableView,
    text: CardText,
): MapSlot[] {
    const kind = kindOf(view);
    return kind.maps(kind.layout(size, view, text), view);
}

/** The shape of the card's main map (the layouts arrange themselves around it). */
export const aspectOf = (view: ShareableView): number =>
    kindOf(view).aspect(view);

/** The sizes the card comes in, in the dialog's order. */
export const sizesOf = (view: ShareableView): readonly ViewSize[] =>
    kindOf(view).sizes;

export const filenameOf = (view: ShareableView, size: ViewSize): string =>
    kindOf(view).filename(view, size);

export const dialogCopy = (view: ShareableView) => kindOf(view).copy(view);

/** The component that draws the card, given `CardProps`. */
export const componentOf = (view: ShareableView): Component =>
    kindOf(view).component;

/** What the dialog calls a leaders card when it offers it beside the view. */
export const leadersLabel = (card: LeadersCardView): string =>
    LEADERS_CARD.label(card);

/**
 * The "Card" choice, in the order given (the first is the card the dialog opens on). A card that
 * is not on offer here is passed as null or false and left out.
 */
export const shareCards = (
    views: readonly (ShareableView | null | false | undefined)[],
): ShareCard[] =>
    views
        .filter((v): v is ShareableView => !!v)
        .map((view) => ({
            key: kindOf(view).key,
            label: kindOf(view).label(view),
            view,
        }));
