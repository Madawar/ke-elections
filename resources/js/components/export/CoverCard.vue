<script setup lang="ts">
// The cover of the county carousel: the county's name, "Who holds Kakamega’s 75 elected seats",
// the seats spelled out, the county's wards coloured by the MCA's party and the line that says
// so. Drawn as SVG at the card's pixel size, shown as the live preview and rasterised to PNG, in
// the same frame as the other cards (strip, headline, footer).
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import type { CoverCardView } from '@/lib/export/coverCard';
import { coverLayout } from '@/lib/export/coverLayout';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import type { ViewSize } from '@/lib/export/sizes';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        view: CoverCardView;
        size: ViewSize;
        headline: string;
        mapImage: string | null;
        /** The card's deep link. */
        url: string;
        theme?: MapTheme;
        /** Width over height of the county's shape. */
        mapAspect?: number;
        /** Shown in the map area while there is no image. */
        mapPlaceholder?: string;
        /** Every map slot's image, by key; this card draws its one slot, `mapImage`. */
        mapImages?: Record<string, string>;
        /** A slide's place in its series ("1 of 4"), for the footer. */
        page?: string;
    }>(),
    {
        theme: () => THEMES.dark,
        mapAspect: 1,
        mapPlaceholder: 'Drawing the map…',
    },
);

const layout = computed(() =>
    coverLayout(props.size, props.view, {
        headline: props.headline,
        url: props.url,
        mapAspect: props.mapAspect,
    }),
);
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
                data-kicker
                :x="layout.kicker.x"
                :y="layout.kicker.y"
                :font-size="layout.kicker.size"
                font-weight="600"
                :fill="theme.muted"
            >
                {{ layout.kicker.text }}
            </text>
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
                v-for="(line, i) in layout.scopeLines"
                :key="`s${i}`"
                data-scope
                :x="line.x"
                :y="line.y"
                :font-size="line.size"
                :fill="theme.muted"
            >
                {{ line.text }}
            </text>

            <image
                v-if="mapImage"
                data-map
                :x="layout.map.x"
                :y="layout.map.y"
                :width="layout.map.w"
                :height="layout.map.h"
                :href="mapImage"
                :xlink:href="mapImage"
            />
            <text
                v-else
                :x="layout.map.x + layout.map.w / 2"
                :y="layout.map.y + layout.map.h / 2"
                text-anchor="middle"
                :font-size="layout.note.size"
                :fill="theme.muted"
            >
                {{ mapPlaceholder }}
            </text>
            <text
                data-note
                :x="layout.note.x"
                :y="layout.note.y"
                :font-size="layout.note.size"
                :fill="theme.muted"
            >
                {{ layout.note.text }}
            </text>

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
