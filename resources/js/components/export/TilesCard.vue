<script setup lang="ts">
// "Every county the same size": 47 equal tiles laid out roughly like the map, each in the party
// colour of its county's Governor, Senator or Woman Rep, with the county's name and a key. No map:
// the tiles are drawn. Drawn as SVG at the card's pixel size, shown as the live preview and
// rasterised to PNG, in the same look as the other share cards: their strip, headline and footer.
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import type { ViewSize } from '@/lib/export/sizes';
import type { TilesCardView } from '@/lib/export/tilesCard';
import { tilesLayout } from '@/lib/export/tilesLayout';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        view: TilesCardView;
        size: ViewSize;
        headline: string;
        /** The card's deep link. */
        url: string;
        theme?: MapTheme;
        // The share dialog gives every card these; this card has no map, so it uses none of them.
        mapImage?: string | null;
        mapImages?: Record<string, string>;
        mapPlaceholder?: string;
        mapAspect?: number;
    }>(),
    { theme: () => THEMES.dark },
);

const layout = computed(() =>
    tilesLayout(props.size, props.view, {
        headline: props.headline,
        url: props.url,
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

            <!-- One tile per county, by IEBC code -->
            <g
                v-for="t in layout.tiles"
                :key="t.code"
                :data-tile="t.code"
            >
                <rect
                    :x="t.box.x"
                    :y="t.box.y"
                    :width="t.box.w"
                    :height="t.box.h"
                    rx="2"
                    :fill="t.colour"
                    :stroke="t.outlined ? theme.hairline : undefined"
                    :stroke-width="t.outlined ? 2 : undefined"
                />
                <text
                    v-for="(line, i) in t.name"
                    :key="i"
                    :x="line.x"
                    :y="line.y"
                    :font-size="line.size"
                    font-weight="700"
                    :fill="t.ink"
                >
                    {{ line.text }}
                </text>
            </g>

            <g data-key>
                <g
                    v-for="e in layout.key.entries"
                    :key="e.key"
                    data-key-entry
                    :data-party="e.key"
                >
                    <rect
                        :x="e.chip.x"
                        :y="e.chip.y"
                        :width="e.chip.w"
                        :height="e.chip.h"
                        rx="2"
                        :fill="e.chip.colour"
                        :stroke="e.outlined ? theme.hairline : undefined"
                    />
                    <!-- The count as a span after the label, so the browser sets the gap. -->
                    <text
                        :x="e.label.x"
                        :y="e.label.y"
                        :font-size="e.label.size"
                        ><tspan :fill="theme.ink">{{ e.label.text }}</tspan
                        ><tspan :dx="e.gap" :fill="theme.muted">{{
                            e.count.text
                        }}</tspan></text
                    >
                </g>
            </g>

            <CardFooter
                :box="layout.footerBox"
                :fonts="layout.footerFonts"
                :source="view.source"
                :as-of="asOfText"
                :url="url"
                :theme="theme"
                :attribution="layout.attribution"
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
