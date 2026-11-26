<script setup lang="ts">
// "Map" settings: what the colours mean, which parties to highlight, and which overlays show.
import type { MapOverlay } from '@/lib/map/overlays';

export type ColourKey =
    | 'none'
    | 'province'
    | 'governor'
    | 'senator'
    | 'woman_rep'
    | 'mp'
    | 'mca';

defineProps<{
    colourOptions: {
        key: ColourKey;
        label: string;
        available: boolean;
        note?: string;
        swatch?: string;
    }[];
    parties: { abbrev: string; name: string; seats: number; colour: string }[];
    overlays: MapOverlay[];
    swatchFor: (o: MapOverlay) => string | undefined;
}>();
const colour = defineModel<ColourKey>('colour', { required: true });
const only = defineModel<string[]>('only', { required: true });
const enabled = defineModel<string[]>('enabled', { required: true });
const theme = defineModel<'system' | 'light' | 'dark'>('theme', {
    required: true,
});

const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
</script>

<template>
    <div class="space-y-5 text-ink">
        <fieldset>
            <legend class="mb-2 text-[15px] font-semibold">
                Colour the map by
            </legend>
            <div class="grid grid-cols-2 gap-1.5">
                <label
                    v-for="o in colourOptions"
                    :key="o.key"
                    class="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[14px]"
                    :class="[
                        colour === o.key
                            ? 'border-ink bg-ground'
                            : 'border-hairline',
                        o.available ? '' : 'cursor-not-allowed opacity-50',
                    ]"
                >
                    <input
                        v-model="colour"
                        type="radio"
                        name="colour-by"
                        class="sr-only"
                        :value="o.key"
                        :disabled="!o.available"
                    />
                    <span
                        v-if="o.swatch"
                        class="h-4 w-1.5 shrink-0 rounded-[1px]"
                        :style="{ background: o.swatch }"
                        aria-hidden="true"
                    />
                    <span class="leading-tight"
                        >{{ o.label
                        }}<span
                            v-if="o.note"
                            class="block text-[12px] text-muted-ink"
                            >{{ o.note }}</span
                        ></span
                    >
                </label>
            </div>
        </fieldset>

        <fieldset
            v-if="parties.length && !['none', 'province'].includes(colour)"
        >
            <legend class="mb-1 text-[15px] font-semibold">
                Highlight parties
            </legend>
            <p class="mb-2 text-[13px] text-muted-ink">
                Pick one or more to grey out the rest. None picked shows all.
            </p>
            <div class="flex flex-wrap gap-1.5">
                <button
                    v-for="p in parties"
                    :key="p.abbrev"
                    type="button"
                    class="flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[14px]"
                    :class="
                        only.includes(p.abbrev)
                            ? 'border-ink bg-ground'
                            : 'border-hairline'
                    "
                    :aria-pressed="only.includes(p.abbrev)"
                    :title="p.name"
                    @click="only = toggle(only, p.abbrev)"
                >
                    <span
                        class="size-3 rounded-[2px] border border-black/10"
                        :style="{ background: p.colour }"
                        aria-hidden="true"
                    />
                    {{ p.abbrev }}
                    <span class="text-muted-ink tabular-nums">{{
                        p.seats
                    }}</span>
                </button>
                <button
                    v-if="only.length"
                    type="button"
                    class="min-h-11 px-2 text-[14px] underline"
                    @click="only = []"
                >
                    Show all
                </button>
            </div>
        </fieldset>

        <fieldset>
            <legend class="mb-2 text-[15px] font-semibold">
                Show on the map
            </legend>
            <label
                v-for="o in overlays"
                :key="o.id"
                class="flex min-h-11 cursor-pointer items-center gap-3"
            >
                <input
                    type="checkbox"
                    class="size-5 accent-current"
                    :checked="enabled.includes(o.id)"
                    @change="enabled = toggle(enabled, o.id)"
                />
                <span
                    v-if="swatchFor(o)"
                    class="size-3 rounded-full border-2"
                    :style="{ borderColor: swatchFor(o) }"
                    aria-hidden="true"
                />
                <span class="text-[14px]"
                    >{{ o.label
                    }}<span
                        v-if="o.description"
                        class="block text-[12px] text-muted-ink"
                        >{{ o.description }}</span
                    ></span
                >
            </label>
        </fieldset>

        <fieldset>
            <legend class="mb-2 text-[15px] font-semibold">Appearance</legend>
            <div class="flex gap-1.5">
                <label
                    v-for="t in ['system', 'light', 'dark'] as const"
                    :key="t"
                    class="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md border text-[14px]"
                    :class="
                        theme === t ? 'border-ink bg-ground' : 'border-hairline'
                    "
                >
                    <input
                        v-model="theme"
                        type="radio"
                        name="theme"
                        class="sr-only"
                        :value="t"
                    />
                    {{
                        t === 'system'
                            ? 'Device'
                            : t === 'light'
                              ? 'Light'
                              : 'Dark'
                    }}
                </label>
            </div>
        </fieldset>
    </div>
</template>
