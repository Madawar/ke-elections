import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PartyPanel from '@/components/map/PartyPanel.vue';
import { OTHER, SEAT_COLOURS } from '@/lib/map/theme';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Unit, UnitIndex } from '@/lib/units';
import type { PartyScope } from '@/lib/map/urls';
import { PARTY_SEATS } from '../party/partyFixtures';

const index = UnitIndex.fromRows(
    JSON.parse(
        readFileSync(resolve(import.meta.dirname, '../../../public/boundaries/units.json'), 'utf8'),
    ) as Unit[],
);
const NAIROBI = { level: 'county', code: 47 } as const;
const MATHARE = { level: 'constituency', code: 290 } as const;
const mountScoped = (abbrev: string, scope: PartyScope, focus = scope as never) =>
    mount(PartyPanel, { props: { seats: PARTY_SEATS, abbrev, index, scope, focus } });

const mountParty = (abbrev: string, seats = PARTY_SEATS) =>
    mount(PartyPanel, { props: { seats, abbrev } });
const row = (w: ReturnType<typeof mountParty>, seat: string) =>
    w.get(`[data-seat-row="${seat}"]`);

describe('PartyPanel', () => {
    it('shows one row per seat, "20 of 47 (43%)", then the total of the elected seats', () => {
        const w = mountParty('UDA');
        const rows = w.findAll('[data-seat-row]');
        expect(rows.map((r) => r.attributes('data-seat-row'))).toEqual([
            'governor',
            'senator',
            'woman_rep',
            'mp',
            'mca',
            'nominated_mp',
            'nominated_senator',
            'elected',
        ]);
        expect(row(w, 'governor').text()).toContain('Governors');
        expect(row(w, 'governor').text()).toContain('20 of 47 (43%)');
        expect(row(w, 'mca').text()).toContain('517 of 1,450 (36%)');
        expect(row(w, 'nominated_mp').text()).toContain('Nominated MPs');
        expect(row(w, 'nominated_mp').text()).toContain('5 of 11 (45%)');
        expect(row(w, 'elected').text()).toContain('Total elected seats');
        expect(row(w, 'elected').text()).toContain('699 of 1,881 (37%)');
    });

    it('draws each bar in the party colour, as wide as its share of that seat', () => {
        const w = mountParty('UDA');
        const bar = row(w, 'governor').get('[data-bar]');
        expect(bar.attributes('style')?.toLowerCase()).toContain('background: #e8c547');
        // 20 of 47 = 42.6%
        expect(bar.attributes('style')).toContain('width: 42.6%');
        const track = row(w, 'governor').get('[data-track]');
        expect(track.attributes('style')).toBeUndefined();
    });

    it('marks each elected seat with its ballot colour', () => {
        const w = mountParty('ODM');
        expect(
            row(w, 'mp').get('[data-seat-colour]').attributes('style'),
        ).toContain(SEAT_COLOURS.mp);
    });

    it('has a "Show on map" button on each elected seat that emits that seat', async () => {
        const w = mountParty('UDA');
        const buttons = w.findAll('button[data-show-on-map]');
        expect(buttons.map((b) => b.attributes('data-show-on-map'))).toEqual([
            'governor',
            'senator',
            'woman_rep',
            'mp',
            'mca',
        ]);
        expect(buttons[3].text()).toBe('Show on map');
        expect(buttons[3].attributes('aria-label')).toBe('Show UDA MPs on the map');
        await buttons[3].trigger('click');
        expect(w.emitted('show')).toEqual([['mp']]);
    });

    it('has no map button on the nominated seats or the total, and says why', () => {
        const w = mountParty('UDA');
        expect(row(w, 'nominated_mp').find('button').exists()).toBe(false);
        expect(row(w, 'nominated_senator').find('button').exists()).toBe(false);
        expect(row(w, 'elected').find('button').exists()).toBe(false);
        expect(w.text()).toContain('party lists');
    });

    it('skips the map button for a seat the party does not hold', () => {
        // DP holds no governors
        const w = mountParty('DP');
        expect(row(w, 'governor').text()).toContain('0 of 47 (0%)');
        expect(row(w, 'governor').find('button').exists()).toBe(false);
        expect(row(w, 'senator').find('button').exists()).toBe(true);
    });

    it('names the party, its abbreviation and colour, 2022 coalition, former names and registration with its source', () => {
        const w = mountParty('WDM-K');
        const text = w.text();
        expect(text).toContain('WDM-K');
        expect(text).toContain('Colour on the map');
        expect(w.get('[data-swatch]').attributes('style')).toContain('#2f5fa7');
        expect(text).toContain('2022 coalition');
        expect(text).toContain('Azimio');
        expect(text).toContain('Formerly');
        expect(text).toContain('WDM');
        expect(text).toContain('1 August 2025');
        expect(text).toContain('Fully registered');
        const link = w.get('a[href="https://orpp.or.ke/register.pdf"]');
        expect(link.text()).toContain('orpp.or.ke');
        expect(link.attributes('target')).toBe('_blank');
        expect(link.attributes('rel')).toContain('noopener');
    });

    it('says so when the party has no colour of its own', () => {
        expect(mountParty('DP').text()).toContain('Grey on the map');
        expect(mountParty('DP').get('[data-swatch]').attributes('style')).toContain(OTHER);
    });

    it('renders no coalition line for a party with a coalition but no source, and words the attribution without claiming the register', () => {
        const w = mountParty('UNS', {
            ...PARTY_SEATS,
            parties: [
                { abbrev: 'UNS', name: 'Unsourced', coalition_2022: 'Some Coalition', colour: null },
            ],
            holders: [],
        });
        expect(w.text()).not.toContain('2022 coalition');
        expect(w.text()).not.toContain('Some Coalition');
        const sourced = mountParty('UDA').text();
        expect(sourced).toContain('Coalition: ORPP (2022)');
        // the register is the source of the registration, not of the coalition
        expect(sourced).not.toContain('Registration and coalition');
        expect(sourced).toContain('Registration: ORPP register, orpp.or.ke');
    });

    it('shows a recorded "none" coalition and leaves out what the data does not have', () => {
        expect(mountParty('DP').text()).toContain('2022 coalition');
        expect(mountParty('DP').text()).toContain('None');
        const bare = mountParty('BARE', {
            ...PARTY_SEATS,
            parties: [
                { abbrev: 'BARE', name: 'Bare Party', coalition_2022: null, colour: null },
            ],
            holders: [],
        });
        expect(bare.text()).not.toContain('2022 coalition');
        expect(bare.text()).not.toContain('Formerly');
        expect(bare.text()).not.toContain('Registration');
    });

    it('says "No current seats" for a party with none, and still shows its registration', () => {
        const w = mountParty('NOSEAT');
        expect(w.text()).toContain('No current seats');
        expect(w.findAll('[data-seat-row]')).toHaveLength(0);
        expect(w.find('button[data-show-on-map]').exists()).toBe(false);
        expect(w.find('[data-share-card]').exists()).toBe(false);
        expect(w.text()).toContain('Fully registered');
        expect(w.find('a[href="https://orpp.or.ke/register.pdf"]').exists()).toBe(true);
    });

    it('shows the sources and the "as of" date', () => {
        const text = mountParty('UDA').text();
        expect(text).toContain('IEBC gazette notices');
        expect(text).toContain('16 July 2026');
    });

    it('offers the party card and a link, and emits share', async () => {
        const w = mountParty('UDA');
        await w.get('[data-share-card]').trigger('click');
        expect(w.emitted('share')).toHaveLength(1);
        expect(w.get('[data-share-card]').text()).toBe('Share party card');
        expect(w.findAll('button').some((b) => b.text() === 'Copy link')).toBe(true);
    });

    it('makes every button at least 44px tall', () => {
        const w = mountParty('UDA');
        for (const b of w.findAll('button'))
            expect(b.classes().join(' '), b.text()).toMatch(/(^|\s)(min-h-11|h-11)(\s|$)/);
    });

    it('renders nothing for an abbreviation the data does not have', () => {
        expect(mountParty('NOPE').find('[data-seat-row]').exists()).toBe(false);
        expect(mountParty('NOPE').text()).toContain('not in the data');
    });

    describe('scope', () => {
        it('offers Across Kenya, the county and the constituency of the focus, and emits the one pressed', async () => {
            const w = mountScoped('UDA', MATHARE);
            const buttons = w.findAll('[data-scope]');
            expect(buttons.map((b) => b.text())).toEqual(['Across Kenya', 'In Nairobi City', 'In Mathare']);
            expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'false', 'true']);
            expect(buttons.every((b) => b.classes().includes('min-h-11'))).toBe(true);
            await buttons[1].trigger('click');
            await buttons[0].trigger('click');
            expect(w.emitted('scope')).toEqual([[NAIROBI], [null]]);
        });

        it('has no switch without the units, or with nowhere narrower than Kenya to go', () => {
            expect(mountParty('UDA').find('[data-scope-switch]').exists()).toBe(false);
            const kenya = mount(PartyPanel, {
                props: { seats: PARTY_SEATS, abbrev: 'UDA', index, scope: null, focus: null },
            });
            expect(kenya.find('[data-scope-switch]').exists()).toBe(false);
        });

        it('inside a county: one seat each for governor, senator and woman rep, then MPs and MCAs, no nominated rows', () => {
            const w = mountScoped('ODM', NAIROBI);
            expect(w.findAll('[data-seat-row]').map((r) => r.attributes('data-seat-row'))).toEqual([
                'governor', 'senator', 'woman_rep', 'mp', 'mca', 'elected',
            ]);
            expect(row(w, 'governor').text()).toMatch(/Governor\s*(Held|Not held by ODM)/);
            expect(row(w, 'mp').text()).toMatch(/MPs\s*\d+ of 17 constituencies \(\d+%\)/);
            expect(row(w, 'mca').text()).toMatch(/MCAs\s*\d+ of 85 wards/);
            expect(w.text()).toContain('In Nairobi City');
            expect(w.text()).not.toContain('Nominated');
        });

        it('inside a constituency: the MP seat and its wards', () => {
            const w = mountScoped('UDA', MATHARE);
            expect(w.findAll('[data-seat-row]').map((r) => r.attributes('data-seat-row'))).toEqual([
                'mp', 'mca', 'elected',
            ]);
        });

        it('shows the rows, not an empty state, for a scope where the party holds nothing', () => {
            const w = mountScoped('WDM-K', NAIROBI);
            expect(w.text()).not.toContain('No current seats');
            expect(row(w, 'governor').text()).toContain('Not held by WDM-K');
            expect(w.find('[data-show-on-map]').exists()).toBe(false);
            // It holds seats elsewhere in Kenya, so the card is still on offer.
            expect(w.find('[data-share-card]').exists()).toBe(true);
        });

        it('lists the top counties across Kenya, with "of N wards", and not inside a county', () => {
            const national = mountScoped('UDA', null);
            const items = national.findAll('[data-top-counties] li');
            expect(items.length).toBeGreaterThan(0);
            expect(items.length).toBeLessThanOrEqual(5);
            expect(items[0].text()).toMatch(/of \d+ wards$/);
            expect(national.text()).toContain('Where it holds the most MCA seats');
            expect(mountScoped('UDA', NAIROBI).find('[data-top-counties]').exists()).toBe(false);
        });
    });
});
