<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    useId,
    watch,
} from 'vue';
import { siteUrl } from '@/lib/export/format';
import {
    type LeaderRow,
    leaderColour,
    leadersFor,
    mcaSummary,
} from '@/lib/leaders';
import { unitPath } from '@/lib/map/urls';
import type { SeatsData } from '@/lib/seats';
import { SEAT_COLOURS } from '@/lib/map/theme';
import type { Unit, UnitIndex } from '@/lib/units';

const props = defineProps<{
    unit: Unit;
    index: UnitIndex;
    seats: SeatsData;
    towns: string[];
    /** Seat key of a person picked in search; that row gets a highlight and scrolls into view. */
    highlightSeat?: string;
    /** Whether the rest of the map stays faintly in view around the focused unit. */
    showSurroundings?: boolean;
    /** A seat colouring is on, so the map itself can be shared ("Share this view"). */
    canShareView?: boolean;
}>();
const emit = defineEmits<{
    go: [unit: Unit];
    /** A party's name was pressed: open its profile (the abbreviation). */
    party: [abbrev: string];
    share: [];
    shareView: [];
    /** "Share as image" beside "Who represents": the unit's leaders card. */
    shareLeaders: [];
    'update:showSurroundings': [on: boolean];
}>();

const switchId = useId();

const LEVEL = {
    province: 'Former province',
    county: 'County',
    constituency: 'Constituency',
    ward: 'Ward',
} as const;
const PLURAL = {
    county: 'counties',
    constituency: 'constituencies',
    ward: 'wards',
} as const;

const ancestors = computed(() =>
    props.index.ancestors(props.unit.l, props.unit.c),
);
const children = computed(() =>
    props.index
        .children(props.unit.l, props.unit.c)
        .slice()
        .sort((a, b) => a.n.localeCompare(b.n)),
);
const counts = computed(() => {
    const c = props.index.descendantCounts(
        props.unit.l,
        props.unit.c,
    ) as Record<string, number>;
    return Object.entries(c)
        .filter(([, n]) => n > 0)
        .map(
            ([level, n]) =>
                `${n} ${n === 1 ? level : PLURAL[level as keyof typeof PLURAL]}`,
        )
        .join(', ');
});
/** Parties the data describes have a profile; independents are not a party and have none. */
const profiled = computed(
    () =>
        new Set(
            props.seats.parties
                .map((p) => p.abbrev)
                .filter((a) => a !== 'IND'),
        ),
);
// Who represents the unit: its own seat first, then the seats held above it (lib/leaders.ts).
const rows = computed(() => leadersFor(props.unit, props.seats, props.index));
/** A constituency's MCAs: one line of party counts that opens the list of its wards. */
const mcas = computed(() => mcaSummary(props.unit, props.seats, props.index));
const wardsOpen = ref(false);
watch(
    () => props.unit,
    () => (wardsOpen.value = false),
);
const wardOf = (row: LeaderRow) => props.index.get('ward', row.unit.code);
const basisLabel = (basis: string) =>
    basis === 'by_election'
        ? 'By-election'
        : basis === 'succession'
          ? 'Succeeded'
          : 'Elected';
const seatList = ref<HTMLElement | null>(null);
let stopWaiting: (() => void) | null = null;
async function showHighlight() {
    if (!props.highlightSeat) return;
    await nextTick();
    const scroll = () =>
        seatList.value
            ?.querySelector('[data-highlighted="true"]')
            ?.scrollIntoView?.({ block: 'nearest' });
    scroll();
    // On a phone the sheet may still be growing from its peek height: scroll again once it has settled.
    const sheet = seatList.value?.closest('[data-sheet]');
    stopWaiting?.();
    if (!sheet) return;
    const onEnd = (e: Event) => {
        if ((e as TransitionEvent).propertyName !== 'height') return;
        stop();
        scroll();
    };
    const timer = window.setTimeout(() => stop(), 600);
    const stop = () => {
        window.clearTimeout(timer);
        sheet.removeEventListener('transitionend', onEnd);
        stopWaiting = null;
    };
    stopWaiting = stop;
    sheet.addEventListener('transitionend', onEnd);
}
onBeforeUnmount(() => stopWaiting?.());
onMounted(showHighlight);
watch(() => [props.highlightSeat, props.unit], showHighlight);

const copied = ref('');
let copiedTimer = 0;
async function copyLink() {
    if (props.unit.l === 'province') return;
    const url = siteUrl(unitPath(props.unit.l, props.unit.c));
    try {
        await navigator.clipboard.writeText(url);
        copied.value = 'Link copied';
    } catch {
        copied.value = url;
    }
    window.clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(() => (copied.value = ''), 4000);
}

