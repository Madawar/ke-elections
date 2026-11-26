<script setup lang="ts">
// "Unit locator" card (spec: Infographic exports): where a unit is, its parents and its seats.
// Drawn as SVG at the card's pixel size, shown as the live preview and rasterised to PNG.
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import {
    type TextItem,
    legendBlock,
    locatorLayout,
    seatBlocks,
} from '@/lib/export/layout';
import type { CardSeat, MapLegend } from '@/lib/export/locator';
import type { CardSize } from '@/lib/export/sizes';
import { fitFontSize, wrapText } from '@/lib/export/text';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';
import type { Unit } from '@/lib/units';

const props = withDefaults(
    defineProps<{
        size: CardSize;
        unit: Unit;
        /** Parents, nearest first (as UnitIndex.ancestors returns them). */
        ancestors: Unit[];
        seats: CardSeat[];
        mapImage: string | null;
        insetImage?: string | null;
        legend?: MapLegend | null;
        sample: boolean;
        /** Date the data describes, "YYYY-MM-DD". */
        asOf: string | null;
        /** The unit's deep link. */
        url: string;
        source?: string;
        theme?: MapTheme;
        /** Shown in the map area while there is no image. */
        mapPlaceholder?: string;
    }>(),
    {
        insetImage: null,
        legend: null,
        source: 'IEBC gazette notices',
        theme: () => THEMES.light,
        mapPlaceholder: 'Drawing the map…',
    },
);

const LEVEL = {
    province: 'former province',
    county: 'county',
    constituency: 'constituency',
    ward: 'ward',
} as const;

const layout = computed(() => locatorLayout(props.size, props.seats.length));
const tone = (t: TextItem['tone']) =>
    t === 'ink' ? props.theme.ink : props.theme.muted;

const header = computed(() => {
    const { header: box, fonts } = layout.value;
    const kicker = `IEBC ${LEVEL[props.unit.l]} ${props.unit.c}`;
    const titleSize = fitFontSize(
        props.unit.n,
        box.w,
        fonts.title,
        Math.round(fonts.title * 0.6),
        true,
    );
    // Wards and constituencies name their constituency and county; a county its former province.
    const parents = props.ancestors.filter(
        (a) => props.unit.l === 'county' || a.l !== 'province',
    );
    const crumbText = parents
        .map((a) =>
            a.l === 'province'
                ? `former ${a.n} province`
                : `${a.n} ${LEVEL[a.l]}`,
        )
        .join(', ');
    const crumbSize = fitFontSize(
        crumbText,
        box.w,
        fonts.crumb,
        Math.round(fonts.crumb * 0.8),
    );
    const kickerY = box.y + fonts.kicker * 0.9;
    const titleY = kickerY + fonts.title * 1.08;
    return {
        kicker: { x: box.x, y: kickerY, size: fonts.kicker, text: kicker },
        title: { x: box.x, y: titleY, size: titleSize, text: props.unit.n },
        crumb: {
            x: box.x,
            y: titleY + fonts.crumb * 1.45,
            size: crumbSize,
            text: wrapText(crumbText, box.w, crumbSize, 1)[0] ?? '',
        },
    };
});

const blocks = computed(() => seatBlocks(layout.value, props.seats));
const legend = computed(() =>
    props.legend && props.legend.rows.length
        ? legendBlock(layout.value.map, layout.value.legendText, props.legend)
        : null,
);
const asOfText = computed(() => formatAsOf(props.asOf));
const label = computed(
    () =>
        `${props.unit.n} ${LEVEL[props.unit.l]}${header.value.crumb.text ? `, ${header.value.crumb.text}` : ''}`,
);
</script>

