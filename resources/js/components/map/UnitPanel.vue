<script setup lang="ts">
import { computed } from 'vue';
import type { SeatsData } from '@/lib/seats';
import { partyColours } from '@/lib/seats';
import { SEAT_COLOURS } from '@/lib/map/theme';
import { type Unit, type UnitIndex, seatsFor } from '@/lib/units';

const props = defineProps<{
    unit: Unit;
    index: UnitIndex;
    seats: SeatsData;
    towns: string[];
}>();
const emit = defineEmits<{ go: [unit: Unit] }>();

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
            <ul class="divide-y divide-hairline border-y border-hairline">
                <li
                    v-for="{ seat, holder } in rows"
                    :key="seat.key"
                    class="flex gap-3 py-2.5"
                >
                    <span
                        class="w-1.5 shrink-0 rounded-[1px]"
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
                                    {{
                                        holder.party === 'IND'
                                            ? 'Independent'
                                            : (partyName.get(
                                                  holder.party ?? '',
                                              ) ?? holder.party)
                                    }}
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
