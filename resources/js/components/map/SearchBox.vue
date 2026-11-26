<script setup lang="ts">
import { computed, ref } from 'vue';
import {
    type PersonResult,
    type SearchResult,
    describePerson,
    searchPeople,
    searchUnits,
} from '@/lib/search';
import type { Holder } from '@/lib/seats';
import type { Unit, UnitIndex } from '@/lib/units';

const props = withDefaults(
    defineProps<{ index: UnitIndex | null; holders?: Holder[] }>(),
    { holders: () => [] },
);
const emit = defineEmits<{
    pick: [unit: Unit];
    pickPerson: [person: PersonResult];
}>();

// Up to 6 of each group; when only one group has matches it can use up to 8.
const GROUP_LIMIT = 6;
const SOLO_LIMIT = 8;

const query = ref('');
const open = ref(false);
const active = ref(0);

const groups = computed(() => {
    if (!props.index) return { places: [], people: [] };
    const places = searchUnits(props.index, query.value, SOLO_LIMIT);
    const people = searchPeople(
        props.holders,
        props.index,
        query.value,
        SOLO_LIMIT,
    );
    if (places.length && people.length)
        return {
            places: places.slice(0, GROUP_LIMIT),
            people: people.slice(0, GROUP_LIMIT),
        };
    return { places, people };
});

type Row =
    | { kind: 'place'; id: string; place: SearchResult }
    | { kind: 'person'; id: string; person: PersonResult };
const rows = computed<Row[]>(() => [
    ...groups.value.places.map((place, i) => ({
        kind: 'place' as const,
        id: `unit-search-place-${i}`,
        place,
    })),
    ...groups.value.people.map((person, i) => ({
        kind: 'person' as const,
        id: `unit-search-person-${i}`,
        person,
    })),
]);

const LEVEL = {
    province: 'Province',
    county: 'County',
    constituency: 'Constituency',
    ward: 'Ward',
} as const;

function choose(i: number) {
    const r = rows.value[i];
    if (!r) return;
    if (r.kind === 'place') emit('pick', r.place.unit);
    else emit('pickPerson', r.person);
    query.value = '';
    open.value = false;
    (document.activeElement as HTMLElement | null)?.blur();
}

function close() {
    window.setTimeout(() => (open.value = false), 150);
}

function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown')
        active.value = Math.min(active.value + 1, rows.value.length - 1);
    else if (e.key === 'ArrowUp') active.value = Math.max(active.value - 1, 0);
    else if (e.key === 'Enter') choose(active.value);
    else if (e.key === 'Escape') open.value = false;
    else return;
    e.preventDefault();
}

// A heading goes before the first row of each group.
const headingFor = (i: number) =>
    rows.value[i].kind === rows.value[i - 1]?.kind
        ? null
        : rows.value[i].kind === 'place'
          ? 'Places'
          : 'People';

const areaLine = (u: SearchResult) =>
    u.ancestors
        .filter((a) => a.l !== 'province')
        .map((a) => a.n)
        .join(', ');
</script>

<template>
    <div class="relative w-full">
        <label class="sr-only" for="unit-search"
            >Search places and people</label
        >
        <input
            id="unit-search"
            v-model="query"
            type="search"
            autocomplete="off"
            placeholder="Search a place or a person"
            class="h-11 w-full rounded-md border border-hairline bg-surface px-3 text-[15px] text-ink shadow-sm outline-none placeholder:text-muted-ink focus:border-ink"
            role="combobox"
            :aria-expanded="open && rows.length > 0"
            aria-controls="unit-search-results"
            :aria-activedescendant="
                open && rows[active] ? rows[active].id : undefined
            "
            @focus="open = true"
            @input="
                open = true;
                active = 0;
            "
            @keydown="onKey"
            @blur="close"
        />
        <ul
            v-if="open && rows.length"
            id="unit-search-results"
            role="listbox"
            aria-label="Search results"
            class="absolute top-12 right-0 left-0 z-30 max-h-[70vh] overflow-y-auto rounded-md border border-hairline bg-surface shadow-lg"
        >
            <template v-for="(r, i) in rows" :key="r.id">
                <li
                    v-if="headingFor(i)"
                    role="presentation"
                    class="px-3 pt-2 pb-1 text-[13px] font-semibold text-muted-ink"
                >
                    {{ headingFor(i) }}
                </li>
                <li
                    :id="r.id"
                    role="option"
                    :aria-selected="i === active"
                    class="flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5"
                    :class="i === active ? 'bg-ground' : ''"
                    @mousedown.prevent="choose(i)"
                    @mouseenter="active = i"
                >
                    <template v-if="r.kind === 'place'">
                        <span class="text-[15px] text-ink"
                            >{{ r.place.unit.n }}
                            <span class="text-muted-ink">{{
                                LEVEL[r.place.unit.l].toLowerCase()
                            }}</span></span
                        >
                        <span
                            v-if="areaLine(r.place)"
                            class="text-[13px] text-muted-ink"
                            >{{ areaLine(r.place) }}</span
                        >
                    </template>
                    <template v-else>
                        <span class="text-[15px] text-ink">{{
                            r.person.holder.name
                        }}</span>
                        <span class="text-[13px] text-muted-ink">{{
                            describePerson(r.person)
                        }}</span>
                    </template>
                </li>
            </template>
        </ul>
    </div>
</template>
