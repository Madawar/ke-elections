<script setup lang="ts">
// "Top 10 counties for a group": the counties where the group the person picked holds the most MP
// or MCA seats, as ranked bars beside a map of Kenya with those counties filled in the bars’ colour. Drawn as
// SVG at the card's pixel size, shown as the live preview and rasterised to PNG, in the same look
// as the other share cards: their strip, headline and footer.
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import type { ViewSize } from '@/lib/export/sizes';
import type { TopCountiesCardView } from '@/lib/export/topCountiesCard';
import { topCountiesLayout } from '@/lib/export/topCountiesLayout';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        view: TopCountiesCardView;
        size: ViewSize;
        headline: string;
        /** The map of Kenya with the listed counties shaded (its one slot, "map"). */
        mapImage: string | null;
        /** The card's deep link. */
        url: string;
        theme?: MapTheme;
        /** Shown in the map area while there is no image. */
        mapPlaceholder?: string;
        // The share dialog gives every card these; the layout places its own map, of Kenya.
        mapImages?: Record<string, string>;
        mapAspect?: number;
    }>(),
    {
        theme: () => THEMES.dark,
        mapPlaceholder: 'Drawing the map…',
    },
);

const layout = computed(() =>
    topCountiesLayout(props.size, props.view, {
        headline: props.headline,
        url: props.url,
    }),
);
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
            <text
                v-if="layout.lead"
                data-lead
                :x="layout.lead.x"
                :y="layout.lead.y"
                :font-size="layout.lead.size"
                :fill="theme.muted"
            >
                {{ layout.lead.text }}
            </text>

            <!-- One row per county, most first -->
            <g v-for="r in layout.rows" :key="r.code" :data-county="r.code">
                <text
                    :x="r.rank.x"
                    :y="r.rank.y"
                    :font-size="r.rank.size"
                    :fill="tone(r.rank.tone)"
                >
                    {{ r.rank.text }}
                </text>
                <text
                    v-for="(n, i) in r.name"
                    :key="`n${i}`"
                    :x="n.x"
                    :y="n.y"
                    :font-size="n.size"
                    font-weight="700"
                    :fill="theme.ink"
                >
                    {{ n.text }}
                </text>
                <rect
                    data-bar
                    :x="r.bar.x"
                    :y="r.bar.y"
                    :width="r.bar.w"
                    :height="r.bar.h"
                    rx="1"
                    :fill="r.bar.colour"
                />
                <text
                    :x="r.count.x"
                    :y="r.count.y"
                    :font-size="r.count.size"
                    font-weight="700"
                    :fill="theme.ink"
                >
                    {{ r.count.text }}
                </text>
                <text
                    :x="r.of.x"
                    :y="r.of.y"
                    :font-size="r.of.size"
                    :fill="tone(r.of.tone)"
                >
                    {{ r.of.text }}
                </text>
                <rect
                    :x="r.rule.x"
                    :y="r.rule.y"
                    :width="r.rule.w"
                    :height="r.rule.h"
                    :fill="theme.hairline"
                />
            </g>

            <text
                v-if="layout.note.length"
                data-note
                :font-size="layout.note[0].size"
                :fill="theme.muted"
            >
                <tspan
                    v-for="(line, i) in layout.note"
                    :key="i"
                    :x="line.x"
                    :y="line.y"
                    >{{
                        i < layout.note.length - 1 ? `${line.text} ` : line.text
                    }}</tspan
                >
            </text>

            <!-- Kenya, with the listed counties in the bars’ colour -->
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
                :font-size="layout.mapCaption.size"
                :fill="theme.muted"
            >
                {{ mapPlaceholder }}
            </text>
            <text
                data-map-caption
                :x="layout.mapCaption.x"
                :y="layout.mapCaption.y"
                :font-size="layout.mapCaption.size"
                :fill="theme.muted"
            >
                {{ layout.mapCaption.text }}
            </text>

            <CardFooter
                :box="layout.footerBox"
                :fonts="layout.footerFonts"
                :source="view.source"
                :as-of="asOfText"
                :url="url"
                :theme="theme"
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
