<script setup lang="ts">
// "Share this view" card: the map as filtered on screen, its numbers as a bar chart and up to
// two big numbers, with the source, date and the link back to the same view. Drawn as SVG at
// the card's pixel size, shown as the live preview and rasterised to PNG.
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import type { TextItem } from '@/lib/export/layout';
import type { ViewSize } from '@/lib/export/sizes';
import { viewLayout } from '@/lib/export/viewLayout';
import type { ViewState } from '@/lib/export/viewState';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        view: ViewState;
        size: ViewSize;
        headline: string;
        mapImage: string | null;
        /** The view's deep link. */
        url: string;
        theme?: MapTheme;
        /** Width over height of the area the map shows; picks the arrangement. */
        mapAspect?: number;
        /** Shown in the map area while there is no image. */
        mapPlaceholder?: string;
        /** Every map slot's image, by key; this card draws its one slot, `mapImage`. */
        mapImages?: Record<string, string>;
    }>(),
    {
        theme: () => THEMES.dark,
        mapAspect: 0.82,
        mapPlaceholder: 'Drawing the map…',
    },
);

const layout = computed(() =>
    viewLayout(props.size, props.view, {
        headline: props.headline,
        url: props.url,
        mapAspect: props.mapAspect,
    }),
);
const tone = (t: TextItem['tone']) =>
    t === 'ink' ? props.theme.ink : props.theme.muted;
