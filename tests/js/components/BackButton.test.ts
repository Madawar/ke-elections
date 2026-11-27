import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BackButton from '@/components/map/BackButton.vue';

describe('BackButton', () => {
    it('is hidden when nothing is focused', () => {
        const w = mount(BackButton, { props: { parent: null } });
        expect(w.find('button').exists()).toBe(false);
    });

    it('names the parent, visibly and to a screen reader', () => {
        const w = mount(BackButton, { props: { parent: 'Mathare' } });
        const b = w.get('button');
        expect(b.text()).toBe('Mathare');
        expect(b.attributes('aria-label')).toBe('Back to Mathare');
    });

    it('names all of Kenya from a county', () => {
        const w = mount(BackButton, { props: { parent: 'All of Kenya' } });
        expect(w.get('button').attributes('aria-label')).toBe(
            'Back to All of Kenya',
        );
    });

    it('is a 44px touch target with an icon, not a text arrow', () => {
        const w = mount(BackButton, { props: { parent: 'Nairobi City' } });
        expect(w.get('button').classes()).toContain('min-h-11');
        expect(w.find('svg').exists()).toBe(true);
        expect(w.get('button').text()).not.toMatch(/[←→‹<]/);
    });

    it('is the onboarding target', () => {
        const w = mount(BackButton, { props: { parent: 'Mathare' } });
        expect(w.get('button').attributes('data-onboarding')).toBe('back');
    });

    it('asks to step up when pressed', async () => {
        const w = mount(BackButton, { props: { parent: 'Mathare' } });
        await w.get('button').trigger('click');
        expect(w.emitted('stepUp')).toHaveLength(1);
    });
});
