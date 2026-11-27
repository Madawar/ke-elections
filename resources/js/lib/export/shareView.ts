// What the share dialog shows: either a seat view ("Share this view") or a party card. The dialog
// is one component for both; everything that differs between them is looked up here.
import {
    captionFor,
    leadersCaption,
    partyCaption,
    type CaptionPlatform,
} from './caption';
import {
    type LeadersCardView,
    leadersCardView,
    leadersHeadline,
} from './leadersCard';
import { type LeadersLayout, leadersLayout } from './leadersLayout';
import { type PartyCardView, partyHeadline } from './partyCard';
import { type PartyLayout, partyLayout } from './partyLayout';
import type { ViewSize } from './sizes';
import type { Box } from './layout';
import { type ViewLayout, viewLayout } from './viewLayout';
import {
    type ViewState,
    headlineFor,
    seatsInTheme,
    withTheme,
} from './viewState';
import type { ThemeName } from '@/lib/map/theme';
import type { SeatsData } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';

export type ShareableView = ViewState | PartyCardView | LeadersCardView;

export const isPartyCard = (v: ShareableView): v is PartyCardView =>
    v.kind === 'partyCard';
export const isLeadersCard = (v: ShareableView): v is LeadersCardView =>
    v.kind === 'leaders';

/** The same card in another theme. */
export function inTheme(
    view: ShareableView,
    theme: ThemeName,
    ctx: { seats: SeatsData; index: UnitIndex },
): ShareableView {
    if (view.theme === theme) return view;
    if (isPartyCard(view)) return { ...view, theme };
    if (isLeadersCard(view))
        // Taken again from the seats in that theme, so independents follow it.
        return (
            leadersCardView({
                seats: seatsInTheme(ctx.seats, theme),
                index: ctx.index,
                focus: { level: view.focus.level, code: view.focus.code },
                theme,
                sample: view.sample,
            }) ?? { ...view, theme }
        );
    return withTheme(view, theme, ctx);
}

/** The headline made from the numbers alone. */
export const headlineOf = (view: ShareableView): string =>
    isPartyCard(view)
        ? partyHeadline(view)
        : isLeadersCard(view)
          ? leadersHeadline(view)
          : headlineFor(view);

export const captionOf = (
    view: ShareableView,
    url: string,
    platform: CaptionPlatform,
    headline: string,
): string =>
    isPartyCard(view)
        ? partyCaption(view, url, platform, headline)
        : isLeadersCard(view)
          ? leadersCaption(view, url, platform, headline)
          : captionFor(view, url, platform, headline);

export type ShareLayout = ViewLayout | PartyLayout | LeadersLayout;

export function layoutOf(
    size: ViewSize,
    view: ShareableView,
    text: { headline: string; url: string; mapAspect: number },
): ShareLayout {
    return isPartyCard(view)
        ? partyLayout(size, view, text)
        : isLeadersCard(view)
          ? leadersLayout(size, view, text)
          : viewLayout(size, view, text);
}

/** Where the map goes on the card at this size. */
export const mapBoxOf = (
    size: ViewSize,
    view: ShareableView,
    text: { headline: string; url: string; mapAspect: number },
): Box => layoutOf(size, view, text).map;

/** What the dialog calls a leaders card when it offers it beside the view. */
export const leadersLabel = (card: LeadersCardView): string =>
    card.unit.level === 'county' ? 'County leaders' : 'Leaders';

export const dialogCopy = (view: ShareableView) =>
    isPartyCard(view)
        ? {
              title: 'Share party card',
              description:
                  `The party’s seats ${view.scope ? `in ${view.scope.name}` : 'across Kenya'}, with its numbers, sized for Instagram, stories or X.`,
          }
        : isLeadersCard(view)
          ? {
                title: 'Share leaders card',
                description: `Who represents ${view.unit.name}, with sources, sized for Instagram, stories or X.`,
            }
          : {
                title: 'Share this view',
                description:
                    'The map as it is now, with its numbers, sized for Instagram, stories or X.',
            };
