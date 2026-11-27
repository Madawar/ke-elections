import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import Hemicycle from '@/components/map/Hemicycle.vue';

const groups = [
    { key: 'a', label: 'Sample party A', seats: 20, colour: '#E69F00' },
    { key: 'b', label: 'Sample party B', seats: 35, colour: '#56B4E9' },
    { key: 'c', label: 'Sample party C', seats: 5, colour: '#009E73' },
];

describe('Hemicycle', () => {
    it('draws one circle per seat, with hollow seats for the remainder', () => {
        const wrapper = mount(Hemicycle, {
            props: {
                groups,
                title: 'County assembly',
                total: 67,
                caption: 'Sample data, as of 26 Nov 2026',
            },
        });
        expect(wrapper.findAll('svg circle')).toHaveLength(67);
        expect(wrapper.findAll('svg circle[data-vacant]')).toHaveLength(7);
        expect(wrapper.text()).toContain('Majority: 34');
        expect(wrapper.text()).toContain('Sample data, as of 26 Nov 2026');
    });

    it('lists the groups by seats, largest first, with counts', () => {
        const wrapper = mount(Hemicycle, {
            props: {
                groups,
                title: 'County assembly',
                total: 67,
                caption: 'Sample',
            },
        });
        const items = wrapper.findAll('li').map((li) => li.text());
        expect(items).toEqual([
            'Sample party B35',
            'Sample party A20',
            'Sample party C5',
            'No data7',
        ]);
    });

    it('draws groups left to right in the order given', () => {
        const wrapper = mount(Hemicycle, {
            props: { groups, title: 'Assembly', caption: 'Sample' },
        });
        const circles = wrapper.findAll('svg circle');
        expect(circles).toHaveLength(60);
        expect(circles[0].attributes('fill')).toBe('#E69F00');
        expect(circles[20].attributes('fill')).toBe('#56B4E9');
        expect(circles[59].attributes('fill')).toBe('#009E73');
        expect(wrapper.text()).toContain('Majority: 31');
    });

    it('summarises the counts for screen readers', () => {
        const wrapper = mount(Hemicycle, {
            props: {
                groups,
                title: 'County assembly',
                total: 67,
                caption: 'Sample',
            },
        });
        const svg = wrapper.get('svg');
        expect(svg.attributes('role')).toBe('img');
        expect(svg.attributes('aria-label')).toBe(
            'County assembly, 67 seats: Sample party B 35, Sample party A 20, Sample party C 5, no data 7',
        );
    });
});
