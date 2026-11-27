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
});
