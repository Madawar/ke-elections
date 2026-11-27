import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    TIPS,
    TOUR_KEY,
    TOUR_STEPS,
    canClaimTip,
    claimTip,
    clearTips,
    isSet,
    locateTipText,
    placePopover,
    resetOnboardingState,
    setFlag,
    state,
    tipKey,
} from '@/lib/onboarding';

beforeEach(() => {
    localStorage.clear();
    resetOnboardingState();
});
afterEach(() => vi.restoreAllMocks());

describe('the tour steps', () => {
    it('are six, in the owner’s order, each pointing at a real control', () => {
        expect(TOUR_STEPS.map((s) => s.id)).toEqual([
            'search',
            'map',
            'seat-chips',
            'legend',
            'locate',
            'share',
        ]);
        expect(TOUR_STEPS.map((s) => s.anchors[0])).toEqual([
            'search',
            'map',
            'seat-chips',
            'legend',
            'locate',
            'share-view',
        ]);
    });

    it('use the owner’s words', () => {
        const text = TOUR_STEPS.map((s) => s.text);
        expect(text[0]).toBe(
            'Find any county, constituency, ward, politician or party by name.',
        );
        expect(text[1]).toBe(
            'Tap a county, then tap again to go deeper. Use Back to step out.',
        );
        expect(text[2]).toBe(
            'Colour the map by who holds each seat: Governor, Senator, Woman Rep, MP or MCA.',
        );
        expect(text[3]).toBe(
            'Tap a party to show only its seats. Tap more than one to compare.',
        );
        expect(text[4]).toBe("See the ward you're in.");
        expect(text[5]).toBe(
            'Share what you see as an image for WhatsApp, Instagram, TikTok or X.',
        );
    });

    it('keep to the copy rules: no arrows, emoji or all-caps lead-ins', () => {
        const all = [
            ...TOUR_STEPS.flatMap((s) => [
                s.text,
                s.detail ?? '',
                s.fallback?.text ?? '',
            ]),
            ...Object.values(TIPS).map((t) =>
                t.text({ party: 'UDA', county: 'Kisumu', reason: 'denied' }),
            ),
        ];
        for (const line of all) {
            expect(line).not.toMatch(/→|·|\p{Extended_Pictographic}/u);
            expect(line).not.toMatch(/\b[A-Z]{6,}\b/);
        }
    });
});

describe('the flags', () => {
    it('are read and written under the owner’s keys', () => {
        expect(isSet(TOUR_KEY)).toBe(false);
        setFlag(TOUR_KEY);
        expect(isSet(TOUR_KEY)).toBe(true);
        expect(localStorage.getItem('kem.onboarded.v1')).toBe('1');
        expect(tipKey('unit')).toBe('kem.tip.unit');
    });

    it('survive a storage that throws: remembered until the page closes', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(isSet(TOUR_KEY)).toBe(false);
        expect(() => setFlag(TOUR_KEY)).not.toThrow();
        expect(isSet(TOUR_KEY)).toBe(true);
    });
});

