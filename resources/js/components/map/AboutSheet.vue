<script setup lang="ts">
import { TOUR_STEPS } from '@/lib/onboarding';
import { ATTRIBUTION } from '@/lib/map/theme';

// "Show tips again" starts the first-visit tour over; the page does that.
defineEmits<{ showTips: [] }>();
</script>

<template>
    <div class="space-y-3 text-[14px] text-ink">
        <section aria-labelledby="how-to-use">
            <h2 id="how-to-use" class="text-[16px] font-semibold">
                How to use this map
            </h2>
            <ol class="mt-2 space-y-2">
                <li
                    v-for="step in TOUR_STEPS"
                    :key="step.id"
                    data-help-step
                    class="border-l-4 border-ink pl-3"
                >
                    <span class="block font-medium">{{ step.label }}</span>
                    <span class="block">{{ step.text }}</span>
                    <span v-if="step.detail" class="block text-muted-ink">{{
                        step.detail
                    }}</span>
                </li>
            </ol>
            <button
                type="button"
                class="mt-1 min-h-11 text-[14px] underline underline-offset-4"
                @click="$emit('showTips')"
            >
                Show tips again
            </button>
        </section>
        <p>
            A neutral map of Kenya's 47 counties, 290 constituencies and 1,450
            wards. Every unit is identified by its IEBC code.
        </p>
        <p>
            Office holders come from IEBC gazette notices of the 2022 results,
            checked against parliament.go.ke and the Council of Governors, with
            by-elections and changes since. Each seat links to its source.
        </p>
        <p>
            Party colours only tell parties apart on the map. They are not the
            parties' own colours.
        </p>
        <p class="text-[13px] text-muted-ink">{{ ATTRIBUTION }}</p>
    </div>
</template>
