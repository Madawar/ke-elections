import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type FocusHistoryPort,
    createFocusHistory,
    focusFromPath,
    gatePopState,
    installPopStateGate,
} from '@/lib/map/history';

/**
 * A fake browser history: entries and a position, so back, forward and "leaving the site" behave.
 * `calls` records what the controller asked for; `pop` plays a popstate to any entry.
 */
function fakePort(start = '/') {
    const entries = [start];
    let at = 0;
    let listener: ((e: { stopImmediatePropagation(): void }) => void) | null =
        null;
    const calls: string[] = [];
    const stop = vi.fn();
    const fire = () => listener?.({ stopImmediatePropagation: stop });
    const port: FocusHistoryPort = {
        path: () => entries[at],
        push: (p) => {
            entries.splice(at + 1);
            entries.push(p);
            at++;
            calls.push(`push ${p}`);
        },
        replace: (p) => {
            entries[at] = p;
            calls.push(`replace ${p}`);
        },
        back: () => {
            calls.push('back');
            if (at === 0) return; // nothing before: the browser leaves the site
            at--;
            fire();
        },
        onPopState: (cb) => {
            listener = cb;
            return () => (listener = null);
        },
    };
    return {
        port,
        calls,
        stop,
        entries,
        position: () => at,
        /** The browser went back or forward to the entry at `to`. */
        go(to: number) {
            at = to;
            fire();
        },
        /** The browser went to a path that is in no entry we made. */
        pop(path: string) {
            entries[at] = path;
            fire();
        },
        listening: () => listener !== null,
    };
}

describe('focusFromPath', () => {
    it('reads the focus from the unit URLs, and the home page as nothing', () => {
        expect(focusFromPath('/')).toBeNull();
        expect(focusFromPath('/county/47')).toEqual({
            level: 'county',
            code: 47,
        });
        expect(focusFromPath('/constituency/280/')).toEqual({
            level: 'constituency',
            code: 280,
        });
        expect(focusFromPath('/ward/1')).toEqual({ level: 'ward', code: 1 });
    });

    it('leaves any other page alone', () => {
        expect(focusFromPath('/dashboard')).toBeUndefined();
        expect(focusFromPath('/county/0')).toBeUndefined();
        expect(focusFromPath('/settings/profile')).toBeUndefined();
    });
});

