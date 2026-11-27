// Browser history for the focus: each unit the person chooses is a history entry (so the browser's
// back button and the phone's back gesture step back through what they looked at). A step up (the
// app's Back button, the zoom-out control, or zooming out of the unit) that lands on the entry just
// before this one goes back to it, so Back never walks to the same unit twice and Back from Kenya
// leaves the site. A step up to anywhere else pushes (the person's) or replaces (a zoom's).
//
// A party's profile (`/party/uda`) is another state of the same page: opening it pushes an entry
// that remembers the focus it was opened over, closing it goes back to the entry it was opened
// from, and Back or Forward onto it reopens it over that focus.
import type { FocusSelection } from './focus';
import {
    type PartyScope,
    parsePartyPath,
    parseUnitPath,
    partyPath,
    unitPath,
} from './urls';

/**
 * Why the focus changed:
 * - 'user': the person chose a unit (a tap, a search pick, a link in the panel).
 * - 'up': the person stepped up (the Back button or the zoom-out control).
 * - 'zoom': their zooming out stepped the focus up.
 * - 'close': they closed a party's profile; the focus is the same, so the camera stays.
 */
export type HistoryCause = 'user' | 'up' | 'zoom' | 'close';

/** How a restored focus should reach the camera: a zoom must not snap the camera mid-pinch. */
export interface RestoreOptions {
    fit: boolean;
    /** Set when the entry is a party's profile: its abbreviation in lower case. */
    party?: string;
    /** What the profile's numbers cover (null: all of Kenya); set with `party`. */
    partyScope?: PartyScope;
}

/** What the history needs from the browser, so it can be tested without one. */
export interface FocusHistoryPort {
    /** The address bar's path now. */
    path(): string;
    push(
        path: string,
        focus: FocusSelection | null,
        party?: { abbrev: string; scope: PartyScope },
    ): void;
    replace(
        path: string,
        focus: FocusSelection | null,
        party?: { abbrev: string; scope: PartyScope },
    ): void;
    /** Go back one entry (history.back()). */
    back(): void;
    /** Listen for the browser going back or forward; returns the way to stop listening. */
    onPopState(
        listener: (event: { stopImmediatePropagation(): void }) => void,
    ): () => void;
}

/**
 * The focus an address stands for: null for the home page (and for a party's page, which says
 * nothing about the focus), undefined for a page that is not ours.
 */
export function focusFromPath(path: string): FocusSelection | null | undefined {
    if (path === '/' || parsePartyPath(path)) return null;
    return parseUnitPath(path) ?? undefined;
}

/** The party (lower-case abbreviation) a party page's address names; null for any other path. */
export const partyFromPath = (path: string) => parsePartyPath(path)?.abbrev ?? null;

const pathFor = (focus: FocusSelection | null) =>
    focus ? unitPath(focus.level, focus.code) : '/';

export function createFocusHistory(
    port: FocusHistoryPort,
    /** The browser went back or forward to an entry of ours: show this focus (null: all of Kenya). */
    onRestore: (focus: FocusSelection | null, options: RestoreOptions) => void,
) {
    // This page's own entries (their path and the focus they show) and where we are among them.
    // Kept here, not read back from the address bar: the browser applies a push a moment later,
    // and the entries before `stack[0]` (the page the person came from) are not ours.
    const first = port.path();
    let stack: { path: string; focus: FocusSelection | null }[] = [
        { path: first, focus: focusFromPath(first) ?? null },
    ];
    let at = 0;
    // Backs we asked for that the browser has not answered yet (each answer is not a new choice).
    const pending: RestoreOptions[] = [];

    const stopListening = port.onPopState((event) => {
        const path = port.path();
        const party = parsePartyPath(path);
        let focus = focusFromPath(path);
        if (focus === undefined) return;
        // Inertia would put the page back from its saved copy and rebuild it, and the map with it.
        // (This runs first because the gate is installed before Inertia: see `installPopStateGate`.)
        event.stopImmediatePropagation();
        const asked = pending.shift();
        if (!asked) {
            // Back or forward by the person: one entry either way, else start over from here.
            if (path === stack[at - 1]?.path) at--;
            else if (path === stack[at + 1]?.path) at++;
            else {
                stack = [{ path, focus }];
                at = 0;
            }
        }
        // A profile is shown over the focus it was opened over, which its address does not say.
        if (party) focus = stack[at]?.focus ?? null;
        onRestore(focus, {
            ...(asked ?? { fit: true }),
            ...(party && { party: party.abbrev, partyScope: party.scope }),
        });
        // The entry keeps the page Inertia saved for it; this brings Inertia's own copy in line.
        if (party) port.replace(path, focus, party);
        else port.replace(path, focus);
    });

    return {
        record(focus: FocusSelection | null, cause: HistoryCause) {
            const path = pathFor(focus);
            if (path === stack[at].path) return;
            if (cause !== 'user' && path === stack[at - 1]?.path) {
                at--;
                // Only the person's step up fits the camera to the unit it returns to.
                pending.push({ fit: cause === 'up' });
                port.back();
            } else if (cause === 'zoom') {
                stack[at] = { path, focus };
                port.replace(path, focus);
            } else {
                stack = [...stack.slice(0, at + 1), { path, focus }];
                at++;
                port.push(path, focus);
            }
        },
        /** The person opened a party's profile over `focus`: one entry, which remembers the focus. */
        openParty(
            abbrev: string,
            focus: FocusSelection | null,
            scope: PartyScope = null,
        ) {
            const path = partyPath(abbrev, scope);
            if (path === stack[at].path) return;
            stack = [...stack.slice(0, at + 1), { path, focus }];
            at++;
            port.push(path, focus, { abbrev: abbrev.toLowerCase(), scope });
        },
        /** The profile's scope switch: the same entry, now with the new scope in its address. */
        setPartyScope(
            abbrev: string,
            focus: FocusSelection | null,
            scope: PartyScope,
        ) {
            const path = partyPath(abbrev, scope);
            if (path === stack[at].path) return;
            stack[at] = { path, focus: stack[at].focus ?? focus };
            port.replace(path, stack[at].focus, {
                abbrev: abbrev.toLowerCase(),
                scope,
            });
        },
        /** Where we are among this page's entries (0 is the first: Back from there leaves). */
        get index() {
            return at;
        },
        dispose: stopListening,
    };
}

export type FocusHistory = ReturnType<typeof createFocusHistory>;

type PopStateListener = (event: { stopImmediatePropagation(): void }) => void;

// Inertia listens for popstate as well, and answers by putting the page back from its saved copy,
// which rebuilds it (and the map with it). Listeners on one target run in the order they were
// added, whether or not they capture (checked in Chromium), so a listener added by the page, after
// Inertia started, could never get in first. The gate is added in `app.ts` before Inertia starts
// and hands each popstate to whichever map page is on screen, which can then stop it there.
let gated: PopStateListener | null = null;
const installedOn = new WeakSet<EventTarget>();

/** Add the gate. Call it once, before `createInertiaApp`, so that it runs before Inertia's own. */
export function installPopStateGate(target: EventTarget = window) {
    if (installedOn.has(target)) return;
    installedOn.add(target);
    target.addEventListener('popstate', (event) =>
        gated?.(event as unknown as Parameters<PopStateListener>[0]),
    );
}

/** Take popstate through the gate; returns the way to give it up (a newer page's hold is kept). */
export function gatePopState(listener: PopStateListener): () => void {
    gated = listener;
    return () => {
        if (gated === listener) gated = null;
    };
}