const someOn = computed(() => props.view.rows.some((r) => r.highlighted));
/** Rows left out of the highlight are drawn in the map's faded colour, as on the map. */
const barColour = (row: { colour: string; highlighted: boolean }) =>
    someOn.value && !row.highlighted ? props.theme.faded : row.colour;
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

            <!-- Ballot-lid strip: the six ballot colours, this seat's lid deeper -->
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
                    :data-current="s.current || undefined"
                />
            </g>

            <!-- Headline and scope -->
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

            <!-- The map -->
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

            <!-- Big numbers -->
            <g
                v-for="c in layout.callouts"
                :key="c.key"
                data-callout
                :data-party="c.key"
            >
                <rect
                    :x="c.lid.x"
                    :y="c.lid.y"
                    :width="c.lid.w"
                    :height="c.lid.h"
                    rx="1"
                    :fill="c.lid.colour"
                />
                <text
                    v-for="t in [c.label, c.number, c.sub]"
                    :key="t.text"
                    :x="t.x"
                    :y="t.y"
                    :font-size="t.size"
                    :font-weight="t.weight ?? 400"
                    :fill="tone(t.tone)"
                    :style="
                        t === c.number
                            ? `font-variation-settings: 'wdth' 100; font-variant-numeric: tabular-nums`
                            : undefined
                    "
                >
                    {{ t.text }}
                </text>
            </g>

            <!-- Bar chart: the legend's rows on one scale from zero -->
            <text
                v-if="layout.chartTitle"
                data-chart-title
                :x="layout.chartTitle.x"
                :y="layout.chartTitle.y"
                :font-size="layout.chartTitle.size"
                :fill="theme.muted"
            >
                {{ layout.chartTitle.text }}
            </text>
            <g
                v-for="row in layout.rows"
                :key="row.key"
                :data-row="row.key"
                :data-highlighted="String(row.highlighted)"
            >
                <text
                    :x="row.label.x"
                    :y="row.label.y"
                    :font-size="row.label.size"
                    :font-weight="row.label.weight ?? 400"
                    :fill="tone(row.label.tone)"
                >
                    {{ row.label.text }}
                </text>
                <rect
                    data-bar
                    :x="row.bar.x"
                    :y="row.bar.y"
                    :width="row.bar.w"
                    :height="row.bar.h"
                    rx="2"
                    :fill="barColour(row)"
                />
                <text
                    :x="row.value.x"
                    :y="row.value.y"
                    :text-anchor="row.value.anchor ?? 'start'"
                    :font-size="row.value.size"
                    :font-weight="row.value.weight ?? 400"
                    :fill="tone(row.value.tone)"
                    style="font-variant-numeric: tabular-nums"
                >
                    {{ row.value.text }}
                </text>
            </g>
            <rect
                v-if="layout.rows.length && layout.axis.w"
                :x="layout.axis.x"
                :y="layout.axis.y"
                :width="layout.axis.w"
                :height="layout.axis.h"
                :fill="theme.muted"
            />

            <!-- A single seat: who holds it -->
            <g v-if="layout.holder" data-holder>
                <rect
                    :x="layout.holder.lid.x"
                    :y="layout.holder.lid.y"
                    :width="layout.holder.lid.w"
                    :height="layout.holder.lid.h"
                    rx="1"
                    :fill="layout.holder.lid.colour"
                />
                <rect
                    v-if="layout.holder.chip.w"
                    :x="layout.holder.chip.x"
                    :y="layout.holder.chip.y"
                    :width="layout.holder.chip.w"
                    :height="layout.holder.chip.h"
                    rx="2"
                    :fill="layout.holder.chip.colour"
                />
                <text
                    v-for="(t, i) in layout.holder.texts"
                    :key="i"
                    :x="t.x"
                    :y="t.y"
                    :font-size="t.size"
                    :font-weight="t.weight ?? 400"
                    :fill="tone(t.tone)"
                >
                    {{ t.text }}
                </text>
            </g>

            <!-- Leaders strip: who holds the seats above this one, in seat order -->
            <g v-if="layout.leaders" data-leaders>
                <g
                    v-for="row in layout.leaders.rows"
                    :key="row.seat"
                    :data-leader="row.seat"
                >
                    <rect
                        :x="row.lid.x"
                        :y="row.lid.y"
                        :width="row.lid.w"
                        :height="row.lid.h"
                        rx="1"
                        :fill="row.lid.colour"
                    />
                    <rect
                        v-if="row.chip"
                        :x="row.chip.x"
                        :y="row.chip.y"
                        :width="row.chip.w"
                        :height="row.chip.h"
                        rx="2"
                        :fill="row.chip.colour"
                    />
                    <text
                        v-for="(t, i) in row.texts"
                        :key="i"
                        :x="t.x"
                        :y="t.y"
                        :font-size="t.size"
                        :font-weight="t.weight ?? 400"
                        :fill="tone(t.tone)"
                    >
                        {{ t.text }}
                    </text>
                </g>
                <text
                    v-for="(line, i) in layout.leaders.note"
                    :key="`n${i}`"
                    data-leaders-note
                    :x="line.x"
                    :y="line.y"
                    :font-size="line.size"
                    :fill="tone(line.tone)"
                >
                    {{ line.text }}
                </text>
                <text
                    v-if="layout.leaders.more"
                    data-leaders-more
                    :x="layout.leaders.more.x"
                    :y="layout.leaders.more.y"
                    :font-size="layout.leaders.more.size"
                    :fill="tone(layout.leaders.more.tone)"
                >
                    {{ layout.leaders.more.text }}
                </text>
            </g>

            <!-- Seat mix: one 100% bar, its legend, and the rows inside the unit in code order -->
            <g v-if="layout.mixBar" data-mix-bar>
                <g
                    v-for="seg in layout.mixBar.segments"
                    :key="seg.key"
                    :data-mix-segment="seg.key"
                >
                    <rect
                        :x="seg.x"
                        :y="seg.y"
                        :width="seg.w"
                        :height="seg.h"
                        :rx="Math.min(layout.mixBar.radius, seg.w / 2)"
                        :fill="seg.colour"
                    />
                    <text
                        v-if="seg.label"
                        :x="seg.label.x"
                        :y="seg.label.y"
                        :font-size="seg.label.size"
                        font-weight="700"
                        :fill="seg.ink"
                        style="font-variant-numeric: tabular-nums"
                    >
                        {{ seg.label.text }}
                    </text>
                </g>
            </g>
            <g v-if="layout.mixLegend" data-mix-legend>
                <g v-for="(item, i) in layout.mixLegend.items" :key="i">
                    <rect
                        v-if="item.swatch"
                        :x="item.swatch.x"
                        :y="item.swatch.y"
                        :width="item.swatch.w"
                        :height="item.swatch.h"
                        rx="2"
                        :fill="item.swatch.colour"
                    />
                    <text
                        :x="item.text.x"
                        :y="item.text.y"
                        :font-size="item.text.size"
                        :fill="tone(item.text.tone)"
                    >
                        {{ item.text.text }}
                    </text>
                </g>
            </g>
            <g
                v-for="row in layout.mixRows"
                :key="row.code"
                :data-mix-row="row.code"
            >
                <rect
                    v-if="row.chip"
                    :x="row.chip.x"
                    :y="row.chip.y"
                    :width="row.chip.w"
                    :height="row.chip.h"
                    rx="2"
                    :fill="row.chip.colour"
                />
                <rect
                    v-for="(seg, i) in row.bar"
                    :key="i"
                    :x="seg.x"
                    :y="seg.y"
                    :width="seg.w"
                    :height="seg.h"
                    :rx="Math.min(seg.h / 2, seg.w / 2)"
                    :fill="seg.colour"
                />
                <text
                    v-for="(t, i) in row.texts"
                    :key="`t${i}`"
                    :x="t.x"
                    :y="t.y"
                    :font-size="t.size"
                    :font-weight="t.weight ?? 400"
                    :text-anchor="t.anchor ?? 'start'"
                    :fill="tone(t.tone)"
                >
                    {{ t.text }}
                </text>
            </g>
            <text
                v-if="layout.moreLine"
                data-more
                :x="layout.moreLine.x"
                :y="layout.moreLine.y"
                :font-size="layout.moreLine.size"
                :fill="tone(layout.moreLine.tone)"
            >
                {{ layout.moreLine.text }}
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
