import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

const imported = vi.fn();
vi.mock('maplibre-gl', () => {
    imported();
    return {
        Map: vi.fn(() => {
            throw new Error('no webgl');
        }),
        setWorkerUrl: vi.fn(),
    };
});
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?url', () => ({
    default: '/worker.js',
}));
const webgl = { ok: false };
vi.mock('@/lib/map/webgl', () => ({ supportsWebGL2: () => webgl.ok }));

import { useMap } from '@/composables/useMap';
import { NO_COLOURING } from '@/lib/map/colouring';

function harness(onUnsupported: () => void) {
    return defineComponent({
        setup() {
            const el = ref<HTMLElement | null>(null);
            useMap(el, {
                manifest: {},
                provinceOfCounty: new Map(),
                theme: ref('light'),
                colouring: ref(NO_COLOURING),
                overlays: ref([]),
                enabledOverlays: ref([]),
                boundsOf: () => undefined,
                onSelect: () => {},
                onUnsupported,
            });
            return () => h('div', { ref: el });
        },
    });
}

describe('useMap', () => {
    it('falls back without importing MapLibre when WebGL2 is missing', async () => {
        webgl.ok = false;
        const onUnsupported = vi.fn();
        mount(harness(onUnsupported));
        await new Promise((r) => setTimeout(r, 0));
        expect(onUnsupported).toHaveBeenCalledTimes(1);
        expect(imported).not.toHaveBeenCalled();
    });

    it('falls back when the Map constructor throws', async () => {
        webgl.ok = true;
        const onUnsupported = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mount(harness(onUnsupported));
        await vi.waitFor(() => expect(onUnsupported).toHaveBeenCalledTimes(1));
    });
});
