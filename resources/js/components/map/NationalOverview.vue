<script setup lang="ts">
import { formatAsOf } from '@/lib/export/format';
import { computed } from 'vue';
import Hemicycle from './Hemicycle.vue';
import { type SeatsData, chamberGroups, seatLegend } from '@/lib/seats';

const props = defineProps<{
    seats: SeatsData;
    /** Abbreviation of a party whose seats to emphasise in both chambers. */
    highlightParty?: string;
}>();
const emit = defineEmits<{
    colourBy: [seat: 'governor' | 'mp' | 'senator' | 'woman_rep'];
    share: [];
}>();

const asOf = computed(() =>
    formatAsOf(props.seats.data_as_of ?? props.seats.as_of),
);
const caption = computed(
    () =>
        `Elected 2022, with by-elections and changes since. Source: IEBC gazette notices and parliament.go.ke${asOf.value ? `, as of ${asOf.value}` : ''}.`,
);
const na = computed(() => chamberGroups(props.seats, 'national_assembly'));
const senate = computed(() => chamberGroups(props.seats, 'senate'));
// Parties without their own colour sit in the merged "other" group of a chamber.
const highlightKey = (groups: { key: string }[]) =>
    !props.highlightParty
        ? undefined
        : groups.some((g) => g.key === props.highlightParty)
          ? props.highlightParty
          : groups.find((g) => g.key === 'other')?.key;
const highlightName = computed(() => {
    const abbrev = props.highlightParty;
    if (!abbrev) return '';
    if (abbrev === 'IND') return 'Independent';
    return props.seats.parties.find((p) => p.abbrev === abbrev)?.name ?? abbrev;
});
const governors = computed(() => seatLegend(props.seats, 'governor'));
const hasData = computed(() => props.seats.holders.length > 0);
</script>

<template>
    <div class="space-y-6 text-ink">
        <p class="text-[14px] text-muted-ink">
            Tap a county to see its seats, then keep tapping to reach
            constituencies and wards.
        </p>
        <p
            v-if="highlightParty"
            class="border-l-4 border-ink pl-3 text-[14px]"
            role="status"
        >
            Seats held by {{ highlightName }} are highlighted below.
        </p>
        <template v-if="hasData">
            <button
                type="button"
                class="flex h-11 w-full items-center justify-center rounded-md border border-hairline bg-surface px-3 text-[15px]"
                @click="emit('share')"
            >
                Share an image of Parliament
            </button>
            <section>
                <Hemicycle
                    title="National Assembly"
                    :groups="na"
                    :total="349"
                    :highlight="highlightKey(na)"
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
                    :highlight="highlightKey(senate)"
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
                        <span>{{ g.name }}</span><span
                            class="ml-auto text-muted-ink tabular-nums"
                            >{{ g.seats }}</span
                        >
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
