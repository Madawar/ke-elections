<script setup lang="ts">
// "Side by side": two counties on the same seat, one half each, lower IEBC code first. Drawn as
// SVG at the card's pixel size, shown as the live preview and rasterised to PNG, in the look of
// the other share cards. Each county's map is its slot's image (`mapImages`, "a" and "b" by
// position), drawn by the share dialog.
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import type { ViewSize } from '@/lib/export/sizes';
import type { VersusCardView } from '@/lib/export/versusCard';
import { type VersusSize, versusLayout } from '@/lib/export/versusLayout';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        view: VersusCardView;
        size: ViewSize;
        headline: string;
        /** The two maps, "a" and "b", as they are drawn. */
        mapImages?: Record<string, string>;
        mapPlaceholder?: string;
        url: string;
        theme?: MapTheme;
        // The share dialog gives every card these; this card's maps are its two slots.
        mapImage?: string | null;
        mapAspect?: number;
        /** A slide's place in its series ("2 of 4"), for the footer; none outside a series. */
        page?: string;
    }>(),
    {
        theme: () => THEMES.dark,
        mapImages: () => ({}),
        mapPlaceholder: 'Drawing the map…',
    },
);

const layout = computed(() =>
    versusLayout(props.size as VersusSize, props.view, {
        headline: props.headline,
        url: props.url,
    }),
);
const SLOTS = ['a', 'b'] as const;
const tone = (t: 'ink' | 'muted' | undefined) =>
    t === 'ink' ? props.theme.ink : props.theme.muted;
const asOfText = computed(() => formatAsOf(props.view.asOf));
</script>

<template>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        :viewBox="`0 0 ${layout.w} ${layout.h}`"
        :width="layout.w"
        :height="layout.h"
        role="img"
        :aria-label="headline"
    >
        <g
            :font-family="CARD_FONT_FAMILY"
            style="font-variation-settings: 'wdth' 92"
        >
            <rect :width="layout.w" :height="layout.h" :fill="theme.land" />

            <g data-strip>
                <rect
                    v-for="(s, i) in layout.strip"
                    :key="i"
                    :x="s.x"
                    :y="s.y"
                    :width="s.w"
                    :height="s.h"
                    :fill="s.colour"
                    :stroke="
                        s.colour === SEAT_COLOURS.president
                            ? theme.hairline
                            : undefined
                    "
                />
            </g>

            <text
                v-for="(line, i) in layout.headlineLines"
                :key="`h${i}`"
                data-headline
                :x="line.x"
                :y="line.y"
                :font-size="line.size"
                font-weight="700"
                :fill="theme.ink"
                style="font-variation-settings: 'wdth' 100"
            >
                {{ line.text }}
            </text>
            <text
                data-scope
                :x="layout.scopeLine.x"
                :y="layout.scopeLine.y"
                :font-size="layout.scopeLine.size"
                :fill="theme.muted"
            >
                {{ layout.scopeLine.text }}
            </text>

            <g
                v-for="(half, i) in layout.halves"
                :key="half.code"
                data-half
                :data-county="half.code"
            >
                <text
                    v-for="(line, j) in half.name"
                    :key="`n${j}`"
                    data-name
                    :x="line.x"
                    :y="line.y"
                    :font-size="line.size"
                    font-weight="700"
                    :fill="theme.ink"
                >
                    {{ line.text }}
                </text>
                <text
                    data-units
                    :x="half.units.x"
                    :y="half.units.y"
                    :font-size="half.units.size"
                    :fill="theme.muted"
                >
                    {{ half.units.text }}
                </text>

                <g data-bar>
                    <g v-for="p in half.bar.parts" :key="p.key" :data-part="p.key">
                        <rect
                            :x="p.x"
                            :y="p.y"
                            :width="p.w"
                            :height="p.h"
                            :fill="p.colour"
                            :stroke="p.outlined ? theme.hairline : undefined"
                        />
                        <text
                            v-if="p.label"
                            :x="p.label.x"
                            :y="p.label.y"
                            :font-size="p.label.size"
                            font-weight="700"
                            :fill="p.ink"
                        >
                            {{ p.label.text }}
                        </text>
                    </g>
                </g>

                <g data-key>
                    <g
                        v-for="k in half.key"
                        :key="k.key"
                        data-key-entry
                        :data-party="k.key"
                    >
                        <rect
                            :x="k.chip.x"
                            :y="k.chip.y"
                            :width="k.chip.w"
                            :height="k.chip.h"
                            rx="2"
                            :fill="k.chip.colour"
                            :stroke="k.chip.outlined ? theme.hairline : undefined"
                        />
                        <text
                            :x="k.label.x"
                            :y="k.label.y"
                            :font-size="k.label.size"
                            :fill="tone(k.label.tone)"
                        >
                            {{ k.label.text }}
                        </text>
                    </g>
                </g>

                <image
                    v-if="mapImages[SLOTS[i]]"
                    :data-map="SLOTS[i]"
                    :x="half.map.x"
                    :y="half.map.y"
                    :width="half.map.w"
                    :height="half.map.h"
                    :href="mapImages[SLOTS[i]]"
                    :xlink:href="mapImages[SLOTS[i]]"
                />
                <text
                    v-else
                    :x="half.map.x + half.map.w / 2"
                    :y="half.map.y + half.map.h / 2"
                    text-anchor="middle"
                    :font-size="half.units.size"
                    :fill="theme.muted"
                >
                    {{ mapPlaceholder }}
                </text>

                <g data-leaders>
                    <g
                        v-for="l in half.leaders"
                        :key="l.seat"
                        data-leader
                        :data-seat="l.seat"
                    >
                        <rect
                            :x="l.tick.x"
                            :y="l.tick.y"
                            :width="l.tick.w"
                            :height="l.tick.h"
                            :fill="l.tick.colour"
                        />
                        <text
                            :x="l.label.x"
                            :y="l.label.y"
                            :font-size="l.label.size"
                            :fill="theme.muted"
                        >
                            {{ l.label.text }}
                        </text>
                        <rect
                            v-if="l.chip"
                            :x="l.chip.x"
                            :y="l.chip.y"
                            :width="l.chip.w"
                            :height="l.chip.h"
                            rx="2"
                            :fill="l.chip.colour"
                        />
                        <text
                            :x="l.party.x"
                            :y="l.party.y"
                            :font-size="l.party.size"
                            :font-weight="l.party.weight ?? 400"
                            :fill="tone(l.party.tone)"
                        >
                            {{ l.party.text }}
                        </text>
                    </g>
                </g>
            </g>

            <CardFooter
                :box="layout.footerBox"
                :fonts="layout.footerFonts"
                :source="view.source"
                :as-of="asOfText"
                :url="url"
                :theme="theme"
                :page="page"
            />
            <SampleWatermark
                v-if="view.sample"
                :w="layout.w"
                :h="layout.h"
                :theme="theme"
            />
        </g>
    </svg>
</template>
