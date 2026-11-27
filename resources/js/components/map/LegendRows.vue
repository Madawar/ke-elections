<script setup lang="ts">
// The rows of a legend: with counts, a bar chart (one bar per party on a single scale that starts
// at zero, largest first, "Other parties" last); without counts, a plain key. The map legend draws
// one list, or two in the MCA view (the MPs' outlines and the MCAs' fills), each with its own
// counts, shares and highlight.
import { computed } from 'vue';
import { type LegendRow, shareOf } from '@/lib/legend';

const props = defineProps<{
    rows: LegendRow[];
    /** The keys of the rows whose areas are highlighted on the map; any number, in any order. */
    highlighted?: string[];
    /** What a row highlights, for its accessible name: "areas" (fills) or "outlines". */
    what?: string;
}>();
const emit = defineEmits<{
    /** A row was pressed: switch that party's highlight on or off. */
    toggle: [key: string];
    /** A row's "Party details" button: open that party's profile (its abbreviation). */
    party: [abbrev: string];
}>();
const isOn = (key: string) => props.highlighted?.includes(key) ?? false;

/** Some row has a details button: the rows without one keep its room, so every bar lines up. */
const anyDetails = computed(() => props.rows.some((r) => r.party));
const hasBars = computed(() => props.rows.some((r) => r.count !== undefined));
const sorted = computed(() =>
    hasBars.value
        ? [...props.rows].sort(
              (a, b) =>
                  Number(!!a.last) - Number(!!b.last) ||
                  (b.count ?? 0) - (a.count ?? 0) ||
                  a.label.localeCompare(b.label),
          )
        : props.rows,
);
// One scale for every bar, from zero to the largest count in view.
const largest = computed(() =>
    Math.max(1, ...props.rows.map((r) => r.count ?? 0)),
);
const total = computed(() =>
    props.rows.reduce((n, r) => n + (r.count ?? 0), 0),
);
/** A party's share of the seats in view. */
const share = (count: number) => shareOf(count, total.value);
const widthOf = (count: number) =>
    `${Number(((count / largest.value) * 100).toFixed(1))}%`;
/** The row's full name; a grouped row says how many parties it stands for ("Other parties (9)"). */
const fullName = (r: LegendRow) =>
    `${r.name ?? r.label}${r.parties ? ` (${r.parties})` : ''}`;
const spoken = (r: LegendRow) =>
    r.count === undefined
        ? fullName(r)
        : `${fullName(r)}: ${r.count} ${r.count === 1 ? 'seat' : 'seats'}, ${share(r.count).replace('<1%', 'less than 1 percent').replace('%', ' percent')}`;
</script>

<template>
    <ul class="space-y-0.5">
        <li v-for="r in sorted" :key="r.key" :data-key="r.key">
            <template v-if="r.count !== undefined">
                <span class="sr-only">{{ spoken(r) }}</span>
                <!-- Two separate targets: the row highlights, the end button opens the party. -->
                <div class="-mx-1 flex w-[calc(100%+0.5rem)] items-stretch">
                <button
                    type="button"
                    class="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-[3px] px-1 text-left pointer-coarse:min-h-11"
                    :class="
                        isOn(r.key)
                            ? 'font-semibold ring-2 ring-ink ring-inset'
                            : 'hover:bg-ground'
                    "
                    :aria-pressed="isOn(r.key)"
                    :aria-label="`Highlight ${fullName(r)} ${what ?? 'areas'}`"
                    @click="emit('toggle', r.key)"
                >
                    <span
                        class="inline-block size-3 shrink-0 rounded-[2px] border border-hairline"
                        :style="{ background: r.colour }"
                        aria-hidden="true"
                    />
                    <span
                        class="w-[5rem] shrink-0 truncate"
                        :title="fullName(r)"
                        aria-hidden="true"
                        >{{ r.label }}</span
                    >
                    <span
                        data-track
                        class="h-3 flex-1 rounded-[2px] bg-hairline"
                        aria-hidden="true"
                    >
                        <span
                            data-bar
                            class="block h-full min-w-0.5 rounded-[2px]"
                            :style="{
                                width: widthOf(r.count),
                                background: r.colour,
                            }"
                        />
                    </span>
                    <span
                        data-count
                        class="w-7 shrink-0 text-right tabular-nums"
                        aria-hidden="true"
                        >{{ r.count }}</span
                    >
                    <span
                        data-share
                        class="w-11 shrink-0 text-right whitespace-nowrap tabular-nums"
                        aria-hidden="true"
                        >({{ share(r.count) }})</span
                    >
                </button>
                <button
                    v-if="r.party"
                    type="button"
                    data-party-details
                    class="flex min-h-8 w-11 shrink-0 items-center justify-center rounded-[3px] text-muted-ink hover:bg-ground hover:text-ink pointer-coarse:min-h-11"
                    :aria-label="`${fullName(r)}: all seats`"
                    @click="emit('party', r.party)"
                >
                    <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true">
                        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4" />
                        <path d="M8 7.2v4M8 4.6v.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                    </svg>
                </button>
                <span
                    v-else-if="anyDetails"
                    class="w-11 shrink-0"
                    aria-hidden="true"
                />
                </div>
            </template>
            <span v-else class="flex items-center gap-2">
                <span
                    class="inline-block size-3 shrink-0 rounded-[2px] border border-hairline"
                    :style="{ background: r.colour }"
                    aria-hidden="true"
                />
                <span class="truncate">{{ r.label }}</span>
            </span>
        </li>
    </ul>
</template>
