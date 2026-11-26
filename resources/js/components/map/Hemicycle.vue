<script setup lang="ts">
// Seating chart for an assembly. Groups fill the seats left to right in the order given; any
// seats beyond their sum are drawn hollow as "No data".
import { computed } from 'vue';
import { layoutHemicycle } from '@/lib/hemicycle';

export interface HemicycleGroup {
    key: string;
    label: string;
    seats: number;
    colour: string;
}

const props = defineProps<{
    groups: HemicycleGroup[];
    title: string;
    /** Size of the assembly. Seats not covered by a group render hollow. */
    total?: number;
    /** Source and "as of" line, shown under the chart. */
    caption: string;
}>();

const assigned = computed(() =>
    props.groups.reduce((n, g) => n + Math.max(0, g.seats), 0),
);
const seatTotal = computed(() => Math.max(assigned.value, props.total ?? 0));
const vacant = computed(() => seatTotal.value - assigned.value);
const majority = computed(() => Math.floor(seatTotal.value / 2) + 1);

const seats = computed(() => {
    const colours = props.groups.flatMap((g) =>
        Array<string | null>(Math.max(0, g.seats)).fill(g.colour),
    );
    return layoutHemicycle(seatTotal.value).map((s, i) => ({
        ...s,
        colour: colours[i] ?? null,
    }));
});

const legend = computed(() => {
    const rows = props.groups
        .map((g) => ({
            key: g.key,
            label: g.label,
            seats: g.seats,
            colour: g.colour as string | null,
        }))
        .sort((a, b) => b.seats - a.seats);
    if (vacant.value > 0)
        rows.push({
            key: '__no-data',
            label: 'No data',
            seats: vacant.value,
            colour: null,
        });
    return rows;
});

const summary = computed(() => {
    const parts = legend.value.map(
        (row) => `${row.colour ? row.label : 'no data'} ${row.seats}`,
    );
    return `${props.title}, ${seatTotal.value} seats: ${parts.join(', ')}`;
});
</script>

<template>
    <figure class="text-ink">
        <h3 class="font-display text-base font-semibold">{{ title }}</h3>
        <svg
            viewBox="-1 0 2 1"
            class="mt-2 block w-full"
            role="img"
            :aria-label="summary"
        >
            <template v-for="(s, i) in seats" :key="i">
                <circle
                    v-if="s.colour"
                    :cx="s.x"
                    :cy="1 - s.y"
                    :r="s.r"
                    :fill="s.colour"
                />
                <circle
                    v-else
                    data-vacant
                    :cx="s.x"
                    :cy="1 - s.y"
                    :r="s.r * 0.85"
                    :stroke-width="s.r * 0.3"
                    class="fill-none stroke-muted-ink"
                />
            </template>
        </svg>
        <div class="mt-2 flex justify-between text-sm">
            <span>{{ seatTotal }} seats</span>
            <span>Majority: {{ majority }}</span>
        </div>
        <ul class="mt-3 space-y-1 text-sm">
            <li
                v-for="row in legend"
                :key="row.key"
                class="flex items-center gap-2"
            >
                <span
                    class="size-3 shrink-0 rounded-full"
                    :class="row.colour ? '' : 'border-2 border-muted-ink'"
                    :style="
                        row.colour ? { backgroundColor: row.colour } : undefined
                    "
                    aria-hidden="true"
                />
                <span class="flex-1">{{ row.label }}</span>
                <span class="tabular-nums">{{ row.seats }}</span>
            </li>
        </ul>
        <figcaption class="mt-3 text-xs text-muted-ink">
            {{ caption }}
        </figcaption>
    </figure>
</template>
