import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LeadersStrip from '@/components/map/LeadersStrip.vue';
import { leadersFor } from '@/lib/leaders';
import { SEAT_COLOURS } from '@/lib/map/theme';
import { LEADERS_SEATS, leadersIndex } from '../leadersFixtures';

const rowsAt = (l: 'county' | 'constituency' | 'ward', c: number) =>
    leadersFor(leadersIndex.get(l, c)!, LEADERS_SEATS, leadersIndex);
const ward = rowsAt('ward', 1448);

/** happy-dom has no layout: say whether the screen is desktop-wide. */
function screen(desktop: boolean) {
    window.matchMedia = ((q: string) => ({
        matches: desktop && q.includes('min-width'),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
    })) as never;
}
const mountStrip = (rows = ward) =>
    mount(LeadersStrip, { props: { rows } });
const toggle = (w: ReturnType<typeof mountStrip>) =>
    w.get('button[aria-expanded]');
/** A row's cells, in order: seat, then name, then party (happy-dom joins text without spaces). */
const cells = (row: ReturnType<ReturnType<typeof mountStrip>['get']>) =>
    [...row.element.children]
        .map((c) => (c.textContent ?? '').trim())
        .filter(Boolean);
const background = (el: Element) =>
    (el as HTMLElement).style.background.toLowerCase();

describe('LeadersStrip ("Leaders here")', () => {
    beforeEach(() => {
        localStorage.clear();
        screen(true);
    });
    afterEach(() => vi.restoreAllMocks());

    it('is titled "Leaders here" and lists each leader: seat, name and party chip', () => {
        const w = mountStrip();
        expect(toggle(w).text()).toContain('Leaders here');
        const rows = w.findAll('[data-leader]');
        expect(rows.map((r) => r.attributes('data-leader'))).toEqual([
            'mca',
            'mp',
            'governor',
            'senator',
            'woman_rep',
        ]);
        const text = rows.map(cells);
        expect(text[0]).toEqual(['MCA', 'Placeholder mca 1448', 'ODM']);
        expect(text[1]).toEqual(['MP', 'Placeholder mp 290', 'ODM']);
        expect(text[2]).toEqual(['Governor', 'Placeholder governor 47', 'UDA']);
        expect(text[4]).toEqual([
            'Woman Rep',
            'Placeholder woman_rep 47',
            'ODM',
        ]);
    });

    it('marks each row with its seat’s ballot colour and the party’s colour on the chip', () => {
        const w = mountStrip();
        const governor = w.get('[data-leader="governor"]');
        expect(background(governor.get('[data-lid]').element)).toBe(
            SEAT_COLOURS.governor.toLowerCase(),
        );
        expect(background(governor.get('[data-chip]').element)).toBe('#e8c547');
        expect(
            background(w.get('[data-leader="mca"] [data-lid]').element),
        ).toBe(SEAT_COLOURS.mca.toLowerCase());
    });

    it('says "No approved data yet" for a seat with no holder, with nothing to press', () => {
        const w = mountStrip(rowsAt('county', 3));
        const senator = w.get('[data-leader="senator"]');
        expect(cells(senator)).toEqual(['Senator', 'No approved data yet']);
        expect(senator.find('button').exists()).toBe(false);
    });

    it('makes only the name a 44px target, and says who was picked', async () => {
        const w = mountStrip();
        const name = w.get('[data-leader="governor"] button');
        expect(name.text()).toBe('Placeholder governor 47');
        expect(name.classes()).toContain('min-h-11');
        expect(name.attributes('aria-label')).toBe(
            'Placeholder governor 47, Governor: show in the panel',
        );
        await name.trigger('click');
        expect(w.emitted('pick')?.[0]).toEqual([ward[2]]);
        // The row itself is dense: no 44px height on it.
        expect(w.get('[data-leader="governor"]').classes()).not.toContain(
            'min-h-11',
        );
    });

    it('is open on desktop and one line on a phone by default', () => {
        expect(toggle(mountStrip()).attributes('aria-expanded')).toBe('true');
        screen(false);
        const phone = mountStrip();
        expect(toggle(phone).attributes('aria-expanded')).toBe('false');
        expect(phone.findAll('[data-leader]')).toHaveLength(0);
        expect(toggle(phone).text()).toContain('Leaders here (5)');
    });

    it('collapses to "Leaders here (n)" and remembers it for the next visit', async () => {
        const w = mountStrip();
        await toggle(w).trigger('click');
        expect(toggle(w).attributes('aria-expanded')).toBe('false');
        expect(toggle(w).text()).toContain('Leaders here (5)');
        expect(w.findAll('[data-leader]')).toHaveLength(0);
        expect(localStorage.getItem('kem.leadersOpen')).toBe('false');
        // The next visit starts collapsed, even on desktop.
        expect(toggle(mountStrip()).attributes('aria-expanded')).toBe('false');
        // ... and opening it on a phone is remembered too.
        screen(false);
        const phone = mountStrip();
        await toggle(phone).trigger('click');
        expect(localStorage.getItem('kem.leadersOpen')).toBe('true');
        expect(toggle(mountStrip()).attributes('aria-expanded')).toBe('true');
    });

    it('still opens and closes when storage is blocked', async () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const w = mountStrip();
        expect(toggle(w).attributes('aria-expanded')).toBe('true');
        await toggle(w).trigger('click');
        expect(toggle(w).attributes('aria-expanded')).toBe('false');
    });

    it('follows the rows it is given: stepping up drops the finer seats', async () => {
        const w = mountStrip();
        await w.setProps({ rows: rowsAt('constituency', 290) });
        expect(
            w.findAll('[data-leader]').map((r) => r.attributes('data-leader')),
        ).toEqual(['mp', 'governor', 'senator', 'woman_rep']);
        await w.setProps({ rows: rowsAt('county', 47) });
        expect(
            w.findAll('[data-leader]').map((r) => r.attributes('data-leader')),
        ).toEqual(['governor', 'senator', 'woman_rep']);
    });

    it('draws nothing when there is nobody to list', () => {
        const w = mountStrip([]);
        expect(w.find('button').exists()).toBe(false);
        expect(w.text()).toBe('');
    });
});
