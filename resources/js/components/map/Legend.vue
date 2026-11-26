<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
    title: string;
    rows: { key: string; label: string; colour: string; count?: number }[];
    note?: string;
    collapsed?: boolean;
}>();
const open = ref(!props.collapsed);
watch(
    () => props.collapsed,
    (c) => (open.value = !c),
);
</script>

<template>
    <div
        class="max-w-[16rem] rounded-md border border-hairline bg-surface/95 text-[13px] text-ink shadow-sm"
    >
        <button
            type="button"
            class="flex min-h-11 w-full items-center gap-2 px-3 text-left font-semibold"
            :aria-expanded="open"
            @click="open = !open"
        >
            <span v-if="!open" class="flex -space-x-0.5" aria-hidden="true">
                <span
                    v-for="r in rows.slice(0, 4)"
                    :key="r.key"
                    class="size-3 rounded-[2px] border border-surface"
                    :style="{ background: r.colour }"
                />
            </span>
            <span class="flex-1">{{ title }}</span>
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
        <div v-if="open" class="px-3 pb-2">
            <ul class="space-y-0.5">
                <li
                    v-for="r in rows"
                    :key="r.key"
                    class="flex items-center gap-2"
                >
                    <span
                        class="inline-block size-3 shrink-0 rounded-[2px] border border-black/10"
                        :style="{ background: r.colour }"
                    />
                    <span class="truncate">{{ r.label }}</span>
                    <span
                        v-if="r.count !== undefined"
                        class="ml-auto pl-2 text-muted-ink tabular-nums"
                        >{{ r.count }}</span
                    >
                </li>
            </ul>
            <p v-if="note" class="mt-1 text-[12px] text-muted-ink">
                {{ note }}
            </p>
        </div>
    </div>
</template>
