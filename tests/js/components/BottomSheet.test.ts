import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import BottomSheet from '@/components/map/BottomSheet.vue';

type Snap = 'peek' | 'half' | 'full';

function mountSheet(props: { snap?: Snap; desktop?: boolean } = {}) {
    const wrapper = mount(BottomSheet, {
        props: {
            snap: 'peek' as Snap,
            desktop: false,
            ...props,
            'onUpdate:snap': (s: Snap) => wrapper.setProps({ snap: s }),
        },
        slots: {
            header: '<h2>Nairobi City</h2>',
            default: '<p class="body-text">Seats</p>',
        },
        attachTo: document.body,
    });
    return wrapper;
}

describe('BottomSheet', () => {
    it('cycles peek, half, full and back to peek on Enter', async () => {
        const wrapper = mountSheet();
        const handle = wrapper.get('button[data-sheet-handle]');
        const seen: Snap[] = [];
        for (let i = 0; i < 3; i++) {
            await handle.trigger('keydown', { key: 'Enter' });
            seen.push(wrapper.props('snap') as Snap);
        }
        expect(seen).toEqual(['half', 'full', 'peek']);
        wrapper.unmount();
    });

    it('moves up and down with the arrow keys and stops at the ends', async () => {
        const wrapper = mountSheet();
        const handle = wrapper.get('button[data-sheet-handle]');
        await handle.trigger('keydown', { key: 'ArrowDown' });
        expect(wrapper.props('snap')).toBe('peek');
        await handle.trigger('keydown', { key: 'ArrowUp' });
        await handle.trigger('keydown', { key: 'ArrowUp' });
        await handle.trigger('keydown', { key: 'ArrowUp' });
        expect(wrapper.props('snap')).toBe('full');
        await handle.trigger('keydown', { key: 'ArrowDown' });
        expect(wrapper.props('snap')).toBe('half');
        wrapper.unmount();
    });

    it('ignores pointer drags on the content area', async () => {
        const wrapper = mountSheet();
        const content = wrapper.get('[data-sheet-content]');
        await content.trigger('pointerdown', { clientY: 700, pointerId: 1 });
        await content.trigger('pointermove', { clientY: 100, pointerId: 1 });
        await content.trigger('pointerup', { clientY: 100, pointerId: 1 });
        expect(wrapper.props('snap')).toBe('peek');
        wrapper.unmount();
    });

    it('snaps up after a drag on the handle', async () => {
        const wrapper = mountSheet();
        const handle = wrapper.get('button[data-sheet-handle]');
        await handle.trigger('pointerdown', { clientY: 700, pointerId: 1 });
        await handle.trigger('pointermove', { clientY: 300, pointerId: 1 });
        await handle.trigger('pointerup', { clientY: 300, pointerId: 1 });
        expect(wrapper.props('snap')).not.toBe('peek');
        wrapper.unmount();
    });

    describe('a tap on the handle', () => {
        // With the pointer captured by the drag area, a mouse or pen click lands on the area rather
        // than the handle button, so the pointer-up itself has to do the resize.
        it('resizes on pointer-up, even though the click never reaches the button', async () => {
            const wrapper = mountSheet();
            const handle = wrapper.get('button[data-sheet-handle]');
            await handle.trigger('pointerdown', { clientY: 700, pointerId: 1 });
            await handle.trigger('pointerup', { clientY: 700, pointerId: 1 });
            expect(wrapper.props('snap')).toBe('half');
            wrapper.unmount();
        });

        it('resizes once where the click does arrive too (touch gesture taps)', async () => {
            const wrapper = mountSheet();
            const handle = wrapper.get('button[data-sheet-handle]');
            await handle.trigger('pointerdown', { clientY: 700, pointerId: 1 });
            await handle.trigger('pointerup', { clientY: 700, pointerId: 1 });
            await handle.trigger('click', { detail: 1 });
            expect(wrapper.props('snap')).toBe('half');
            wrapper.unmount();
        });

        it('still resizes from the keyboard (a click with no pointer)', async () => {
            const wrapper = mountSheet();
            const handle = wrapper.get('button[data-sheet-handle]');
            await handle.trigger('click', { detail: 0 });
            expect(wrapper.props('snap')).toBe('half');
            await handle.trigger('keydown', { key: 'Enter' });
            expect(wrapper.props('snap')).toBe('full');
            wrapper.unmount();
        });

        it('does not resize when the pointer was cancelled, or when it began on the header text', async () => {
            const wrapper = mountSheet();
            const handle = wrapper.get('button[data-sheet-handle]');
            await handle.trigger('pointerdown', { clientY: 700, pointerId: 1 });
            await handle.trigger('pointercancel', { clientY: 700, pointerId: 1 });
            expect(wrapper.props('snap')).toBe('peek');
            const title = wrapper.get('h2');
            await title.trigger('pointerdown', { clientY: 700, pointerId: 2 });
            await title.trigger('pointerup', { clientY: 700, pointerId: 2 });
            expect(wrapper.props('snap')).toBe('peek');
            wrapper.unmount();
        });

        it('does not resize after a drag, and does not take the click that follows it', async () => {
            const wrapper = mountSheet();
            const handle = wrapper.get('button[data-sheet-handle]');
            await handle.trigger('pointerdown', { clientY: 700, pointerId: 1 });
            await handle.trigger('pointermove', { clientY: 100, pointerId: 1 });
            await handle.trigger('pointerup', { clientY: 100, pointerId: 1 });
            const dragged = wrapper.props('snap');
            expect(dragged).toBe('full');
            await handle.trigger('click', { detail: 1 });
            expect(wrapper.props('snap')).toBe(dragged);
            wrapper.unmount();
        });
    });

    it('marks the drag area touch-action none', () => {
        const wrapper = mountSheet();
        expect(wrapper.get('[data-sheet-drag]').attributes('style')).toContain(
            'touch-action: none',
        );
        wrapper.unmount();
    });

    it('emits height when the snap changes', async () => {
        const wrapper = mountSheet();
        await nextTick();
        const before = wrapper.emitted('height')?.length ?? 0;
        await wrapper
            .get('button[data-sheet-handle]')
            .trigger('keydown', { key: 'Enter' });
        await nextTick();
        const heights = wrapper.emitted('height') ?? [];
        expect(heights.length).toBeGreaterThan(before);
        expect(typeof heights[heights.length - 1][0]).toBe('number');
        wrapper.unmount();
    });

    it('scrolls the content only at full', async () => {
        const wrapper = mountSheet({ snap: 'half' });
        expect(wrapper.get('[data-sheet-content]').classes()).toContain(
            'overflow-hidden',
        );
        await wrapper.setProps({ snap: 'full' });
        expect(wrapper.get('[data-sheet-content]').classes()).toContain(
            'overflow-y-auto',
        );
        wrapper.unmount();
    });

    it('renders as a side panel without a handle on desktop and emits height 0', async () => {
        const wrapper = mountSheet({ desktop: true });
        await nextTick();
        expect(wrapper.find('button[data-sheet-handle]').exists()).toBe(false);
        expect(wrapper.get('[data-sheet]').classes()).toContain('w-[380px]');
        expect(wrapper.text()).toContain('Nairobi City');
        expect(wrapper.text()).toContain('Seats');
        const heights = wrapper.emitted('height') ?? [];
        expect(heights[heights.length - 1]).toEqual([0]);
        wrapper.unmount();
    });

    describe('without a desktop prop', () => {
        const realMatchMedia = window.matchMedia;
        afterEach(() => {
            window.matchMedia = realMatchMedia;
        });

        it.each([
            [true, false],
            [false, true],
        ])(
            'follows min-width 768px (matches %s, handle %s)',
            (matches, hasHandle) => {
                window.matchMedia = vi
                    .fn()
                    .mockImplementation((query: string) => ({
                        matches:
                            query === '(min-width: 768px)' ? matches : false,
                        media: query,
                        addEventListener: () => {},
                        removeEventListener: () => {},
                        addListener: () => {},
                        removeListener: () => {},
                        onchange: null,
                        dispatchEvent: () => false,
                    }));
                const wrapper = mount(BottomSheet, { props: { snap: 'peek' } });
                expect(wrapper.find('button[data-sheet-handle]').exists()).toBe(
                    hasHandle,
                );
                wrapper.unmount();
            },
        );
    });

    it('leaves a button in the header to take its own tap, so the pointer is not captured', async () => {
        const wrapper = mount(BottomSheet, {
            props: { snap: 'peek' as Snap, desktop: false },
            slots: { header: '<button class="in-header">About</button>' },
            attachTo: document.body,
        });
        const capture = vi.fn();
        const drag = wrapper.get('[data-sheet-drag]').element;
        drag.setPointerCapture = capture;
        await wrapper.get('.in-header').trigger('pointerdown', { pointerId: 1 });
        expect(capture).not.toHaveBeenCalled();
        await wrapper.get('[data-sheet-handle]').trigger('pointerdown', { pointerId: 1 });
        expect(capture).toHaveBeenCalledOnce();
        wrapper.unmount();
    });
});
