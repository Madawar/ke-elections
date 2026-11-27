<script setup lang="ts">
// The leaders card: who represents a unit. The map (a county striped by its three county seats,
// a constituency or a ward coloured by MCA), then one block per leader in seat order: the seat's
// ballot colour, the seat, the name as the data spells it, the party, since when and the source.
// Drawn as SVG at the card's pixel size, shown as the live preview and rasterised to PNG. Same
// look as the "Share this view" card (ViewCard.vue): its strip, headline and footer.
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import type { LeadersCardView } from '@/lib/export/leadersCard';
import { leadersLayout } from '@/lib/export/leadersLayout';
import type { ViewSize } from '@/lib/export/sizes';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        view: LeadersCardView;
        size: ViewSize;
        headline: string;
        mapImage: string | null;
        /** The card's deep link. */
        url: string;
        theme?: MapTheme;
        /** Width over height of the area the map shows. */
        mapAspect?: number;
        /** Shown in the map area while there is no image. */
        mapPlaceholder?: string;
    }>(),
    {
        theme: () => THEMES.dark,
        mapAspect: 1,
        mapPlaceholder: 'Drawing the map…',
    },
);

const layout = computed(() =>
    leadersLayout(props.size, props.view, {
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

            <!-- One block per leader, in seat order -->
            <g
                v-for="b in layout.blocks"
                :key="b.seat"
                :data-leader="b.seat"
            >
                <rect
                    :x="b.lid.x"
                    :y="b.lid.y"
                    :width="b.lid.w"
                    :height="b.lid.h"
                    rx="1"
                    :fill="b.lid.colour"
                    :stroke="
                        b.lid.colour === SEAT_COLOURS.president
                            ? theme.hairline
                            : undefined
                    "
                />
                <rect
                    v-if="b.chip"
                    :x="b.chip.x"
                    :y="b.chip.y"
                    :width="b.chip.w"
                    :height="b.chip.h"
                    rx="2"
                    :fill="b.chip.colour"
                />
                <text
                    v-for="(t, i) in b.texts"
                    :key="i"
                    :data-role="t.role"
                    :x="t.x"
                    :y="t.y"
                    :font-size="t.size"
                    :font-weight="t.weight ?? 400"
                    :fill="tone(t.tone)"
                >
                    {{ t.text }}
                </text>
            </g>

            <!-- A constituency's MCAs by party, of its wards -->
            <g v-if="layout.mix" data-mca-mix>
                <text
                    v-for="(line, i) in layout.mix.label"
                    :key="i"
                    :x="line.x"
                    :y="line.y"
                    :font-size="line.size"
                    :fill="theme.ink"
                >
                    {{ line.text }}
                </text>
                <rect
                    v-for="seg in layout.mix.bar"
                    :key="seg.key"
                    :x="seg.x"
                    :y="seg.y"
                    :width="seg.w"
                    :height="seg.h"
                    rx="2"
                    :fill="seg.colour"
                />
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
