import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type FocusHistoryPort,
    createFocusHistory,
    focusFromPath,
    gatePopState,
    installPopStateGate,
} from '@/lib/map/history';

/** A fake browser history: the port records what is asked, and `pop` plays a popstate. */
function fakePort(start = '/') {
    let path = start;
    let listener: ((e: { stopImmediatePropagation(): void }) => void) | null =
        null;
    const calls: string[] = [];
    const port: FocusHistoryPort = {
        path: () => path,
        push: (p) => {
            path = p;
            calls.push(`push ${p}`);
        },
        replace: (p) => {
            path = p;
            calls.push(`replace ${p}`);
        },
        onPopState: (cb) => {
            listener = cb;
            return () => (listener = null);
        },
    };
    const stop = vi.fn();
    return {
        port,
        calls,
        stop,
        /** The browser went to `to` (back or forward). */
        pop(to: string) {
            path = to;
            listener?.({ stopImmediatePropagation: stop });
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

    it('replaces the current entry for a zoom-driven step up', () => {
        const h = createFocusHistory(f.port, restore);
        h.record({ level: 'county', code: 47 }, 'user');
        h.record({ level: 'constituency', code: 280 }, 'user');
        h.record({ level: 'county', code: 47 }, 'zoom');
        h.record(null, 'zoom');
        expect(f.calls).toEqual([
            'push /county/47',
            'push /constituency/280',
            'replace /county/47',
            'replace /',
        ]);
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
        expect(restore).toHaveBeenCalledWith({ level: 'county', code: 47 });
        expect(f.stop).toHaveBeenCalledTimes(1);
        // The entry is re-recorded in place (not pushed) so Inertia's own page matches it.
        expect(f.calls).toEqual(['replace /county/47']);
        f.pop('/');
        expect(restore).toHaveBeenLastCalledWith(null);
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
