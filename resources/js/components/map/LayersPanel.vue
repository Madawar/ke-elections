<script setup lang="ts">
// "Map settings": the basemap look, and which overlays show. The seat colouring lives in the chips
// on the map (SeatChips), which share this panel's colour state.
import type { ColourKey } from '@/lib/map/colouring';
import type { MapOverlay } from '@/lib/map/overlays';

withDefaults(
    defineProps<{
        overlays: MapOverlay[];
        swatchFor: (o: MapOverlay) => string | undefined;
        /** The tint colours counties, so it means nothing inside a constituency or a ward. */
        provinceAvailable?: boolean;
    }>(),
    { provinceAvailable: true },
);
// Only the former-province tint is switched here; every seat colouring is a chip on the map.
const colour = defineModel<ColourKey>('colour', { required: true });
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
                Show on the map
            </legend>
            <label
                class="flex min-h-11 items-center gap-3"
                :class="provinceAvailable ? 'cursor-pointer' : ''"
            >
                <input
                    type="checkbox"
                    class="size-5 accent-current"
                    :class="provinceAvailable ? '' : 'opacity-60'"
                    :disabled="!provinceAvailable"
                    aria-describedby="province-note"
                    :checked="colour === 'province'"
                    @change="
                        colour = colour === 'province' ? 'none' : 'province'
                    "
                />
                <span class="text-[14px]"
                    ><span :class="provinceAvailable ? '' : 'opacity-60'"
                        >Former provinces</span
                    ><span
                        id="province-note"
                        class="block text-[12px] text-muted-ink"
                        >{{
                            provinceAvailable
                                ? 'Tint each county by its former province'
                                : 'Available for Kenya and counties'
                        }}</span
                    ></span
                >
            </label>
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