const sourceHost = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return 'source';
    }
};
</script>

<template>
    <div class="space-y-5 text-ink">
        <nav
            v-if="ancestors.length"
            aria-label="Part of"
            class="text-[14px] text-muted-ink"
        >
            <template
                v-for="(a, i) in ancestors.slice().reverse()"
                :key="`${a.l}${a.c}`"
            >
                <span v-if="i > 0" aria-hidden="true">, </span>
                <button
                    v-if="a.l !== 'province'"
                    type="button"
                    class="min-h-11 underline decoration-hairline underline-offset-4 hover:decoration-ink"
                    @click="emit('go', a)"
                >
                    {{ a.n }}
                </button>
                <span v-else>{{ a.n }}</span>
            </template>
        </nav>

        <section v-if="rows.length" data-leaders>
            <div class="flex items-center justify-between gap-2">
                <h3 class="text-[15px] font-semibold">
                    Who represents {{ unit.n }}
                </h3>
                <button
                    type="button"
                    data-share-leaders
                    class="min-h-11 shrink-0 text-[14px] underline underline-offset-4"
                    :aria-label="`Share the leaders of ${unit.n} as an image`"
                    @click="emit('shareLeaders')"
                >
                    Share as image
                </button>
            </div>
            <ul
                ref="seatList"
                class="divide-y divide-hairline border-y border-hairline"
            >
                <li
                    v-for="row in rows"
                    :key="row.seat"
                    class="flex gap-3 py-2.5"
                    :class="
                        row.seat === highlightSeat
                            ? 'outline-2 -outline-offset-2 outline-ink'
                            : ''
                    "
                    :data-leader="row.seat"
                    :data-highlighted="row.seat === highlightSeat"
                >
                    <span
                        class="shrink-0 rounded-[1px]"
                        :class="row.seat === highlightSeat ? 'w-3' : 'w-1.5'"
                        :style="{ background: leaderColour(row.seat) }"
                        aria-hidden="true"
                    />
                    <div class="min-w-0 flex-1">
                        <p class="text-[13px] text-muted-ink">
                            {{ row.title
                            }}<template v-if="row.where">
                                ({{ row.where }})</template
                            >
                        </p>
                        <template v-if="row.holder">
                            <p class="text-[15px] font-medium">
                                {{ row.holder.name }}
                            </p>
                            <p
                                class="flex flex-wrap items-center gap-x-2 text-[13px]"
                            >
                                <span
                                    v-if="row.holder.party"
                                    class="inline-flex items-center gap-1"
                                >
                                    <span
                                        class="size-2.5 rounded-[2px]"
                                        :style="{
                                            background: row.holder.colour,
                                        }"
                                        aria-hidden="true"
                                    />
                                    <button
                                        v-if="profiled.has(row.holder.party)"
                                        type="button"
                                        data-party
                                        class="-my-3.5 inline-flex min-h-11 items-center text-left underline decoration-hairline underline-offset-4 hover:decoration-ink"
                                        :aria-label="`${row.holder.partyName}: all seats`"
                                        @click="emit('party', row.holder.party)"
                                    >
                                        {{ row.holder.partyName }}
                                    </button>
                                    <template v-else>{{
                                        row.holder.partyName
                                    }}</template>
                                </span>
                                <span class="text-muted-ink"
                                    >{{ basisLabel(row.holder.basis) }}
                                    {{ row.holder.startedOn.slice(0, 4) }}</span
                                >
                                <a
                                    :href="row.holder.sourceUrl"
                                    target="_blank"
                                    rel="noopener"
                                    class="text-muted-ink underline underline-offset-2"
                                    >{{ sourceHost(row.holder.sourceUrl) }}</a
                                >
                            </p>
                        </template>
                        <p v-else class="text-[15px] text-muted-ink">
                            No approved data yet
                        </p>
                    </div>
                </li>
                <li v-if="mcas" class="flex gap-3 py-1" data-mca-summary>
                    <span
                        class="w-1.5 shrink-0 rounded-[1px]"
                        :style="{ background: SEAT_COLOURS.mca }"
                        aria-hidden="true"
                    />
                    <div class="min-w-0 flex-1">
                        <button
                            type="button"
                            class="flex min-h-11 w-full items-center justify-between gap-2 text-left text-[15px]"
                            :aria-expanded="wardsOpen"
                            @click="wardsOpen = !wardsOpen"
                        >
                            <span>{{ mcas.text }}</span>
                            <svg
                                viewBox="0 0 12 12"
                                class="size-3 shrink-0 transition-transform motion-reduce:transition-none"
                                :class="wardsOpen ? 'rotate-180' : ''"
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
                        <ul v-if="wardsOpen" class="pb-1.5">
                            <li
                                v-for="ward in mcas.rows"
                                :key="ward.unit.code"
                                :data-mca-ward="ward.unit.code"
                                class="flex flex-wrap items-baseline gap-x-2 text-[14px]"
                            >
                                <span class="text-[13px] text-muted-ink">{{
                                    ward.unit.name
                                }}</span>
                                <button
                                    type="button"
                                    class="inline-flex min-h-11 items-center text-left underline decoration-hairline underline-offset-4 hover:decoration-ink"
                                    :class="ward.holder ? '' : 'text-muted-ink'"
                                    :aria-label="
                                        ward.holder
                                            ? `${ward.holder.name}, MCA: show ${ward.unit.name} ward`
                                            : `Show ${ward.unit.name} ward: no approved data yet`
                                    "
                                    @click="emit('go', wardOf(ward)!)"
                                >
                                    {{
                                        ward.holder
                                            ? ward.holder.name
                                            : 'No approved data yet'
                                    }}
                                </button>
                                <span
                                    v-if="ward.holder?.party"
                                    class="inline-flex items-center gap-1 text-[13px]"
                                >
                                    <span
                                        class="size-2.5 rounded-[2px]"
                                        :style="{
                                            background: ward.holder.colour,
                                        }"
                                        aria-hidden="true"
                                    />{{ ward.holder.partyLabel }}
                                </span>
                            </li>
                        </ul>
                    </div>
                </li>
            </ul>
        </section>

        <div v-if="unit.l !== 'province'">
            <button
                type="button"
                role="switch"
                :aria-checked="showSurroundings === true"
                :aria-labelledby="`${switchId}-label`"
                :aria-describedby="`${switchId}-hint`"
                class="mb-2 flex min-h-11 w-full items-center justify-between gap-3 text-left text-[15px]"
                @click="emit('update:showSurroundings', !showSurroundings)"
            >
                <span>
                    <span :id="`${switchId}-label`">Show surroundings</span>
                    <span
                        :id="`${switchId}-hint`"
                        class="block text-[13px] text-muted-ink"
                        >The rest of the map, faint and in grey</span
                    >
                </span>
                <span
                    class="relative h-6 w-10 shrink-0 rounded-full border border-ink transition-colors motion-reduce:transition-none"
                    :class="showSurroundings ? 'bg-ink' : 'bg-surface'"
                    aria-hidden="true"
                >
                    <span
                        class="absolute top-0.5 size-4 rounded-full transition-[left] motion-reduce:transition-none"
                        :class="
                            showSurroundings
                                ? 'left-[18px] bg-surface'
                                : 'left-0.5 bg-ink'
                        "
                    />
                </span>
            </button>
            <button
                v-if="canShareView"
                type="button"
                data-share-view
                data-onboarding="share-view"
                class="mb-2 flex h-11 w-full items-center justify-center rounded-md bg-ink px-3 text-[15px] font-medium text-surface"
                @click="emit('shareView')"
            >
                Share this view
            </button>
            <div class="flex gap-2">
                <button
                    type="button"
                    class="flex h-11 flex-1 items-center justify-center rounded-md border border-hairline bg-surface px-3 text-[15px]"
                    @click="emit('share')"
                >
                    Share image
                </button>
                <button
                    type="button"
                    class="flex h-11 flex-1 items-center justify-center rounded-md border border-hairline bg-surface px-3 text-[15px]"
                    @click="copyLink"
                >
                    Copy link
                </button>
            </div>
            <p
                class="mt-1 min-h-5 truncate text-[13px] text-muted-ink"
                aria-live="polite"
            >
                {{ copied }}
            </p>
        </div>

        <section v-if="towns.length">
            <h3 class="mb-1 text-[15px] font-semibold">Towns</h3>
            <p class="text-[14px] text-muted-ink">{{ towns.join(', ') }}</p>
        </section>

        <section v-if="children.length">
            <h3 class="mb-1 text-[15px] font-semibold">Inside {{ unit.n }}</h3>
            <p class="mb-2 text-[13px] text-muted-ink">{{ counts }}</p>
            <ul class="grid grid-cols-2 gap-x-3">
                <li v-for="c in children" :key="c.c">
                    <button
                        type="button"
                        class="flex min-h-11 w-full items-center text-left text-[14px] underline decoration-hairline underline-offset-4 hover:decoration-ink"
                        @click="emit('go', c)"
                    >
                        {{ c.n }}
                    </button>
                </li>
            </ul>
        </section>
        <p class="text-[12px] text-muted-ink">
            {{ LEVEL[unit.l] }} code {{ unit.c }} (IEBC)
        </p>
    </div>
</template>
