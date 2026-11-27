import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import OfflineBanner from '@/components/OfflineBanner.vue';

function setOnline(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => value,
    });
}

const TEXT = "You're offline: showing saved map data";

describe('OfflineBanner', () => {
    afterEach(() => setOnline(true));

    it('is hidden while online', () => {
        setOnline(true);
        const wrapper = mount(OfflineBanner);
        expect(wrapper.text()).not.toContain(TEXT);
        wrapper.unmount();
    });

    it('shows while offline, as a polite status message', () => {
        setOnline(false);
        const wrapper = mount(OfflineBanner);
        expect(wrapper.text()).toContain(TEXT);
        expect(wrapper.get('[role="status"]').text()).toContain(TEXT);
        wrapper.unmount();
    });

    it('follows the offline and online events', async () => {
        setOnline(true);
        const wrapper = mount(OfflineBanner);
        setOnline(false);
        window.dispatchEvent(new Event('offline'));
        await nextTick();
        expect(wrapper.text()).toContain(TEXT);
        setOnline(true);
        window.dispatchEvent(new Event('online'));
        await nextTick();
        expect(wrapper.text()).not.toContain(TEXT);
        wrapper.unmount();
    });
});
