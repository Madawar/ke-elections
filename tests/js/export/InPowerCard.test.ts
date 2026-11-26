import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import InPowerCard from '@/components/export/InPowerCard.vue';
import { ATTRIBUTION } from '@/lib/map/theme';
import { SEATS } from './fixtures';

const props = (over: Record<string, unknown> = {}) => ({
    size: 'square' as const,
    seats: SEATS,
    sample: false,
    asOf: '2026-03-12',
    url: 'https://example.org/',
    ...over,
});

describe('InPowerCard', () => {
    it('draws an SVG at the card size', () => {
        const svg = mount(InPowerCard, { props: props({ size: 'story' }) }).get(
            'svg',
        );
        expect(svg.attributes('viewBox')).toBe('0 0 1080 1920');
    });

    it('draws both chambers seat by seat, with unfilled seats hollow', () => {
        const wrapper = mount(InPowerCard, { props: props() });
        const na = wrapper.get('[data-chamber="national_assembly"]');
        const senate = wrapper.get('[data-chamber="senate"]');
        expect(na.findAll('circle')).toHaveLength(349);
        expect(na.findAll('circle[data-vacant]')).toHaveLength(349 - 322);
        expect(senate.findAll('circle')).toHaveLength(67);
        expect(senate.findAll('circle[data-vacant]')).toHaveLength(4);
        expect(na.findAll('circle')[0].attributes('fill')).toBe('#E69F00');
    });

    it('has a party legend with counts, majorities, and the footer', () => {
        const text = mount(InPowerCard, { props: props() }).text();
        expect(text).toContain('In power now');
        expect(text).toContain('National Assembly');
        expect(text).toContain('Senate');
        expect(text).toContain('SPA');
        expect(text).toContain('Others');
        expect(text).toContain('160');
        expect(text).toContain('Majority: 175');
        expect(text).toContain('Majority: 34');
        expect(text).toContain('IEBC gazette notices');
        expect(text).toContain('Data as of 12 March 2026');
        expect(text).toContain(ATTRIBUTION);
        expect(text).toContain('example.org');
        expect(text).not.toContain('SAMPLE DATA');
        expect(
            mount(InPowerCard, { props: props({ sample: true }) }).text(),
        ).toContain('SAMPLE DATA');
    });
});
