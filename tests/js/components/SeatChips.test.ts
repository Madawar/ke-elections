import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SeatChips from '@/components/map/SeatChips.vue';

const mountChips = (modelValue = 'none', props = {}) =>
    mount(SeatChips, {
        props: { modelValue, ...props },
        attachTo: document.body,
    });
const radios = (w: ReturnType<typeof mountChips>) =>
    w.findAll('[role="radio"]');

describe('SeatChips', () => {
    it('is a labelled radiogroup of six chips, in ballot order', () => {
        const w = mountChips();
        expect(w.find('[role="radiogroup"]').attributes('aria-label')).toBe(
            'Colour the map by seat',
        );
        expect(radios(w).map((r) => r.text())).toEqual([
            'None',
            'Governor',
            'Senator',
            'Woman Rep',
            'MP',
            'MCA',
        ]);
    });

    it('marks only the active chip as checked', () => {
        const w = mountChips('senator');
        expect(radios(w).map((r) => r.attributes('aria-checked'))).toEqual([
            'false',
            'false',
            'true',
            'false',
            'false',
            'false',
        ]);
    });

    it('fills the active chip with its ballot colour token', () => {
        const w = mountChips('woman_rep');
        const active = radios(w)[3].find('[data-chip-face]');
        expect(active.classes()).toContain('bg-seat-woman-rep');
        const idle = radios(w)[1].find('[data-chip-face]');
        expect(idle.classes()).not.toContain('bg-seat-governor');
    });

    it('keeps the chips 44px tall to tap', () => {
        const w = mountChips();
        for (const r of radios(w)) expect(r.classes()).toContain('min-h-11');
    });

    it('emits the chosen key when a chip is pressed', async () => {
        const w = mountChips();
        await radios(w)[4].trigger('click');
        expect(w.emitted('update:modelValue')).toEqual([['mp']]);
        // None is a real choice too.
        const on = mountChips('mp');
        await radios(on)[0].trigger('click');
        expect(on.emitted('update:modelValue')).toEqual([['none']]);
    });

    it('puts only the active chip in the tab order', () => {
        const w = mountChips('governor');
        expect(radios(w).map((r) => r.attributes('tabindex'))).toEqual([
            '-1',
            '0',
            '-1',
            '-1',
            '-1',
            '-1',
        ]);
        // With a mode that has no chip (former provinces), the row is still reachable.
        const other = mountChips('province');
        expect(radios(other)[0].attributes('tabindex')).toBe('0');
    });

    it('moves and selects with the arrow keys, wrapping at the ends', async () => {
        const w = mountChips('governor');
        await radios(w)[1].trigger('keydown', { key: 'ArrowRight' });
        expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['senator']);
        await radios(w)[1].trigger('keydown', { key: 'ArrowDown' });
        expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['senator']);
        await radios(w)[1].trigger('keydown', { key: 'ArrowLeft' });
        expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['none']);
        const first = mountChips('none');
        await radios(first)[0].trigger('keydown', { key: 'ArrowLeft' });
        expect(first.emitted('update:modelValue')?.at(-1)).toEqual(['mca']);
        const last = mountChips('mca');
        await radios(last)[5].trigger('keydown', { key: 'ArrowRight' });
        expect(last.emitted('update:modelValue')?.at(-1)).toEqual(['none']);
    });

    it('moves focus to the chip it selects', async () => {
        const w = mountChips('none');
        radios(w)[0].element.focus();
        await radios(w)[0].trigger('keydown', { key: 'ArrowRight' });
        expect(document.activeElement).toBe(radios(w)[1].element);
    });

    it('jumps to the ends with Home and End', async () => {
        const w = mountChips('senator');
        await radios(w)[2].trigger('keydown', { key: 'End' });
        expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['mca']);
        await radios(w)[2].trigger('keydown', { key: 'Home' });
        expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['none']);
    });

    it('skips a seat with no approved data and does not select it', async () => {
        const w = mountChips('governor', { unavailable: ['senator'] });
        const senator = radios(w)[2];
        expect(senator.attributes('aria-disabled')).toBe('true');
        await senator.trigger('click');
        expect(w.emitted('update:modelValue')).toBeUndefined();
        await radios(w)[1].trigger('keydown', { key: 'ArrowRight' });
        expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['woman_rep']);
    });
});

