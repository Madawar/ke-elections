<script setup lang="ts">
// "Leaders here": who holds each seat that covers the focused unit, at the top of the legend box.
// The rows come from leadersFor (lib/leaders.ts), in seat order. It collapses to one line, and
// the choice is remembered per viewer; it starts open on desktop and as one line on a phone.
import { ref } from 'vue';
import { type LeaderRow, leaderColour } from '@/lib/leaders';

defineProps<{ rows: LeaderRow[] }>();
const emit = defineEmits<{
    /** A leader's name was pressed: show that person in the panel. */
    pick: [row: LeaderRow];
}>();

const STORAGE = 'kem.leadersOpen';
function startOpen(): boolean {
    try {
        const saved = localStorage.getItem(STORAGE);
        if (saved === 'true' || saved === 'false') return saved === 'true';
    } catch {
        // Storage can be blocked; the default for the screen is used.
    }
    return (
        typeof window !== 'undefined' &&
        !!window.matchMedia?.('(min-width: 768px)').matches
    );
}
const open = ref(startOpen());
function toggle() {
    open.value = !open.value;
    try {
        localStorage.setItem(STORAGE, String(open.value));
    } catch {
        // The choice then lasts until the page closes.
    }
}
</script>

<template>
    <section v-if="rows.length" class="mb-1 border-b border-hairline pb-1">
        <button
            type="button"
            class="flex min-h-8 w-full items-center gap-2 text-left text-[13px] font-semibold pointer-coarse:min-h-11"
            :aria-expanded="open"
            @click="toggle"
        >
            <span class="flex-1"
                >Leaders here<template v-if="!open">
                    ({{ rows.length }})</template
                ></span
            >
            <svg
                viewBox="0 0 12 12"
                class="size-3 transition-transform motion-reduce:transition-none"
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
        <ol v-if="open">
            <li
                v-for="row in rows"
                :key="row.seat"
                :data-leader="row.seat"
                class="flex items-center gap-2 leading-tight"
            >
                <span
                    data-lid
                    class="h-5 w-1 shrink-0 rounded-[1px]"
                    :style="{ background: leaderColour(row.seat) }"
                    aria-hidden="true"
                />
                <span class="w-[4.6rem] shrink-0 text-muted-ink">{{
                    row.label
                }}</span>
                <template v-if="row.holder">
                    <button
                        type="button"
                        class="-my-2 inline-flex min-h-11 min-w-0 flex-1 items-center text-left underline decoration-hairline underline-offset-4 hover:decoration-ink"
                        :aria-label="`${row.holder.name}, ${row.label}: show in the panel`"
                        @click="emit('pick', row)"
                    >
                        <span class="truncate" :title="row.holder.name">{{
                            row.holder.name
                        }}</span>
                    </button>
                    <span
                        v-if="row.holder.party"
                        class="inline-flex shrink-0 items-center gap-1"
                        :title="row.holder.partyName"
                    >
                        <span
                            data-chip
                            class="size-2.5 rounded-[2px] border border-hairline"
                            :style="{ background: row.holder.colour }"
                            aria-hidden="true"
                        />{{ row.holder.party }}
                    </span>
                </template>
                <span v-else class="flex-1 py-1 text-muted-ink"
                    >No approved data yet</span
                >
            </li>
        </ol>
    </section>
</template>