<template>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        :viewBox="`0 0 ${layout.w} ${layout.h}`"
        :width="layout.w"
        :height="layout.h"
        role="img"
        :aria-label="label"
    >
        <g
            :font-family="CARD_FONT_FAMILY"
            style="font-variation-settings: 'wdth' 92"
        >
            <rect :width="layout.w" :height="layout.h" :fill="theme.land" />

            <!-- Title block -->
            <text
                :x="header.kicker.x"
                :y="header.kicker.y"
                :font-size="header.kicker.size"
                :fill="theme.muted"
            >
                {{ header.kicker.text }}
            </text>
            <text
                :x="header.title.x"
                :y="header.title.y"
                :font-size="header.title.size"
                font-weight="600"
                :fill="theme.ink"
                style="font-variation-settings: 'wdth' 100"
            >
                {{ header.title.text }}
            </text>
            <text
                :x="header.crumb.x"
                :y="header.crumb.y"
                :font-size="header.crumb.size"
                :fill="theme.ink"
            >
                {{ header.crumb.text }}
            </text>

            <!-- Kenya, with the unit marked -->
            <rect
                :x="layout.inset.x"
                :y="layout.inset.y"
                :width="layout.inset.w"
                :height="layout.inset.h"
                :fill="theme.ground"
            />
            <image
                v-if="insetImage"
                data-inset
                :x="layout.inset.x"
                :y="layout.inset.y"
                :width="layout.inset.w"
                :height="layout.inset.h"
                :href="insetImage"
                :xlink:href="insetImage"
            />
            <rect
                :x="layout.inset.x"
                :y="layout.inset.y"
                :width="layout.inset.w"
                :height="layout.inset.h"
                fill="none"
                :stroke="theme.hairline"
                stroke-width="2"
            />

            <!-- The map -->
            <rect
                :x="layout.map.x"
                :y="layout.map.y"
                :width="layout.map.w"
                :height="layout.map.h"
                :fill="theme.ground"
            />
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
                :font-size="layout.seatFonts.label"
                :fill="theme.muted"
            >
                {{ mapPlaceholder }}
            </text>
            <rect
                :x="layout.map.x"
                :y="layout.map.y"
                :width="layout.map.w"
                :height="layout.map.h"
                fill="none"
                :stroke="theme.hairline"
                stroke-width="2"
            />
            <g v-if="legend" data-legend>
                <rect
                    :x="legend.panel.x"
                    :y="legend.panel.y"
                    :width="legend.panel.w"
                    :height="legend.panel.h"
                    rx="6"
                    :fill="theme.surface"
                    fill-opacity="0.94"
                    :stroke="theme.hairline"
                />
                <text
                    :x="legend.title.x"
                    :y="legend.title.y"
                    :font-size="legend.title.size"
                    :fill="theme.muted"
                >
                    {{ legend.title.text }}
                </text>
                <g v-for="(item, i) in legend.items" :key="i">
                    <rect
                        :x="item.swatch.x"
                        :y="item.swatch.y"
                        :width="item.swatch.w"
                        :height="item.swatch.h"
                        rx="2"
                        :fill="item.swatch.colour"
                        :stroke="theme.hairline"
                    />
                    <text
                        :x="item.label.x"
                        :y="item.label.y"
                        :font-size="item.label.size"
                        :fill="theme.ink"
                    >
                        {{ item.label.text }}
                    </text>
                </g>
            </g>

            <!-- Seats: ballot-lid strip, seat, holder and party -->
            <g v-for="(b, i) in blocks" :key="b.key" :data-seat="seats[i].key">
                <rect
                    :x="b.lid.x"
                    :y="b.lid.y"
                    :width="b.lid.w"
                    :height="b.lid.h"
                    rx="1"
                    :fill="SEAT_COLOURS[seats[i].key]"
                />
                <rect
                    v-if="b.swatch"
                    data-party-swatch
                    :x="b.swatch.x"
                    :y="b.swatch.y"
                    :width="b.swatch.w"
                    :height="b.swatch.h"
                    rx="2"
                    :fill="b.swatch.colour"
                    :stroke="theme.hairline"
                />
                <text
                    v-for="(line, j) in b.lines"
                    :key="j"
                    :x="line.x"
                    :y="line.y"
                    :font-size="line.size"
                    :font-weight="line.weight ?? 400"
                    :fill="tone(line.tone)"
                >
                    {{ line.text }}
                </text>
            </g>

            <CardFooter
                :box="layout.footer"
                :fonts="layout.footerFonts"
                :source="source"
                :as-of="asOfText"
                :url="url"
                :theme="theme"
            />
            <SampleWatermark
                v-if="sample"
                :w="layout.w"
                :h="layout.h"
                :theme="theme"
            />
        </g>
    </svg>
</template>
