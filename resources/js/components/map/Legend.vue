<script setup lang="ts">
// The map legend. With counts it is a bar chart: one bar per party on a single scale that starts
// at zero, largest first, "Other" last. Without counts (former provinces) it is a plain key.
import { computed } from 'vue';

export interface LegendRow {
    key: string;
    /** What the row shows: a party abbreviation, or a province name. */
    label: string;
    /** The full name, read out by assistive technology (defaults to the label). */
    name?: string;
    colour: string;
    count?: number;
    /** Sorts after every other row whatever its count ("Other and independent"). */
    last?: boolean;
}

const props = defineProps<{
    title: string;
    /** The short name on the collapsed chip, such as "MP seats" (defaults to the title). */
    chipLabel?: string;
    rows: LegendRow[];
    note?: string;
    /** The keys of the rows whose areas are highlighted on the map; any number, in any order. */
    highlighted?: string[];
    /** Some highlight is on (even one no row stands for): shows "Show all". */
    filtered?: boolean;
}>();
const emit = defineEmits<{
    /** A row was pressed: switch that party's highlight on or off. */
    toggle: [key: string];
    /** "Show all": clear every highlight. */
    clear: [];
}>();
const isOn = (key: string) => props.highlighted?.includes(key) ?? false;
const open = defineModel<boolean>('open', { default: true });

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
/** A party's share of the seats in view, in whole percent; "<1%" for a share under one half. */
const share = (count: number) => {
    const p = (count / (total.value || 1)) * 100;
    return count > 0 && p < 0.5 ? '<1%' : `${Math.round(p)}%`;
};
const widthOf = (count: number) =>
    `${Number(((count / largest.value) * 100).toFixed(1))}%`;
const spoken = (r: LegendRow) =>
    r.count === undefined
        ? (r.name ?? r.label)
        : `${r.name ?? r.label}: ${r.count} ${r.count === 1 ? 'seat' : 'seats'}, ${share(r.count).replace('<1%', 'less than 1 percent').replace('%', ' percent')}`;
</script>

<template>
    <div
        class="rounded-md border border-hairline bg-surface/95 text-[13px] text-ink shadow-sm"
        :class="open ? 'w-72 max-w-[calc(100vw-1.5rem)]' : 'max-w-[16rem]'"
    >
        <button
            type="button"
            class="flex min-h-11 w-full items-center gap-2 px-3 text-left font-semibold"
            :aria-expanded="open"
            @click="open = !open"
        >
            <span v-if="!open" class="flex -space-x-0.5" aria-hidden="true">
                <span
                    v-for="r in sorted.slice(0, 4)"
                    :key="r.key"
                    class="size-3 rounded-[2px] border border-surface"
                    :style="{ background: r.colour }"
                />
            </span>
            <span class="flex-1">{{
                open ? title : (chipLabel ?? title)
            }}</span>
            <svg
                viewBox="0 0 12 12"
                class="size-3 transition-transform"
                :class="open ? 'rotate-180' : ''"
                aria-hidden="true"
            >
                <path
                    d="M2 4.5 6 8l4-3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                />
            </svg>
        </button>
        <div
            v-if="open"
            class="max-h-[min(70vh,30rem)] overflow-y-auto px-3 pb-2"
        >
            <ul class="space-y-0.5">
                <li v-for="r in sorted" :key="r.key" :data-key="r.key">
                    <template v-if="r.count !== undefined">
                        <span class="sr-only">{{ spoken(r) }}</span>
                        <button
                            type="button"
                            class="-mx-1 flex min-h-8 w-[calc(100%+0.5rem)] items-center gap-2 rounded-[3px] px-1 text-left pointer-coarse:min-h-11"
                            :class="
                                isOn(r.key)
                                    ? 'font-semibold ring-2 ring-ink ring-inset'
                                    : 'hover:bg-ground'
                            "
                            :aria-pressed="isOn(r.key)"
                            :aria-label="`Highlight ${r.name ?? r.label} areas`"
                            @click="emit('toggle', r.key)"
                        >
                            <span
                                class="inline-block size-3 shrink-0 rounded-[2px] border border-black/10"
                                :style="{ background: r.colour }"
                                aria-hidden="true"
                            />
                            <span
                                class="w-[3.25rem] shrink-0 truncate"
                                :title="r.name"
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
                                class="w-[4.5rem] shrink-0 text-right whitespace-nowrap tabular-nums"
                                aria-hidden="true"
                                >{{ r.count }} ({{ share(r.count) }})</span
                            >
                        </button>
                    </template>
                    <span v-else class="flex items-center gap-2">
                        <span
                            class="inline-block size-3 shrink-0 rounded-[2px] border border-black/10"
                            :style="{ background: r.colour }"
                            aria-hidden="true"
                        />
                        <span class="truncate">{{ r.label }}</span>
                    </span>
                </li>
            </ul>
            <button
                v-if="filtered"
                type="button"
                class="mt-1 min-h-11 text-[14px] underline underline-offset-4"
                @click="emit('clear')"
            >
                Show all
            </button>
            <p v-if="note" class="mt-2 text-[12px] text-muted-ink">
                {{ note }}
            </p>
        </div>
    </div>
</template>
