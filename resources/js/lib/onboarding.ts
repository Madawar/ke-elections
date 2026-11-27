// Onboarding: the first-visit tour, the one-time contextual tips, and the rules that keep them
// apart from each other and from the outside-tap hint. The words live here so the About sheet's
// help and the popovers say the same thing.
//
// Storage: `kem.onboarded.v1` for the tour, `kem.tip.<id>` for each tip. Storage can be blocked,
// so every read and write is guarded and a flag is also kept in memory: when storage fails,
// each thing shows at most once per page load.

export const TOUR_KEY = 'kem.onboarded.v1';

export type TipId = 'unit' | 'party' | 'muted-chip' | 'locate' | 'share-dialog';
export const tipKey = (id: TipId) => `kem.tip.${id}`;

// ---- flags ------------------------------------------------------------------------------
const memory = new Set<string>();

export function isSet(key: string): boolean {
    if (memory.has(key)) return true;
    try {
        return localStorage.getItem(key) === '1';
    } catch {
        return false;
    }
}
export function setFlag(key: string) {
    memory.add(key);
    try {
        localStorage.setItem(key, '1');
    } catch {
        // Blocked storage: the flag lasts until the page closes.
    }
}
function clearFlag(key: string) {
    memory.delete(key);
    try {
        localStorage.removeItem(key);
    } catch {
        // Nothing stored that could be cleared.
    }
}

// ---- who may show now -------------------------------------------------------------------
/** What is on screen or has happened this page load. The popovers and the hint keep it up to date. */
export const state = {
    /** The tour is open. */
    tourActive: false,
    /** The outside-tap hint is open. */
    hintOpen: false,
    /** A contextual tip has already been shown this session. */
    tipShown: false,
    /** The tour has started this page load (it is not started twice by a remount). */
    tourStarted: false,
};

/** For tests: a fresh page load. */
export function resetOnboardingState() {
    memory.clear();
    state.tourActive = false;
    state.hintOpen = false;
    state.tipShown = false;
    state.tourStarted = false;
}

/** The tour starts on its own once, on a first visit. */
export const tourDue = () => !state.tourStarted && !isSet(TOUR_KEY);

/**
 * A tip may show only after the tour is done or skipped, never during it or beside the
 * outside-tap hint, once ever, and one per session.
 */
export function canClaimTip(id: TipId): boolean {
    return (
        !state.tourActive &&
        !state.hintOpen &&
        !state.tipShown &&
        isSet(TOUR_KEY) &&
        !isSet(tipKey(id))
    );
}
/** Take the tip's one showing (true), or find it is not allowed now (false; nothing is used up). */
export function claimTip(id: TipId): boolean {
    if (!canClaimTip(id)) return false;
    state.tipShown = true;
    setFlag(tipKey(id));
    return true;
}
const TIP_IDS: TipId[] = [
    'unit',
    'party',
    'muted-chip',
    'locate',
    'share-dialog',
];
/** "Show tips again": every tip may show once more (one per session, after the tour). */
export function clearTips() {
    for (const id of TIP_IDS) clearFlag(tipKey(id));
    state.tipShown = false;
}
/** "Show tips again": the tour runs from its first step. */
export function clearTour() {
    clearFlag(TOUR_KEY);
    state.tourStarted = false;
    clearTips();
}

// ---- words ------------------------------------------------------------------------------
export type Side = 'above' | 'below' | 'left' | 'right';

export interface TourStep {
    id: 'search' | 'map' | 'seat-chips' | 'legend' | 'locate' | 'share';
    /** The About sheet's name for the step. */
    label: string;
    /** `data-onboarding` values to point at; the first one on screen is used. */
    anchors: string[];
    /** Point at the middle of the visible map instead of at the element. */
    centre?: boolean;
    /** Sides the popover may sit on, best first. */
    sides: Side[];
    text: string;
    /** An optional second line. */
    detail?: string;
    /** Used when no anchor is on screen but the step is still worth saying. */
    fallback?: { anchors: string[]; text: string };
}

