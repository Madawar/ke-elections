// What the share dialog can make: one registry of card kinds. Each kind says how its card is
// titled, captioned and laid out, what the dialog says about it, how it looks in the other theme,
// what its file is called, which sizes it comes in, whether its headline may be edited, and the
// map images its layout needs, and the component that draws it. The dialog only looks things up
// here, so a new kind of card is a new entry, not a new branch in the dialog.
import type { Component } from 'vue';
import {
    captionFor,
    leadersCaption,
    numbersCaption,
    partyCaption,
    type CaptionPlatform,
} from './caption';
import {
    type LeadersCardView,
    leadersCardView,
    leadersHeadline,
} from './leadersCard';
import { type LeadersLayout, leadersLayout } from './leadersLayout';
import {
    type NumbersCardView,
    numbersCardView,
    numbersHeadline,
} from './numbersCard';
import { type NumbersLayout, numbersLayout } from './numbersLayout';
import { type PartyCardView, partyHeadline } from './partyCard';
import { type PartyLayout, partyLayout } from './partyLayout';
import { VIEW_SIZES, type ViewSize, viewFilename } from './sizes';
import type { Box } from './layout';
import { type ViewLayout, viewLayout } from './viewLayout';
import { type ViewMapSpec, viewMapAspect } from './viewMap';
import {
    type ViewState,
    headlineFor,
    seatsInTheme,
    withTheme,
} from './viewState';
import LeadersCard from '@/components/export/LeadersCard.vue';
import NumbersCard from '@/components/export/NumbersCard.vue';
import PartyCard from '@/components/export/PartyCard.vue';
import ViewCard from '@/components/export/ViewCard.vue';
import type { MapTheme, ThemeName } from '@/lib/map/theme';
import type { SeatsData } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';

export type ShareableView =
    | ViewState
    | PartyCardView
    | LeadersCardView
    | NumbersCardView;
export type ShareLayout =
    | ViewLayout
    | PartyLayout
    | LeadersLayout
    | NumbersLayout;
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

// Written as methods so that each entry may take its own view and layout types.
interface CardKind<V extends ShareableView> {
    /** The key of the card in the dialog's "Card" choice. */
    key: string;
    sizes: readonly ViewSize[];
    /** False for a card whose headline is a fixed template, so it stays neutral. */
    editableHeadline: boolean;
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

type ViewOfKind = { [V in ShareableView as V['kind']]: V };

const CARDS: { [K in ShareKind]: CardKind<ViewOfKind[K]> } = {
    party: SEAT_VIEW,
    partyCard: PARTY_CARD,
    leaders: LEADERS_CARD,
    numbers: NUMBERS_CARD,
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
