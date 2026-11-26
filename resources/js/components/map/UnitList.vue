<script setup lang="ts">
// The accessible list view, and the fallback when the map can't run (no WebGL2).
import { computed, ref } from 'vue';
import type { Unit, UnitIndex } from '@/lib/units';

const props = defineProps<{ index: UnitIndex }>();
const emit = defineEmits<{ pick: [unit: Unit] }>();
const open = ref(new Set<string>());
const counties = computed(() =>
    props.index
        .all()
        .filter((u) => u.l === 'county')
        .sort((a, b) => a.n.localeCompare(b.n)),
);
const key = (u: Unit) => `${u.l}${u.c}`;
const toggle = (u: Unit) => {
    const s = new Set(open.value);
    if (s.has(key(u))) s.delete(key(u));
    else s.add(key(u));
    open.value = s;
};
const kids = (u: Unit) =>
    props.index
        .children(u.l, u.c)
        .slice()
        .sort((a, b) => a.n.localeCompare(b.n));
</script>

<template>
    <ul class="divide-y divide-hairline text-ink">
        <li v-for="county in counties" :key="county.c">
            <div class="flex items-center">
                <button
                    type="button"
                    class="min-h-11 flex-1 text-left text-[15px]"
                    @click="emit('pick', county)"
                >
                    {{ county.n }}
                </button>
                <button
                    type="button"
                    class="min-h-11 px-3 text-[13px] text-muted-ink"
                    :aria-expanded="open.has(key(county))"
                    @click="toggle(county)"
                >
                    {{ open.has(key(county)) ? 'Hide' : 'Constituencies' }}
                </button>
            </div>
            <ul
                v-if="open.has(key(county))"
                class="mb-2 ml-4 border-l border-hairline pl-3"
            >
                <li v-for="c in kids(county)" :key="c.c">
                    <div class="flex items-center">
                        <button
                            type="button"
                            class="min-h-11 flex-1 text-left text-[14px]"
                            @click="emit('pick', c)"
                        >
                            {{ c.n }}
                        </button>
                        <button
                            type="button"
                            class="min-h-11 px-3 text-[13px] text-muted-ink"
                            :aria-expanded="open.has(key(c))"
                            @click="toggle(c)"
                        >
                            {{ open.has(key(c)) ? 'Hide' : 'Wards' }}
                        </button>
                    </div>
                    <ul v-if="open.has(key(c))" class="ml-4 pl-3">
                        <li v-for="w in kids(c)" :key="w.c">
                            <button
                                type="button"
                                class="min-h-11 text-left text-[14px]"
                                @click="emit('pick', w)"
                            >
                                {{ w.n }}
                            </button>
                        </li>
                    </ul>
                </li>
            </ul>
        </li>
    </ul>
</template>