describe('contextual tips', () => {
    const toured = () => setFlag(TOUR_KEY);

    it('wait until the tour is done or skipped', () => {
        expect(canClaimTip('unit')).toBe(false);
        toured();
        expect(canClaimTip('unit')).toBe(true);
    });

    it('never show during the tour or beside the outside-tap hint', () => {
        toured();
        state.tourActive = true;
        expect(claimTip('unit')).toBe(false);
        state.tourActive = false;
        state.hintOpen = true;
        expect(claimTip('unit')).toBe(false);
        state.hintOpen = false;
        expect(claimTip('unit')).toBe(true);
    });

    it('are claimed once ever, and one per session', () => {
        toured();
        expect(claimTip('unit')).toBe(true);
        expect(localStorage.getItem('kem.tip.unit')).toBe('1');
        // Another tip in the same session is held back, and not used up.
        expect(claimTip('party')).toBe(false);
        expect(localStorage.getItem('kem.tip.party')).toBeNull();
        // A new session: the held tip may show, the shown one may not.
        state.tipShown = false;
        expect(claimTip('unit')).toBe(false);
        expect(claimTip('party')).toBe(true);
    });

    it('with storage failing show once per page load', () => {
        toured();
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(claimTip('share-dialog')).toBe(true);
        state.tipShown = false;
        expect(claimTip('share-dialog')).toBe(false);
    });

    it('come back after "Show tips again"', () => {
        toured();
        claimTip('unit');
        clearTips();
        expect(isSet(tipKey('unit'))).toBe(false);
        expect(claimTip('unit')).toBe(true);
    });

    it('say what the owner asked', () => {
        const ctx = {
            party: 'UDA',
            county: 'Kisumu',
            reason: 'denied',
        } as const;
        expect(TIPS.unit.text(ctx)).toBe(
            'Share this view makes an image of exactly this. Sources included.',
        );
        expect(TIPS.party.text(ctx)).toBe(
            'Showing only UDA. Tap again or Show all to clear.',
        );
        expect(TIPS['muted-chip'].text(ctx)).toBe(
            'Governor, Senator and Woman Rep cover the whole county. Tap one to go back to Kisumu.',
        );
        expect(TIPS['share-dialog'].text(ctx)).toBe(
            'Pick a size: square for feeds, story for TikTok and Reels, wide for X.',
        );
        expect(locateTipText('denied')).toBe(
            'Location is off for this site. You can still search for your ward.',
        );
        expect(locateTipText('failed')).not.toMatch(
            /denied|blocked|refused|failed|error/i,
        );
    });
});

describe('placePopover', () => {
    const viewport = { width: 390, height: 844 };
    const size = { width: 300, height: 120 };
    const rect = (
        left: number,
        top: number,
        width: number,
        height: number,
    ) => ({
        left,
        top,
        width,
        height,
    });

    it('goes below a control at the top, pointing at its centre', () => {
        const p = placePopover({
            anchor: rect(12, 12, 280, 44),
            size,
            viewport,
            prefer: ['below', 'above'],
        });
        expect(p.side).toBe('below');
        expect(p.top).toBeGreaterThanOrEqual(56);
        expect(p.left).toBe(12);
        // The pointer sits over the anchor's centre (152) within the card.
        expect(p.left + p.arrow).toBeCloseTo(152, 0);
    });

    it('never covers the control it describes', () => {
        const anchor = rect(330, 700, 44, 44);
        const p = placePopover({
            anchor,
            size,
            viewport,
            prefer: ['left', 'above'],
        });
        const overlap =
            p.left < anchor.left + anchor.width &&
            p.left + size.width > anchor.left &&
            p.top < anchor.top + anchor.height &&
            p.top + size.height > anchor.top;
        expect(overlap).toBe(false);
        expect(p.side).toBe('left');
    });

    it('flips to the other side when its first choice does not fit', () => {
        const p = placePopover({
            anchor: rect(12, 780, 100, 44),
            size,
            viewport,
            prefer: ['below', 'above'],
        });
        expect(p.side).toBe('above');
    });

    it('stays inside the screen', () => {
        const p = placePopover({
            anchor: rect(340, 12, 44, 44),
            size,
            viewport,
            prefer: ['below'],
        });
        expect(p.left + size.width).toBeLessThanOrEqual(viewport.width - 12);
        expect(p.left).toBeGreaterThanOrEqual(12);
    });

    it('keeps off the area it is told to avoid, when another side is free', () => {
        const avoid = [rect(0, 0, 390, 400)];
        const p = placePopover({
            anchor: rect(150, 420, 100, 44),
            size,
            viewport,
            prefer: ['above', 'below'],
            avoid,
        });
        expect(p.side).toBe('below');
    });

    it('says so when no side is clear of what it must avoid', () => {
        const p = placePopover({
            anchor: rect(150, 420, 100, 44),
            size,
            viewport,
            prefer: ['above', 'below'],
            avoid: [rect(0, 0, 390, 844)],
        });
        expect(p.clear).toBe(false);
    });
});