// The locate step's detail line says only what the code does: the coordinates are read by the
// browser, compared with the ward shapes in this page (a static file fetched without them) and
// dropped; they are never sent. The ward found does become the page address (/ward/N), which
// reaches the server on a reload or a share, so the line says so. tests/js/components/
// Onboarding.test.ts guards the first half against the page's own code.
export const TOUR_STEPS: TourStep[] = [
    {
        id: 'search',
        label: 'Search',
        anchors: ['search'],
        sides: ['below', 'above'],
        text: 'Find any county, constituency, ward, politician or party by name.',
    },
    {
        id: 'map',
        label: 'The map',
        anchors: ['map'],
        centre: true,
        sides: ['above', 'below'],
        text: 'Tap a county, then tap again to go deeper. Use Back to step out.',
    },
    {
        id: 'seat-chips',
        label: 'Seat colours',
        anchors: ['seat-chips'],
        sides: ['below', 'above'],
        text: 'Colour the map by who holds each seat: Governor, Senator, Woman Rep, MP or MCA.',
    },
    {
        id: 'legend',
        label: 'Legend',
        anchors: ['legend'],
        sides: ['above', 'right', 'below'],
        text: 'Tap a party to show only its seats. Tap more than one to compare.',
        // Nothing is coloured yet on a first visit, so there is no legend to point at.
        fallback: {
            anchors: ['seat-chips'],
            text: 'Pick a seat above and a legend appears. Tap a party in it to show only its seats, or tap more than one to compare.',
        },
    },
    {
        id: 'locate',
        label: 'Find my ward',
        anchors: ['locate'],
        sides: ['left', 'above'],
        text: "See the ward you're in.",
        detail: 'Your exact position is checked on this device and never sent. The page address then shows your ward.',
    },
    {
        id: 'share',
        label: 'Share',
        anchors: ['share-view'],
        sides: ['below', 'above', 'left'],
        text: 'Share what you see as an image for WhatsApp, Instagram, TikTok or X.',
        fallback: {
            anchors: ['seat-chips'],
            text: 'Colour the map, then Share this view makes an image for WhatsApp, Instagram, TikTok or X.',
        },
    },
];

export type LocateReason = 'denied' | 'failed' | 'unsupported';
/** A plain line that says what to do next, and never blames the person. */
export function locateTipText(reason: LocateReason): string {
    if (reason === 'denied')
        return 'Location is off for this site. You can still search for your ward.';
    if (reason === 'unsupported')
        return 'This device cannot share its location. You can still search for your ward.';
    return 'Your location could not be found just now. You can still search for your ward.';
}

export interface TipContext {
    /** The party's name as the legend shows it. */
    party?: string;
    /** The county the chips lead back to. */
    county?: string;
    reason?: LocateReason;
}
export interface Tip {
    /** `data-onboarding` values to point at; the first one on screen is used. */
    anchors: string[];
    sides: Side[];
    text: (ctx: TipContext) => string;
}
export const TIPS: Record<TipId, Tip> = {
    unit: {
        anchors: ['share-view'],
        sides: ['below', 'above', 'left'],
        text: () =>
            'Share this view makes an image of exactly this. Sources included.',
    },
    party: {
        // "Show all" is what the tip is about; it sits under the rows, so the highlighted row stays clear.
        anchors: ['legend-clear', 'legend'],
        sides: ['above', 'right', 'below'],
        text: ({ party }) =>
            `Showing only ${party ?? 'this party'}. Tap again or Show all to clear.`,
    },
    'muted-chip': {
        anchors: ['seat-chips'],
        sides: ['below', 'above'],
        text: ({ county }) =>
            `Governor, Senator and Woman Rep cover the whole county. Tap one to go back to ${county ?? 'the county'}.`,
    },
    locate: {
        anchors: ['locate'],
        sides: ['left', 'above'],
        text: ({ reason }) => locateTipText(reason ?? 'failed'),
    },
    'share-dialog': {
        // Shown inside the dialog itself (see ShareViewDialog), not as a popover.
        anchors: [],
        sides: [],
        text: () =>
            'Pick a size: square for feeds, story for TikTok and Reels, wide for X.',
    },
};

