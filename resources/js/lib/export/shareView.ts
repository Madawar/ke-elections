// What the share dialog shows: either a seat view ("Share this view") or a party card. The dialog
// is one component for both; everything that differs between them is looked up here.
import { captionFor, partyCaption, type CaptionPlatform } from './caption';
import { type PartyCardView, partyHeadline } from './partyCard';
import { type PartyLayout, partyLayout } from './partyLayout';
import type { ViewSize } from './sizes';
import type { Box } from './layout';
import { type ViewLayout, viewLayout } from './viewLayout';
import { type ViewState, headlineFor, withTheme } from './viewState';
import type { ThemeName } from '@/lib/map/theme';
import type { SeatsData } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';

export type ShareableView = ViewState | PartyCardView;

export const isPartyCard = (v: ShareableView): v is PartyCardView =>
    v.kind === 'partyCard';

/** The same card in another theme. */
export function inTheme(
    view: ShareableView,
    theme: ThemeName,
    ctx: { seats: SeatsData; index: UnitIndex },
): ShareableView {
    return isPartyCard(view)
        ? view.theme === theme
            ? view
            : { ...view, theme }
        : withTheme(view, theme, ctx);
}

/** The headline made from the numbers alone. */
export const headlineOf = (view: ShareableView): string =>
    isPartyCard(view) ? partyHeadline(view) : headlineFor(view);

export const captionOf = (
    view: ShareableView,
    url: string,
    platform: CaptionPlatform,
    headline: string,
): string =>
    isPartyCard(view)
        ? partyCaption(view, url, platform, headline)
        : captionFor(view, url, platform, headline);

export type ShareLayout = ViewLayout | PartyLayout;

export function layoutOf(
    size: ViewSize,
    view: ShareableView,
    text: { headline: string; url: string; mapAspect: number },
): ShareLayout {
    return isPartyCard(view)
        ? partyLayout(size, view, text)
        : viewLayout(size, view, text);
}

/** Where the map goes on the card at this size. */
export const mapBoxOf = (
    size: ViewSize,
    view: ShareableView,
    text: { headline: string; url: string; mapAspect: number },
): Box => layoutOf(size, view, text).map;

export const dialogCopy = (view: ShareableView) =>
    isPartyCard(view)
        ? {
              title: 'Share party card',
              description:
                  `The party’s seats ${view.scope ? `in ${view.scope.name}` : 'across Kenya'}, with its numbers, sized for Instagram, stories or X.`,
          }
        : {
              title: 'Share this view',
              description:
                  'The map as it is now, with its numbers, sized for Instagram, stories or X.',
          };
