import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LayersPanel from '@/components/map/LayersPanel.vue';

const mountPanel = (props = {}) =>
    mount(LayersPanel, {
        props: {
            colour: 'none',
            enabled: [],
            theme: 'system',
            overlays: [],
            swatchFor: () => undefined,
            ...props,
        },
    });
const province = (w: ReturnType<typeof mountPanel>) =>
    w.findAll('label').find((l) => l.text().includes('Former provinces'))!;

describe('LayersPanel', () => {
    it('offers no seat colouring of its own', () => {
        const w = mountPanel();
        expect(w.text()).not.toContain('Colour the map by');
        expect(w.text()).not.toContain('Highlight parties');
    });

    it('lets the former-province tint be switched on for Kenya and counties', async () => {
        const w = mountPanel();
        const box = province(w).find('input');
        expect(box.attributes('disabled')).toBeUndefined();
        await box.setValue(true);
        expect(w.emitted('update:colour')).toEqual([['province']]);
        expect(province(w).text()).not.toContain('Available for Kenya');
    });

    it('disables the tint below a county, and says why', async () => {
        const w = mountPanel({ provinceAvailable: false });
        const box = province(w).find('input');
        expect(box.attributes('disabled')).toBeDefined();
        expect(province(w).text()).toContain(
            'Available for Kenya and counties',
        );
        await box.setValue(true);
        expect(w.emitted('update:colour')).toBeUndefined();
    });

    it('keeps the reason at full strength and points the checkbox at it', () => {
        const w = mountPanel({ provinceAvailable: false });
        const label = province(w);
        const input = label.find('input');
        const reason = label
            .findAll('span')
            .find((s) => s.text() === 'Available for Kenya and counties')!;
        // Only the checkbox and the title fade; the reason must stay readable.
        for (
            let el: Element | null = reason.element;
            el;
            el = el.parentElement
        ) {
            expect(el.className).not.toMatch(/opacity-/);
            if (el === label.element) break;
        }
        expect(reason.attributes('id')).toBeTruthy();
        expect(input.attributes('aria-describedby')).toBe(
            reason.attributes('id'),
        );
        expect(input.classes().some((c) => c.startsWith('opacity-'))).toBe(
            true,
        );
    });
});

describe('LayersPanel: "Show MPs as outlines"', () => {
    const mountPanel = (props = {}) =>
        mount(LayersPanel, {
            props: {
                colour: 'mca',
                enabled: [],
                theme: 'system',
                overlays: [],
                swatchFor: () => undefined,
                ...props,
            } as never,
        });

    it('is a labelled checkbox that says what it does, on unless switched off', () => {
        const w = mountPanel();
        const box = w.get('input[data-mp-outlines]');
        expect((box.element as HTMLInputElement).checked).toBe(true);
        expect(box.element.closest('label')?.textContent).toContain(
            'Show MPs as outlines',
        );
        expect(w.get('#mp-outlines-note').text()).toContain(
            'each constituency is outlined in its MP',
        );
        expect(box.attributes('aria-describedby')).toBe('mp-outlines-note');
        expect(box.element.closest('label')?.classList).toContain('min-h-11');
    });

    it('follows the setting and reports a change', async () => {
        const w = mountPanel({ mpOutlines: false });
        const box = w.get('input[data-mp-outlines]');
        expect((box.element as HTMLInputElement).checked).toBe(false);
        await box.setValue(true);
        expect(w.emitted('update:mpOutlines')).toEqual([[true]]);
    });
});