// ---- finding the control ----------------------------------------------------------------
/** Is the element on screen, and not scrolled out of (or clipped by) a scrolling parent? */
export function isVisible(el: Element): boolean {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight)
        return false;
    for (
        let p = el.parentElement;
        p && p !== document.body;
        p = p.parentElement
    ) {
        const style = getComputedStyle(p);
        if (style.overflowX === 'visible' && style.overflowY === 'visible')
            continue;
        const pr = p.getBoundingClientRect();
        if (cx < pr.left || cx > pr.right || cy < pr.top || cy > pr.bottom)
            return false;
    }
    return true;
}
/** The first control with one of these names that is on screen at this size, or null. */
export function resolveAnchor(
    names: string[],
    root: ParentNode = document,
): HTMLElement | null {
    for (const name of names)
        for (const el of root.querySelectorAll<HTMLElement>(
            `[data-onboarding="${name}"]`,
        ))
            if (isVisible(el)) return el;
    return null;
}

// ---- placing the popover ----------------------------------------------------------------
export interface Box {
    left: number;
    top: number;
    width: number;
    height: number;
}
export interface Placement {
    left: number;
    top: number;
    side: Side;
    /** It sits clear of the anchor and of everything it was told to avoid. */
    clear: boolean;
    /** Where the pointer sits along the popover's edge, from its left (above/below) or top (left/right). */
    arrow: number;
}
/** The gap that holds the pointer between the popover and its control. */
export const POINTER_GAP = 10;
const MARGIN = 12;
const ARROW_INSET = 16;

const overlaps = (a: Box, b: Box) =>
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top;
const clamp = (v: number, lo: number, hi: number) =>
    Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Where a popover of `size` sits beside `anchor`: the first of `prefer` (then the other sides)
 * that fits on screen without covering the anchor or anything in `avoid`; failing that, the
 * first that fits on screen; failing that, the first, pushed back inside the screen.
 */
export function placePopover({
    anchor,
    size,
    viewport,
    prefer,
    avoid = [],
    minLeft = MARGIN,
}: {
    anchor: Box;
    size: { width: number; height: number };
    viewport: { width: number; height: number };
    prefer: Side[];
    avoid?: Box[];
    /** The left edge it may not cross (a side panel's right edge, plus a margin). */
    minLeft?: number;
}): Placement {
    const { width: w, height: h } = size;
    const cx = anchor.left + anchor.width / 2;
    const cy = anchor.top + anchor.height / 2;
    const maxLeft = viewport.width - MARGIN - w;
    const maxTop = viewport.height - MARGIN - h;

    const at = (side: Side) => {
        let left: number;
        let top: number;
        let fits: boolean;
        if (side === 'below' || side === 'above') {
            left = clamp(cx - w / 2, minLeft, maxLeft);
            top =
                side === 'below'
                    ? anchor.top + anchor.height + POINTER_GAP
                    : anchor.top - POINTER_GAP - h;
            fits = top >= MARGIN && top <= maxTop;
        } else {
            top = clamp(cy - h / 2, MARGIN, maxTop);
            left =
                side === 'right'
                    ? anchor.left + anchor.width + POINTER_GAP
                    : anchor.left - POINTER_GAP - w;
            fits = left >= minLeft && left <= maxLeft;
        }
        const box = { left, top, width: w, height: h };
        const clear =
            fits &&
            !overlaps(box, anchor) &&
            !avoid.some((a) => overlaps(box, a));
        return { side, left, top, fits, clear };
    };

    const order = [
        ...prefer,
        ...(['below', 'above', 'left', 'right'] as Side[]).filter(
            (s) => !prefer.includes(s),
        ),
    ];
    const tries = order.map(at);
    const pick =
        tries.find((t) => t.clear) ??
        tries.find(
            (t) =>
                t.fits &&
                !overlaps(
                    { left: t.left, top: t.top, width: w, height: h },
                    anchor,
                ),
        ) ??
        tries[0];

    const vertical = pick.side === 'below' || pick.side === 'above';
    const arrow = vertical
        ? clamp(cx - pick.left, ARROW_INSET, w - ARROW_INSET)
        : clamp(cy - pick.top, ARROW_INSET, h - ARROW_INSET);
    return {
        side: pick.side,
        left: clamp(pick.left, minLeft, maxLeft),
        top: clamp(pick.top, MARGIN, maxTop),
        arrow,
        clear: pick.clear,
    };
}