describe('SeatChips inside a constituency or a ward', () => {
    const inConstituency = (modelValue = 'mp') =>
        mountChips(modelValue, {
            focusLevel: 'constituency',
            parents: { county: 'Nairobi City' },
        });
    const inWard = (modelValue = 'mca') =>
        mountChips(modelValue, {
            focusLevel: 'ward',
            parents: { county: 'Nairobi City', constituency: 'Mathare' },
        });
    const muted = (w: ReturnType<typeof mountChips>) =>
        radios(w)
            .filter((r) => r.attributes('data-muted') === 'true')
            .map((r) => r.find('[data-chip-label]').text());

    it('mutes the county-wide seats inside a constituency, saying why', () => {
        const w = inConstituency();
        expect(muted(w)).toEqual(['Governor', 'Senator', 'Woman Rep']);
        const governor = radios(w)[1];
        expect(governor.text()).toContain('County-wide');
        expect(governor.attributes('aria-label')).toBe(
            'Governor — county-wide seat; go back to Nairobi City to see it',
        );
        // The chips that do show here carry no note.
        expect(radios(w)[4].text()).toBe('MP');
        expect(radios(w)[0].text()).toBe('None');
    });

    it('also mutes MP inside a ward', () => {
        const w = inWard();
        expect(muted(w)).toEqual(['Governor', 'Senator', 'Woman Rep', 'MP']);
        const mp = radios(w)[4];
        expect(mp.attributes('aria-label')).toBe(
            'MP — constituency-wide seat; go back to Mathare to see it',
        );
        expect(radios(w)[2].attributes('aria-label')).toContain(
            'go back to Nairobi City',
        );
    });

    it('mutes nothing with nothing focused, or a county', () => {
        expect(muted(mountChips('governor'))).toEqual([]);
        expect(muted(mountChips('governor', { focusLevel: 'county' }))).toEqual(
            [],
        );
    });

    it('asks to step up, rather than choosing, when a muted chip is pressed', async () => {
        const w = inConstituency();
        await radios(w)[1].trigger('click');
        expect(w.emitted('stepUp')).toEqual([['governor', 'county']]);
        expect(w.emitted('update:modelValue')).toBeUndefined();
        const ward = inWard();
        await radios(ward)[4].trigger('click');
        expect(ward.emitted('stepUp')).toEqual([['mp', 'constituency']]);
    });

    it('still chooses the chips that fit', async () => {
        const w = inConstituency('mp');
        await radios(w)[5].trigger('click');
        expect(w.emitted('update:modelValue')).toEqual([['mca']]);
        expect(w.emitted('stepUp')).toBeUndefined();
    });

    it('leaves muted chips out of the arrow-key walk', async () => {
        const w = inConstituency('none');
        await radios(w)[0].trigger('keydown', { key: 'ArrowRight' });
        expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['mp']);
        const back = inConstituency('mp');
        await radios(back)[4].trigger('keydown', { key: 'ArrowLeft' });
        expect(back.emitted('update:modelValue')?.at(-1)).toEqual(['none']);
    });

    it('keeps muted chips reachable by Tab', () => {
        const w = inConstituency('mp');
        expect(radios(w).map((r) => r.attributes('tabindex'))).toEqual([
            '-1',
            '0',
            '0',
            '0',
            '0',
            '-1',
        ]);
    });
});

// WCAG 2.x contrast ratio between two #rrggbb colours.
const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

describe('SeatChips colours', () => {
    // The tokens the chips use, read from the stylesheet so the test follows the real values.
    const css = readFileSync(
        resolve(import.meta.dirname, '../../../resources/css/map-theme.css'),
        'utf8',
    );
    const block = (selector: string) =>
        css.slice(css.indexOf(selector)).split('}')[0];
    const tokens = (text: string) =>
        Object.fromEntries(
            [...text.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [
                m[1],
                m[2],
            ]),
        );
    const fixed = tokens(css.slice(0, css.indexOf(':root {')));
    const modes = {
        light: tokens(block(':root {')),
        dark: tokens(block('.dark {')),
    };
    /** A utility class's colour: a `seat-*` token, or the theme's ink and surface in this mode. */
    const colourOf = (utility: string, mode: 'light' | 'dark') => {
        const name = utility.replace(/^(bg|text)-/, '');
        if (name === 'ink') return modes[mode]['km-ink'];
        if (name === 'surface') return modes[mode]['km-surface'];
        return fixed[`color-${name}`];
    };

    for (const mode of ['light', 'dark'] as const) {
        it(`reads at 4.5:1 or better on every active chip, in ${mode} mode`, () => {
            const keys = [
                'none',
                'governor',
                'senator',
                'woman_rep',
                'mp',
                'mca',
            ];
            for (const key of keys) {
                const chip =
                    mountChips(key).findAll('[role="radio"]')[
                        keys.indexOf(key)
                    ];
                const classes = chip.find('[data-chip-face]').classes();
                const face = classes.find((c) => /^bg-(seat-|ink)/.test(c))!;
                const text = classes.find((c) =>
                    /^text-(seat-|surface)/.test(c),
                )!;
                const bg = colourOf(face, mode);
                const fg = colourOf(text, mode);
                expect(bg, `${key} face ${face}`).toBeTruthy();
                expect(fg, `${key} text ${text}`).toBeTruthy();
                expect(
                    contrast(bg, fg),
                    `${key}: ${text} on ${face}`,
                ).toBeGreaterThanOrEqual(4.5);
            }
        });
    }

    it("keeps the map's ballot green; only the chip face is darker", () => {
        expect(fixed['color-seat-mp']).toBe('#2e8b57');
        expect(fixed['color-seat-mp-chip']).toBe('#2a8052');
    });

    it('measures contrast the WCAG way', () => {
        expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
        expect(contrast('#2e8b57', '#ffffff')).toBeLessThan(4.5);
    });
});
