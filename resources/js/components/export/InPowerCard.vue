<script setup lang="ts">
// "In power now" card: the National Assembly and Senate by party, seat by seat, laid out with
// the same hemicycle geometry as the on-screen chart (lib/hemicycle.ts).
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import { type ChamberLayout, inPowerLayout } from '@/lib/export/layout';
import type { CardSize } from '@/lib/export/sizes';
import { textWidth, wrapText } from '@/lib/export/text';
import { layoutHemicycle } from '@/lib/hemicycle';
import { type MapTheme, THEMES } from '@/lib/map/theme';
import { type SeatsData, chamberGroups } from '@/lib/seats';

const props = withDefaults(
    defineProps<{
        size: CardSize;
        seats: SeatsData;
        sample: boolean;
        /** Date the data describes, "YYYY-MM-DD". */
        asOf: string | null;
        url: string;
        source?: string;
        theme?: MapTheme;
    }>(),
    {
        source: 'IEBC gazette notices',
        theme: () => THEMES.light,
    },
);

// Seats per chamber, not counting the Speakers (as on the national overview).
const CHAMBERS = [
    { key: 'national_assembly', title: 'National Assembly', total: 349 },
    { key: 'senate', title: 'Senate', total: 67 },
] as const;

const layout = computed(() => inPowerLayout(props.size));

const header = computed(() => {
    const { header: box, fonts, subLines } = layout.value;
    const sub = wrapText(
        'Seats in Parliament by party: elected in 2022, with by-elections and changes since. The Speakers are not counted.',
        box.w,
        fonts.sub,
        subLines,
    );
    const titleY = box.y + fonts.title * 0.9;
    return {
        title: { x: box.x, y: titleY, size: fonts.title },
        sub: sub.map((text, i) => ({
            x: box.x,
            y: titleY + fonts.sub * 1.6 + i * fonts.sub * 1.35,
            size: fonts.sub,
            text: i < sub.length - 1 ? `${text} ` : text,
        })),
    };
});

function chamber(def: (typeof CHAMBERS)[number], place: ChamberLayout) {
    const groups = chamberGroups(props.seats, def.key);
    const assigned = groups.reduce((n, g) => n + Math.max(0, g.seats), 0);
    const total = Math.max(assigned, def.total);
    const vacant = total - assigned;
    const fills = groups.flatMap((g) =>
        Array<string | null>(Math.max(0, g.seats)).fill(g.colour),
    );
    const seats = layoutHemicycle(total).map((s, i) => ({
        ...s,
        colour: fills[i] ?? null,
    }));

    const rows = [
        ...groups.map((g) => ({
            key: g.key,
            label: g.label,
            short: g.key === 'other' ? 'Others' : g.key,
            seats: g.seats,
            colour: g.colour as string | null,
        })),
        ...(vacant > 0
            ? [
                  {
                      key: '__no-data',
                      label: 'No data',
                      short: 'No data',
                      seats: vacant,
                      colour: null,
                  },
              ]
            : []),
    ];
    const { legend: box, legendCols: cols, legendText: size } = place;
    const perCol = Math.max(1, Math.ceil(rows.length / cols));
    const rowH = Math.min(size * 1.7, box.h / perCol);
    const colW = box.w / cols;
    const sw = Math.round(size * 0.72);
    const room = (r: (typeof rows)[number]) =>
        colW - sw - size * 0.5 - textWidth(String(r.seats), size, true) - size;
    // Full party names only when every one of them fits; otherwise abbreviations throughout.
    const full = rows.every((r) => textWidth(r.label, size) <= room(r));
    const legend = rows.map((r, i) => {
        const col = Math.floor(i / perCol);
        const x = box.x + col * colW;
        const baseline = box.y + (i % perCol) * rowH + size;
        const count = String(r.seats);
        const text = full
            ? r.label
            : (wrapText(r.short, room(r), size, 1)[0] ?? r.short);
        return {
            key: r.key,
            colour: r.colour,
            swatch: { x, y: baseline - sw + size * 0.04, s: sw },
            label: { x: x + sw + size * 0.5, y: baseline, text },
            count: { x: x + colW - size, y: baseline, text: count },
        };
    });
    return {
        ...def,
        place,
        seatTotal: total,
        majority: Math.floor(total / 2) + 1,
        seats,
        legend,
        size,
    };
}

