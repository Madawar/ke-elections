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
import { unitPath } from '@/lib/map/urls';
import type { SeatsData } from '@/lib/seats';
import { partyColours } from '@/lib/seats';
import { SEAT_COLOURS } from '@/lib/map/theme';
import { type Unit, type UnitIndex, seatsFor } from '@/lib/units';

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
const colours = computed(() => partyColours(props.seats));
const partyName = computed(
    () => new Map(props.seats.parties.map((p) => [p.abbrev, p.name])),
);
/** Parties the data describes have a profile; independents are not a party and have none. */
const profiled = computed(
    () =>
        new Set(
            props.seats.parties
                .map((p) => p.abbrev)
                .filter((a) => a !== 'IND'),
        ),
);
const partyLabel = (party: string | null) =>
    party === 'IND' ? 'Independent' : (partyName.value.get(party ?? '') ?? party);
const rows = computed(() =>
    seatsFor(props.unit.l).map((seat) => ({
        seat,
        holder:
            props.seats.holders.find(
                (h) =>
                    h.seat === seat.key &&
                    h.level === props.unit.l &&
                    h.code === props.unit.c,
            ) ?? null,
    })),
);
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

        <section v-if="rows.length">
            <h3 class="mb-2 text-[15px] font-semibold">Seats</h3>
            <ul
                ref="seatList"
                class="divide-y divide-hairline border-y border-hairline"
            >
                <li
                    v-for="{ seat, holder } in rows"
                    :key="seat.key"
                    class="flex gap-3 py-2.5"
                    :class="
                        seat.key === highlightSeat
                            ? 'outline-2 -outline-offset-2 outline-ink'
                            : ''
                    "
                    :data-highlighted="seat.key === highlightSeat"
                >
                    <span
                        class="shrink-0 rounded-[1px]"
                        :class="seat.key === highlightSeat ? 'w-3' : 'w-1.5'"
                        :style="{ background: SEAT_COLOURS[seat.key] }"
                        aria-hidden="true"
                    />
                    <div class="min-w-0 flex-1">
                        <p class="text-[13px] text-muted-ink">
                            {{ seat.label }}
                        </p>
                        <template v-if="holder">
                            <p class="text-[15px] font-medium">
                                {{ holder.name }}
                            </p>
                            <p
                                class="flex flex-wrap items-center gap-x-2 text-[13px]"
                            >
                                <span class="inline-flex items-center gap-1">
                                    <span
                                        class="size-2.5 rounded-[2px]"
                                        :style="{
                                            background: colours.get(
                                                holder.party ?? '',
                                            ),
                                        }"
                                        aria-hidden="true"
                                    />
                                    <button
                                        v-if="holder.party && profiled.has(holder.party)"
                                        type="button"
                                        data-party
                                        class="-my-3.5 inline-flex min-h-11 items-center text-left underline decoration-hairline underline-offset-4 hover:decoration-ink"
                                        :aria-label="`${partyLabel(holder.party)}: all seats`"
                                        @click="emit('party', holder.party)"
                                    >
                                        {{ partyLabel(holder.party) }}
                                    </button>
                                    <template v-else>{{
                                        partyLabel(holder.party)
                                    }}</template>
                                </span>
                                <span class="text-muted-ink"
                                    >{{
                                        holder.basis === 'by_election'
                                            ? 'By-election'
                                            : holder.basis === 'succession'
                                              ? 'Succeeded'
                                              : 'Elected'
                                    }}
                                    {{ holder.started_on.slice(0, 4) }}</span
                                >
                                <a
                                    :href="holder.source_url"
                                    target="_blank"
                                    rel="noopener"
                                    class="text-muted-ink underline underline-offset-2"
                                    >{{ sourceHost(holder.source_url) }}</a
                                >
                            </p>
                        </template>
                        <p v-else class="text-[15px] text-muted-ink">
                            No approved data yet
                        </p>
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
