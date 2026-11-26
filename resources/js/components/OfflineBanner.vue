<script setup lang="ts">
// Shown while the browser reports no connection. The service worker keeps serving the precached
// boundaries and the last holder data it saw, so the map still works; this says so plainly.
import { useOnline } from '@vueuse/core';

const online = useOnline();
</script>

<template>
    <div role="status" aria-live="polite">
        <p
            v-if="!online"
            class="pointer-events-none fixed inset-x-3 top-16 z-40 rounded-md bg-ink px-3 py-2 font-display text-[14px] text-surface md:right-auto md:left-[400px] md:max-w-md"
            style="font-variation-settings: 'wdth' 92"
        >
            You're offline: showing saved map data
        </p>
    </div>
</template>
