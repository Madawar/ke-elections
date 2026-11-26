<script setup lang="ts">
import { computed } from 'vue';
import Hemicycle from './Hemicycle.vue';
import { type SeatsData, chamberGroups, seatLegend } from '@/lib/seats';

const props = defineProps<{ seats: SeatsData }>();
const emit = defineEmits<{
    colourBy: [seat: 'governor' | 'mp' | 'senator' | 'woman_rep'];
}>();

const asOf = computed(() =>
    props.seats.as_of
        ? new Date(props.seats.as_of).toLocaleDateString('en-KE', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
          })
        : null,
);
const caption = computed(
    () =>
        `Elected 2022, with by-elections and changes since. Source: IEBC gazette notices and parliament.go.ke${asOf.value ? `, imported ${asOf.value}` : ''}.`,
);
const na = computed(() => chamberGroups(props.seats, 'national_assembly'));
const senate = computed(() => chamberGroups(props.seats, 'senate'));
const governors = computed(() => seatLegend(props.seats, 'governor'));
const hasData = computed(() => props.seats.holders.length > 0);
</script>

<template>
    <div class="space-y-6 text-ink">
        <p class="text-[14px] text-muted-ink">
            Tap a county to see its seats, then keep tapping to reach
            constituencies and wards.
        </p>
        <template v-if="hasData">
            <section>
                <Hemicycle
                    title="National Assembly"
                    :groups="na"
                    :total="349"
                    :caption="caption"
                />
                <button
                    type="button"
                    class="mt-1 min-h-11 text-[14px] underline underline-offset-4"
                    @click="emit('colourBy', 'mp')"
                >
                    Colour the map by MP
                </button>
            </section>
            <section>
                <Hemicycle
                    title="Senate"
                    :groups="senate"
                    :total="67"
                    :caption="caption"
                />
                <button
                    type="button"
                    class="mt-1 min-h-11 text-[14px] underline underline-offset-4"
                    @click="emit('colourBy', 'senator')"
                >
                    Colour the map by senator
                </button>
            </section>
            <section>
                <h3 class="mb-2 text-[15px] font-semibold">Governors</h3>
                <ul class="space-y-1 text-[14px]">
                    <li
                        v-for="g in governors"
                        :key="g.abbrev"
                        class="flex items-center gap-2"
                    >
                        <span
                            class="size-3 rounded-[2px] border border-black/10"
                            :style="{ background: g.colour }"
                            aria-hidden="true"
                        />
                        <span>{{ g.name }}</span
                        ><span class="ml-auto text-muted-ink tabular-nums">{{
                            g.seats
                        }}</span>
                    </li>
                </ul>
                <button
                    type="button"
                    class="mt-1 min-h-11 text-[14px] underline underline-offset-4"
                    @click="emit('colourBy', 'governor')"
                >
                    Colour the map by governor
                </button>
            </section>
        </template>
        <p v-else class="text-[14px] text-muted-ink">
            No approved office-holder data yet.
        </p>
    </div>
</template>
