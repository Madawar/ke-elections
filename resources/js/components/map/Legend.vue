<script setup lang="ts">
// The map legend box: its heading, the "Leaders here" strip, the rows (LegendRows.vue: a bar chart
// with counts, a plain key without), and the source, "Show all" and "Share this view" under them.
// In the MCA view with MP outlines it has two lists: "MPs (outline)" and "MCAs (fill)".
import { computed } from 'vue';
import LeadersStrip from './LeadersStrip.vue';
import LegendRows from './LegendRows.vue';
import type { LeaderRow } from '@/lib/leaders';
import type { LegendRow } from '@/lib/legend';

const props = defineProps<{
    title: string;
    /** The most height the open legend may take (CSS length), so it never runs under the search bar. */
    maxHeight?: string;
    /** The short name on the collapsed chip, such as "MP seats" (defaults to the title). */
    chipLabel?: string;
    rows: LegendRow[];
    note?: string;
    /** The keys of the rows whose areas are highlighted on the map; any number, in any order. */
    highlighted?: string[];
    /** Some highlight is on (even one no row stands for): shows "Show all". */
    filtered?: boolean;
    /** Offer "Share this view" (any seat colouring). */
    shareable?: boolean;
    /** Make "Share this view" stand out: parties are highlighted or a unit is focused. */
    shareEmphasis?: boolean;
    /** Who holds each seat that covers the focused unit: the "Leaders here" strip. */
    leaders?: LeaderRow[];
    /**
     * The MCA view with MP outlines: a second list above the rows, for the outlines, with its own
     * counts, shares and highlight. The rows are then headed `fillTitle`.
     */
    outline?: { title: string; rows: LegendRow[]; highlighted: string[] } | null;
    /** The heading of the rows when `outline` is given: "MCAs (fill)". */
    fillTitle?: string;
}>();
const emit = defineEmits<{
    /** A row was pressed: switch that party's highlight on or off. */
    toggle: [key: string];
    /** A row of the outlines' list was pressed: switch that party's outline highlight. */
    toggleOutline: [key: string];
    /** "Show all": clear every highlight. */
    clear: [];
    /** "Share this view": make a social image of the map as it is now. */
    share: [];
    /** A row's "Party details" button: open that party's profile (its abbreviation). */
    party: [abbrev: string];
    /** A name in "Leaders here" was pressed: show that person in the panel. */
    leader: [row: LeaderRow];
}>();
const open = defineModel<boolean>('open', { default: true });

// The collapsed chip shows the first few colours, largest first.
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
</script>

<template>
    <div
        class="flex flex-col rounded-md border border-hairline bg-surface text-[13px] text-ink shadow-sm"
        :class="open ? 'w-80 max-w-[calc(100vw-1.5rem)]' : 'max-w-[16rem]'"
        :style="open && maxHeight ? { maxHeight } : undefined"
    >
        <button
            type="button"
            class="flex min-h-11 w-full shrink-0 items-center gap-2 px-3 text-left font-semibold [word-spacing:0.12em]"
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
        <div v-if="open" class="min-h-0 flex-1 overflow-y-auto px-3 pb-1">
            <LeadersStrip
                v-if="leaders?.length"
                :rows="leaders"
                @pick="(row) => emit('leader', row)"
            />
            <template v-if="outline">
                <!-- The MCA view: the MPs' outlines, then the MCAs' fills, each with its own counts -->
                <section data-legend-section="outline" class="mb-1.5">
                    <h4 class="flex items-center gap-1.5 py-1 font-semibold">
                        <span
                            class="inline-block size-3 shrink-0 rounded-[2px] border-[3px] border-muted-ink"
                            aria-hidden="true"
                        />{{ outline.title }}
                    </h4>
                    <LegendRows
                        :rows="outline.rows"
                        :highlighted="outline.highlighted"
                        what="outlines"
                        @toggle="(key) => emit('toggleOutline', key)"
                        @party="(abbrev) => emit('party', abbrev)"
                    />
                </section>
                <section data-legend-section="fill">
                    <h4 class="flex items-center gap-1.5 py-1 font-semibold">
                        <span
                            class="inline-block size-3 shrink-0 rounded-[2px] bg-muted-ink"
                            aria-hidden="true"
                        />{{ fillTitle }}
                    </h4>
                    <LegendRows
                        :rows="rows"
                        :highlighted="highlighted"
                        @toggle="(key) => emit('toggle', key)"
                        @party="(abbrev) => emit('party', abbrev)"
                    />
                </section>
            </template>
            <LegendRows
                v-else
                :rows="rows"
                :highlighted="highlighted"
                @toggle="(key) => emit('toggle', key)"
                @party="(abbrev) => emit('party', abbrev)"
            />
        </div>
        <!-- Outside the scrolling rows, so the source, "Show all" and "Share this view" stay in view when the legend is capped -->
        <div
            v-if="open && (filtered || note || shareable)"
            class="shrink-0 px-3 pb-2"
        >
            <div
                v-if="filtered || shareable"
                class="flex items-center justify-between gap-2"
            >
                <button
                    v-if="filtered"
                    type="button"
                    data-onboarding="legend-clear"
                    class="min-h-11 text-[14px] underline underline-offset-4"
                    @click="emit('clear')"
                >
                    Show all
                </button>
                <button
                    v-if="shareable"
                    type="button"
                    data-share-view
                    data-onboarding="share-view"
                    class="ml-auto flex min-h-11 items-center rounded-md px-3 text-[14px] font-medium"
                    :class="
                        shareEmphasis
                            ? 'bg-ink text-surface'
                            : 'border border-hairline text-ink hover:bg-ground'
                    "
                    @click="emit('share')"
                >
                    Share this view
                </button>
            </div>
            <p v-if="note" class="mt-1 text-[12px] text-muted-ink">
                {{ note }}
            </p>
        </div>
    </div>
</template>