describe('createFocusHistory', () => {
    let f: ReturnType<typeof fakePort>;
    const restore = vi.fn();
    beforeEach(() => {
        restore.mockClear();
        f = fakePort('/');
    });

    it('pushes an entry for each focus the person chooses', () => {
        const h = createFocusHistory(f.port, restore);
        h.record({ level: 'county', code: 47 }, 'user');
        h.record({ level: 'constituency', code: 280 }, 'user');
        h.record({ level: 'ward', code: 1 }, 'user');
        expect(f.calls).toEqual([
            'push /county/47',
            'push /constituency/280',
            'push /ward/1',
        ]);
    });

    it('replaces the current entry for a zoom-driven step up to a unit that is not the previous entry', () => {
        const h = createFocusHistory(f.port, restore);
        h.record({ level: 'county', code: 47 }, 'user');
        h.record({ level: 'ward', code: 1 }, 'user');
        h.record({ level: 'constituency', code: 280 }, 'zoom');
        expect(f.calls).toEqual([
            'push /county/47',
            'push /ward/1',
            'replace /constituency/280',
        ]);
    });

    it('pushes a step up by the person when the target is not the previous entry (a deep link never exits)', () => {
        f = fakePort('/constituency/290');
        const h = createFocusHistory(f.port, restore);
        h.record({ level: 'county', code: 47 }, 'up');
        expect(f.calls).toEqual(['push /county/47']);
    });

    describe('a step up to the previous entry goes back instead of adding one', () => {
        const nairobi = { level: 'county' as const, code: 47 };
        const mathare = { level: 'constituency' as const, code: 290 };
        let h: ReturnType<typeof createFocusHistory>;
        beforeEach(() => {
            h = createFocusHistory(f.port, restore);
            h.record(nairobi, 'user');
            h.record(mathare, 'user');
            f.calls.length = 0;
            restore.mockClear();
        });

        it('walks down, then the app Back, then the browser Back to Kenya, then leaves the site', () => {
            h.record(nairobi, 'up');
            expect(f.calls).toEqual(['back', 'replace /county/47']);
            expect(f.entries).toEqual(['/', '/county/47', '/constituency/290']);
            expect(f.position()).toBe(1);
            f.calls.length = 0;
            f.go(0); // the phone's Back
            expect(restore).toHaveBeenLastCalledWith(null, { fit: true });
            expect(f.position()).toBe(0);
            // Kenya is entry 0: one more Back leaves the site, and nothing was pushed on the way.
            expect(f.calls).toEqual(['replace /']);
            expect(f.entries[0]).toBe('/');
        });

        it('restores with fit: true for the person’s step up and fit: false for a zoom', () => {
            h.record(nairobi, 'zoom');
            expect(restore).toHaveBeenCalledWith(nairobi, { fit: false });
            h.record(null, 'up');
            expect(restore).toHaveBeenLastCalledWith(null, { fit: true });
            expect(f.position()).toBe(0);
        });

        it('does not go back twice for two step ups before the browser has answered', () => {
            const slow = fakePort('/');
            let answer = () => {};
            slow.port.back = () => {
                slow.calls.push('back');
                answer = () => slow.go(slow.position() - 1);
            };
            const hh = createFocusHistory(slow.port, restore);
            hh.record(nairobi, 'user');
            hh.record(mathare, 'user');
            hh.record(nairobi, 'zoom');
            hh.record(nairobi, 'zoom');
            expect(slow.calls.filter((c) => c === 'back')).toHaveLength(1);
            answer();
        });

        it('forward after back restores the entry we came from', () => {
            h.record(nairobi, 'up');
            f.go(2); // forward
            expect(restore).toHaveBeenLastCalledWith(mathare, { fit: true });
            expect(f.position()).toBe(2);
            // From there a step up goes back once more rather than pushing.
            f.calls.length = 0;
            h.record(nairobi, 'up');
            expect(f.calls[0]).toBe('back');
        });

        it('a new choice after going back drops the entries ahead', () => {
            h.record(nairobi, 'up');
            h.record({ level: 'constituency', code: 1 }, 'user');
            expect(f.entries).toEqual(['/', '/county/47', '/constituency/1']);
        });
    });

    it('does not add an entry when the address already shows that focus', () => {
        f = fakePort('/county/47');
        const h = createFocusHistory(f.port, restore);
        h.record({ level: 'county', code: 47 }, 'user');
        h.record({ level: 'county', code: 47 }, 'zoom');
        expect(f.calls).toEqual([]);
    });

    it('pushes the home page when the focus is cleared by the person', () => {
        f = fakePort('/county/47');
        const h = createFocusHistory(f.port, restore);
        h.record(null, 'user');
        expect(f.calls).toEqual(['push /']);
    });

    it('restores the focus of the entry the browser went to, and keeps Inertia from remounting', () => {
        const h = createFocusHistory(f.port, restore);
        h.record({ level: 'county', code: 47 }, 'user');
        h.record({ level: 'constituency', code: 280 }, 'user');
        f.calls.length = 0;
        f.pop('/county/47');
        expect(restore).toHaveBeenCalledWith(
            { level: 'county', code: 47 },
            { fit: true },
        );
        expect(f.stop).toHaveBeenCalledTimes(1);
        // The entry is re-recorded in place (not pushed) so Inertia's own page matches it.
        expect(f.calls).toEqual(['replace /county/47']);
        f.pop('/');
        expect(restore).toHaveBeenLastCalledWith(null, { fit: true });
    });

    it('does not push when the restored focus is recorded again', () => {
        const h = createFocusHistory(f.port, restore);
        h.record({ level: 'county', code: 47 }, 'user');
        f.pop('/');
        f.calls.length = 0;
        h.record(null, 'user');
        expect(f.calls).toEqual([]);
    });

    it('leaves popstate to Inertia for a page that is not the map', () => {
        createFocusHistory(f.port, restore);
        f.pop('/dashboard');
        expect(restore).not.toHaveBeenCalled();
        expect(f.stop).not.toHaveBeenCalled();
    });

    it('stops listening when disposed', () => {
        const h = createFocusHistory(f.port, restore);
        expect(f.listening()).toBe(true);
        h.dispose();
        expect(f.listening()).toBe(false);
    });
});

describe('the popstate gate', () => {
    // Inertia listens to popstate too, and handles it by rebuilding the page. Listeners on one
    // target run in the order they were added (capture or not), so ours has to be added first.
    it('runs the page’s listener before a listener added after it, and can keep that one from running', () => {
        const target = new EventTarget();
        installPopStateGate(target);
        const later = vi.fn();
        target.addEventListener('popstate', later);
        const page = vi.fn((e: { stopImmediatePropagation(): void }) =>
            e.stopImmediatePropagation(),
        );
        const release = gatePopState(page);
        target.dispatchEvent(new Event('popstate'));
        expect(page).toHaveBeenCalledTimes(1);
        expect(later).not.toHaveBeenCalled();
        release();
        target.dispatchEvent(new Event('popstate'));
        expect(later).toHaveBeenCalledTimes(1);
    });

    it('lets the event through when the page does not stop it', () => {
        const target = new EventTarget();
        installPopStateGate(target);
        const later = vi.fn();
        target.addEventListener('popstate', later);
        const release = gatePopState(() => {});
        target.dispatchEvent(new Event('popstate'));
        expect(later).toHaveBeenCalledTimes(1);
        release();
    });

    it('installs once per target', () => {
        const target = new EventTarget();
        installPopStateGate(target);
        installPopStateGate(target);
        const page = vi.fn();
        const release = gatePopState(page);
        target.dispatchEvent(new Event('popstate'));
        expect(page).toHaveBeenCalledTimes(1);
        release();
    });

    it('releasing an old page does not remove the one that replaced it', () => {
        const target = new EventTarget();
        installPopStateGate(target);
        const first = vi.fn();
        const second = vi.fn();
        const releaseFirst = gatePopState(first);
        const releaseSecond = gatePopState(second);
        releaseFirst();
        target.dispatchEvent(new Event('popstate'));
        expect(second).toHaveBeenCalledTimes(1);
        expect(first).not.toHaveBeenCalled();
        releaseSecond();
    });
});
