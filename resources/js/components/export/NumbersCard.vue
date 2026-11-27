<script setup lang="ts">
// "By the numbers": every elected seat below the President, one row per seat in ballot order,
// with the number of seats, the groups holding the most and a thin mix bar. No map, so it reads
// at thumbnail size. Drawn as SVG at the card's pixel size, shown as the live preview and
// rasterised to PNG, in the same look as the other share cards: their strip, headline and footer.
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import type { NumbersCardView } from '@/lib/export/numbersCard';
import { numbersLayout } from '@/lib/export/numbersLayout';
import type { ViewSize } from '@/lib/export/sizes';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        view: NumbersCardView;
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
        /** A slide's place in its series ("2 of 4"), for the footer; none outside a series. */
        page?: string;
        /** The widest page text of its series, which the footer is measured with. */
        pageWidest?: string;
    }>(),
    { theme: () => THEMES.dark },
);

const layout = computed(() =>
    numbersLayout(props.size, props.view, {
        headline: props.headline,
        url: props.url,
    }),
);
const tone = (t: 'ink' | 'muted') =>
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

            <!-- One row per seat, in ballot order -->
            <g v-for="r in layout.rows" :key="r.seat" :data-seat="r.seat">
                <rect
                    :x="r.lid.x"
                    :y="r.lid.y"
                    :width="r.lid.w"
                    :height="r.lid.h"
                    rx="1"
                    :fill="r.lid.colour"
                />
                <text
                    data-number
                    :x="r.number.x"
                    :y="r.number.y"
                    :font-size="r.number.size"
                    :font-weight="r.number.weight"
                    text-anchor="end"
                    :fill="theme.ink"
                >
                    {{ r.number.text }}
                </text>
                <text
                    :x="r.label.x"
                    :y="r.label.y"
                    :font-size="r.label.size"
                    font-weight="700"
                    :fill="theme.ink"
                >
                    {{ r.label.text }}
                </text>
                <rect
                    v-for="(c, i) in r.chips"
                    :key="`c${i}`"
                    :x="c.x"
                    :y="c.y"
                    :width="c.w"
                    :height="c.h"
                    rx="2"
                    :fill="c.colour"
                />
                <text
                    v-for="(t, i) in r.most"
                    :key="`m${i}`"
                    :x="t.x"
                    :y="t.y"
                    :font-size="t.size"
                    :fill="tone(t.tone)"
                >
                    {{ t.text }}
                </text>
                <rect
                    v-for="p in r.bar"
                    :key="p.key"
                    :data-part="p.key"
                    :x="p.x"
                    :y="p.y"
                    :width="p.w"
                    :height="p.h"
                    rx="1"
                    :fill="p.colour"
                />
            </g>

            <rect
                :x="layout.rule.x"
                :y="layout.rule.y"
                :width="layout.rule.w"
                :height="layout.rule.h"
                :fill="theme.hairline"
            />
            <text
                data-note
                :font-size="layout.note[0]?.size"
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

            <CardFooter
                :box="layout.footerBox"
                :fonts="layout.footerFonts"
                :source="view.source"
                :as-of="asOfText"
                :url="url"
                :theme="theme"
                :attribution="layout.attribution"
                :page="page"
                :page-widest="pageWidest"
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
