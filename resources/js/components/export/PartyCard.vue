<script setup lang="ts">
// The party card: a party's seats across Kenya, each as "n of N (p%)" over a bar in the party's
// data colour, with a small map of where it holds MCA seats, the source, date and link. Drawn as
// SVG at the card's pixel size, shown as the live preview and rasterised to PNG. Same look as the
// "Share this view" card (ViewCard.vue): its strip, headline and footer.
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import type { PartyCardView } from '@/lib/export/partyCard';
import { partyLayout } from '@/lib/export/partyLayout';
import type { ViewSize } from '@/lib/export/sizes';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        view: PartyCardView;
        size: ViewSize;
        headline: string;
        mapImage: string | null;
        /** The card's deep link (`/party/uda` on the site). */
        url: string;
        theme?: MapTheme;
        /** Width over height of the area the map shows. */
        mapAspect?: number;
        /** Shown in the map area while there is no image. */
        mapPlaceholder?: string;
    }>(),
    {
        theme: () => THEMES.dark,
        mapAspect: 0.82,
        mapPlaceholder: 'Drawing the map…',
    },
);

const layout = computed(() =>
    partyLayout(props.size, props.view, {
        headline: props.headline,
        url: props.url,
        mapAspect: props.mapAspect,
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

            <!-- Ballot-lid strip: the six ballot colours -->
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

            <!-- The map of where the party holds MCA seats -->
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
                :font-size="layout.scopeLine.size"
                :fill="theme.muted"
            >
                {{ mapPlaceholder }}
            </text>

            <!-- One row per seat: its count and share over a bar, on a track for the whole seat -->
            <g v-for="row in layout.rows" :key="row.key" :data-row="row.key">
                <text
                    :x="row.label.x"
                    :y="row.label.y"
                    :font-size="row.label.size"
                    :fill="tone(row.label.tone)"
                >
                    {{ row.label.text }}
                </text>
                <text
                    :x="row.value.x"
                    :y="row.value.y"
                    text-anchor="end"
                    :font-size="row.value.size"
                    font-weight="700"
                    :fill="tone(row.value.tone)"
                    style="font-variant-numeric: tabular-nums"
                >
                    {{ row.value.text }}
                </text>
                <rect
                    data-track
                    :x="row.track.x"
                    :y="row.track.y"
                    :width="row.track.w"
                    :height="row.track.h"
                    rx="2"
                    :fill="theme.hairline"
                />
                <rect
                    v-if="row.bar.w"
                    data-bar
                    :x="row.bar.x"
                    :y="row.bar.y"
                    :width="row.bar.w"
                    :height="row.bar.h"
                    rx="2"
                    :fill="row.colour"
                />
            </g>

            <!-- Across Kenya: the counties where the party holds the most MCA seats -->
            <g v-if="layout.list" data-top>
                <text
                    v-for="(t, i) in layout.list.title"
                    :key="`t${i}`"
                    :x="t.x"
                    :y="t.y"
                    :font-size="t.size"
                    :fill="tone(t.tone)"
                >
                    {{ t.text }}
                </text>
                <g
                    v-for="item in layout.list.items"
                    :key="item.key"
                    :data-top-county="item.key"
                >
                    <text
                        :x="item.label.x"
                        :y="item.label.y"
                        :font-size="item.label.size"
                        :fill="tone(item.label.tone)"
                    >
                        {{ item.label.text }}
                    </text>
                    <text
                        :x="item.value.x"
                        :y="item.value.y"
                        text-anchor="end"
                        :font-size="item.value.size"
                        font-weight="700"
                        :fill="tone(item.value.tone)"
                        style="font-variant-numeric: tabular-nums"
                    >
                        {{ item.value.text }}
                    </text>
                </g>
            </g>

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
