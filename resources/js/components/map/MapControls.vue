<script setup lang="ts">
defineProps<{
    canZoomOut: boolean;
    zoomOutLabel: string;
    showRecentre: boolean;
    locating: boolean;
}>();
defineEmits<{ zoomIn: []; zoomOut: []; recentre: []; locate: [] }>();
const btn =
    'flex size-11 items-center justify-center rounded-md border border-hairline bg-surface text-ink shadow-sm active:bg-ground disabled:opacity-40';
</script>

<template>
    <div class="flex flex-col gap-2">
        <button
            type="button"
            :class="btn"
            aria-label="Zoom in"
            @click="$emit('zoomIn')"
        >
            <svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
                <path
                    d="M10 4v12M4 10h12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                />
            </svg>
        </button>
        <button
            type="button"
            :class="btn"
            :aria-label="zoomOutLabel"
            :title="zoomOutLabel"
            @click="$emit('zoomOut')"
        >
            <svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
                <path
                    d="M4 10h12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                />
            </svg>
        </button>
        <button
            type="button"
            :class="btn"
            aria-label="Find my ward"
            title="Find my ward"
            data-onboarding="locate"
            :disabled="locating"
            @click="$emit('locate')"
        >
            <svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
                <circle cx="10" cy="10" r="3" fill="currentColor" />
                <circle
                    cx="10"
                    cy="10"
                    r="6.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                />
                <path
                    d="M10 1.5v2.5M10 16v2.5M1.5 10H4M16 10h2.5"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                />
            </svg>
        </button>
        <button
            v-if="showRecentre"
            type="button"
            :class="btn"
            aria-label="Recentre the map"
            title="Recentre"
            @click="$emit('recentre')"
        >
            <svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
                <path
                    d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />
            </svg>
        </button>
    </div>
</template>
