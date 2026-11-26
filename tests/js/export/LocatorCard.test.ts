import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LocatorCard from '@/components/export/LocatorCard.vue';
import { cardSeats } from '@/lib/export/locator';
import { ATTRIBUTION } from '@/lib/map/theme';
import { SEATS, index, unit } from './fixtures';

const ward = unit('ward', 1448);
const props = (over: Record<string, unknown> = {}) => ({
    size: 'portrait' as const,
    unit: ward,
    ancestors: index.ancestors('ward', 1448),
    seats: cardSeats(SEATS, ward),
    mapImage: 'data:image/png;base64,AAAA',
    sample: false,
    asOf: '2026-03-12',
    url: 'https://example.org/ward/1448',
    ...over,
});

describe('LocatorCard', () => {
    it('draws an SVG at the card size', () => {
        const svg = mount(LocatorCard, { props: props() }).get('svg');
        expect(svg.attributes('viewBox')).toBe('0 0 1080 1350');
        expect(svg.attributes('width')).toBe('1080');
        expect(svg.attributes('height')).toBe('1350');
        const square = mount(LocatorCard, {
            props: props({ size: 'square' }),
        }).get('svg');
        expect(square.attributes('viewBox')).toBe('0 0 1080 1080');
    });

    it('shows the unit, its parents, the footer attribution and the deep link', () => {
        const text = mount(LocatorCard, { props: props() }).text();
        expect(text).toContain('Ngei');
        expect(text).toContain('Mathare');
        expect(text).toContain('Nairobi City');
        expect(text).toContain(ATTRIBUTION);
        expect(text).toContain('/ward/1448');
        expect(text).toContain('IEBC gazette notices');
        expect(text).toContain('Data as of 12 March 2026');
    });

    it('lists each seat with its holder and party, or no approved data', () => {
        const county = unit('county', 47);
        const wrapper = mount(LocatorCard, {
            props: props({
                unit: county,
                ancestors: index.ancestors('county', 47),
                seats: cardSeats(SEATS, county),
                url: 'https://example.org/county/47',
            }),
        });
        const text = wrapper.text();
        expect(text).toContain('Governor');
        expect(text).toContain('Sample Governor');
        expect(text).toContain('Sample Party A');
        expect(text).toContain('No approved data yet');
        expect(
            wrapper.find('rect[data-party-swatch][fill="#E69F00"]').exists(),
        ).toBe(true);
    });

    it('embeds the map image', () => {
        const image = mount(LocatorCard, { props: props() }).get(
            'image[data-map]',
        );
        expect(image.attributes('href')).toBe('data:image/png;base64,AAAA');
    });

    it('marks sample data with a watermark only when sample records are shown', () => {
        expect(mount(LocatorCard, { props: props() }).text()).not.toContain(
            'SAMPLE DATA',
        );
        expect(
            mount(LocatorCard, { props: props({ sample: true }) }).text(),
        ).toContain('SAMPLE DATA');
    });
});
