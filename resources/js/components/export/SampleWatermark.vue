<script setup lang="ts">
// Diagonal "SAMPLE DATA" mark, drawn whenever a card shows sample records.
import type { MapTheme } from '@/lib/map/theme';

defineProps<{ w: number; h: number; theme: MapTheme }>();
</script>

<template>
    <text
        data-watermark
        :x="w / 2"
        :y="h / 2"
        :font-size="Math.round(Math.min(w, h) * 0.14)"
        font-weight="700"
        text-anchor="middle"
        dominant-baseline="middle"
        :fill="theme.ink"
        fill-opacity="0.14"
        :transform="`rotate(-28 ${w / 2} ${h / 2})`"
        >SAMPLE DATA</text
    >
</template>
