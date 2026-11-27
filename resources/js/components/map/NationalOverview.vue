<script setup lang="ts">
import { formatAsOf } from '@/lib/export/format';
import { computed } from 'vue';
import Hemicycle from './Hemicycle.vue';
import {
    type SeatsData,
    chamberGroups,
    chamberHighlight,
    seatLegend,
} from '@/lib/seats';

const props = defineProps<{
    seats: SeatsData;
    /** Abbreviation of a party whose seats to emphasise in both chambers. */
    highlightParty?: string;
    /** A seat colouring is on, so the map itself can be shared ("Share this view"). */
    canShareView?: boolean;
}>();
const emit = defineEmits<{
    colourBy: [seat: 'governor' | 'mp' | 'senator' | 'woman_rep'];
    /** A party's name was pressed: open its profile (the abbreviation). */
    party: [abbrev: string];
    share: [];
    shareView: [];
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
// The group to emphasise in each chamber: the party's own, or "Other" when it has no colour of
// its own; nothing in a chamber where it holds no seats.
const naHighlight = computed(() =>
    chamberHighlight(
        na.value,
        props.seats.chambers.national_assembly,
        props.highlightParty,
    ),
);
const senateHighlight = computed(() =>
    chamberHighlight(
        senate.value,
        props.seats.chambers.senate,
        props.highlightParty,
    ),
);
const inOther = computed(
    () => naHighlight.value === 'other' || senateHighlight.value === 'other',
);
const highlightName = computed(() => {
    const abbrev = props.highlightParty;
    if (!abbrev) return '';
    if (abbrev === 'IND') return 'Independent';
    return props.seats.parties.find((p) => p.abbrev === abbrev)?.name ?? abbrev;
});
const governors = computed(() => seatLegend(props.seats, 'governor'));
/** Independents are not a party; a party the data does not describe has no profile. */
const profiled = computed(
    () => new Set(props.seats.parties.map((p) => p.abbrev).filter((a) => a !== 'IND')),
);
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
            <template v-if="!naHighlight && !senateHighlight"
                >{{ highlightName }} holds no seats in the National Assembly or
                the Senate.</template
            >
            <template v-else-if="inOther"
                >{{ highlightName }} is counted in the highlighted Other parties
                group below.</template
            >
            <template v-else
                >Seats held by {{ highlightName }} are highlighted
                below.</template
            >
        </p>
        <template v-if="hasData">
            <div class="flex flex-col gap-2">
                <button
                    v-if="canShareView"
                    type="button"
                    data-share-view
                    data-onboarding="share-view"
                    class="flex h-11 w-full items-center justify-center rounded-md border border-hairline bg-surface px-3 text-[15px]"
                    @click="emit('shareView')"
                >
                    Share this view
                </button>
                <button
                    type="button"
                    class="flex h-11 w-full items-center justify-center rounded-md border border-hairline bg-surface px-3 text-[15px]"
                    @click="emit('share')"
                >
                    Share an image of Parliament
                </button>
            </div>
            <section>
                <Hemicycle
                    title="National Assembly"
                    :groups="na"
                    :total="349"
                    :highlight="naHighlight"
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
                    :highlight="senateHighlight"
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
                        <button
                            v-if="profiled.has(g.abbrev)"
                            type="button"
                            data-party
                            class="-my-3 inline-flex min-h-11 items-center text-left underline decoration-hairline underline-offset-4 hover:decoration-ink"
                            :aria-label="`${g.name}: all seats`"
                            @click="emit('party', g.abbrev)"
                        >
                            {{ g.name }}
                        </button>
                        <span v-else>{{ g.name }}</span
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