const chambers = computed(() =>
    CHAMBERS.map((def, i) => chamber(def, layout.value.chambers[i])),
);
const asOfText = computed(() => formatAsOf(props.asOf));
const label = computed(() =>
    chambers.value
        .map(
            (c) =>
                `${c.title}, ${c.seatTotal} seats: ${c.legend.map((r) => `${r.label.text} ${r.count.text}`).join(', ')}`,
        )
        .join('. '),
);
</script>

<template>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        :viewBox="`0 0 ${layout.w} ${layout.h}`"
        :width="layout.w"
        :height="layout.h"
        role="img"
        :aria-label="`In power now. ${label}`"
    >
        <g
            :font-family="CARD_FONT_FAMILY"
            style="font-variation-settings: 'wdth' 92"
        >
            <rect :width="layout.w" :height="layout.h" :fill="theme.land" />
            <text
                :x="header.title.x"
                :y="header.title.y"
                :font-size="header.title.size"
                font-weight="600"
                :fill="theme.ink"
                style="font-variation-settings: 'wdth' 100"
            >
                In power now
            </text>
            <text
                v-for="(line, i) in header.sub"
                :key="i"
                :x="line.x"
                :y="line.y"
                :font-size="line.size"
                :fill="theme.muted"
            >
                {{ line.text }}
            </text>

            <g v-for="c in chambers" :key="c.key" :data-chamber="c.key">
                <text
                    :x="c.place.heading.x"
                    :y="c.place.heading.y + c.place.headingText"
                    :font-size="c.place.headingText"
                    font-weight="600"
                    :fill="theme.ink"
                >
                    {{ c.title }}
                </text>
                <text
                    :x="c.place.heading.x + c.place.heading.w"
                    :y="c.place.heading.y + c.place.headingText"
                    :font-size="c.place.statText"
                    text-anchor="end"
                    :fill="theme.muted"
                >
                    {{ c.seatTotal }} seats. Majority: {{ c.majority }}
                </text>
                <svg
                    :x="c.place.chart.x"
                    :y="c.place.chart.y"
                    :width="c.place.chart.w"
                    :height="c.place.chart.h"
                    viewBox="-1 0 2 1"
                >
                    <template v-for="(s, i) in c.seats" :key="i">
                        <circle
                            v-if="s.colour"
                            :cx="s.x"
                            :cy="1 - s.y"
                            :r="s.r"
                            :fill="s.colour"
                        />
                        <circle
                            v-else
                            data-vacant
                            :cx="s.x"
                            :cy="1 - s.y"
                            :r="s.r * 0.85"
                            :stroke-width="s.r * 0.3"
                            fill="none"
                            :stroke="theme.muted"
                        />
                    </template>
                </svg>
                <g v-for="row in c.legend" :key="row.key">
                    <rect
                        v-if="row.colour"
                        :x="row.swatch.x"
                        :y="row.swatch.y"
                        :width="row.swatch.s"
                        :height="row.swatch.s"
                        :rx="row.swatch.s / 2"
                        :fill="row.colour"
                    />
                    <rect
                        v-else
                        :x="row.swatch.x + 1.5"
                        :y="row.swatch.y + 1.5"
                        :width="row.swatch.s - 3"
                        :height="row.swatch.s - 3"
                        :rx="(row.swatch.s - 3) / 2"
                        fill="none"
                        :stroke="theme.muted"
                        stroke-width="3"
                    />
                    <text
                        :x="row.label.x"
                        :y="row.label.y"
                        :font-size="c.size"
                        :fill="theme.ink"
                    >
                        {{ row.label.text }}
                    </text>
                    <text
                        :x="row.count.x"
                        :y="row.count.y"
                        :font-size="c.size"
                        font-weight="600"
                        text-anchor="end"
                        :fill="theme.ink"
                        style="font-variant-numeric: tabular-nums"
                    >
                        {{ row.count.text }}
                    </text>
                </g>
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
