<script setup lang="ts">
// The map as a reusable component: boundaries, labels, colouring and any overlays
// (towns now; schools, hospitals and the like later via the `overlays` prop).
import 'maplibre-gl/dist/maplibre-gl.css';
import { ref, toRef } from 'vue';
import { type Picked, type Bounds, useMap } from '@/composables/useMap';
import type { Colouring } from '@/lib/map/colouring';
import type { MapLevel } from '@/lib/map/levels';
import type { MapOverlay } from '@/lib/map/overlays';
import type { ThemeName } from '@/lib/map/theme';

const props = defineProps<{
    manifest: Record<string, string>;
    provinceOfCounty: Map<number, number>;
    boundsOf: (level: MapLevel, code: number) => Bounds | undefined;
    theme: ThemeName;
    colouring: Colouring;
    overlays: MapOverlay[];
    enabledOverlays: string[];
}>();

const emit = defineEmits<{
    select: [unit: Picked];
    hover: [unit: Picked | null, point: { x: number; y: number }];
    overlayClick: [overlay: MapOverlay, properties: Record<string, unknown>];
    unsupported: [];
    userMove: [];
}>();

const container = ref<HTMLElement | null>(null);
const api = useMap(container, {
    manifest: props.manifest,
    provinceOfCounty: props.provinceOfCounty,
    boundsOf: props.boundsOf,
    theme: toRef(props, 'theme'),
    colouring: toRef(props, 'colouring'),
    overlays: toRef(props, 'overlays'),
    enabledOverlays: toRef(props, 'enabledOverlays'),
    onSelect: (u) => emit('select', u),
    onHover: (u, p) => emit('hover', u, p),
    onOverlayClick: (o, p) => emit('overlayClick', o, p),
    onUnsupported: () => emit('unsupported'),
    onUserMove: () => emit('userMove'),
});

defineExpose(api);
</script>

<template>
    <div class="absolute inset-0">
        <div
            ref="container"
            class="h-full w-full"
            role="application"
            aria-label="Map of Kenya's counties, constituencies and wards"
        />
    </div>
</template>
