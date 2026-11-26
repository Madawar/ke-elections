<script setup lang="ts">
import { computed, ref } from 'vue';
import { searchUnits } from '@/lib/search';
import type { Unit, UnitIndex } from '@/lib/units';

const props = defineProps<{ index: UnitIndex | null }>();
const emit = defineEmits<{ pick: [unit: Unit] }>();

const query = ref('');
const open = ref(false);
const active = ref(0);
const results = computed(() =>
    props.index ? searchUnits(props.index, query.value, 8) : [],
);
const LEVEL = {
    province: 'Province',
    county: 'County',
    constituency: 'Constituency',
    ward: 'Ward',
} as const;

function choose(i: number) {
    const r = results.value[i];
    if (!r) return;
    emit('pick', r.unit);
    query.value = '';
    open.value = false;
    (document.activeElement as HTMLElement | null)?.blur();
}

function close() {
    window.setTimeout(() => (open.value = false), 150);
}

function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown')
        active.value = Math.min(active.value + 1, results.value.length - 1);
    else if (e.key === 'ArrowUp') active.value = Math.max(active.value - 1, 0);
    else if (e.key === 'Enter') choose(active.value);
    else if (e.key === 'Escape') open.value = false;
    else return;
    e.preventDefault();
}
</script>

<template>
    <div class="relative w-full">
        <label class="sr-only" for="unit-search"
            >Search counties, constituencies and wards</label
        >
        <input
            id="unit-search"
            v-model="query"
            type="search"
            autocomplete="off"
            placeholder="Search a county, constituency or ward"
            class="h-11 w-full rounded-md border border-hairline bg-surface px-3 text-[15px] text-ink shadow-sm outline-none placeholder:text-muted-ink focus:border-ink"
            role="combobox"
            :aria-expanded="open && results.length > 0"
            aria-controls="unit-search-results"
            @focus="open = true"
            @input="
                open = true;
                active = 0;
            "
            @keydown="onKey"
            @blur="close"
        />
        <ul
            v-if="open && results.length"
            id="unit-search-results"
            role="listbox"
            class="absolute top-12 right-0 left-0 z-30 overflow-hidden rounded-md border border-hairline bg-surface shadow-lg"
        >
            <li
                v-for="(r, i) in results"
                :key="`${r.unit.l}${r.unit.c}`"
                role="option"
                :aria-selected="i === active"
                class="flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5"
                :class="i === active ? 'bg-ground' : ''"
                @mousedown.prevent="choose(i)"
                @mouseenter="active = i"
            >
                <span class="text-[15px] text-ink"
                    >{{ r.unit.n }}
                    <span class="text-muted-ink">{{
                        LEVEL[r.unit.l].toLowerCase()
                    }}</span></span
                >
                <span
                    v-if="r.ancestors.length"
                    class="text-[13px] text-muted-ink"
                    >{{
                        r.ancestors
                            .filter((a) => a.l !== 'province')
                            .map((a) => a.n)
                            .join(', ')
                    }}</span
                >
            </li>
        </ul>
    </div>
</template>
