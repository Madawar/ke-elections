<script setup lang="ts">
// "Who represents this ward": the five people elected for one ward on three ballot papers (the
// county's three seats, the MP, the MCA), each with a small map of where the seat is. Drawn as SVG
// at the card's pixel size, shown as the live preview and rasterised to PNG, in the same look as
// the other share cards: their strip, headline and footer. The layout places everything; this
// only draws it.
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import type { BallotsCardView } from '@/lib/export/ballotsCard';
import { ballotsLayout } from '@/lib/export/ballotsLayout';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import type { ViewSize } from '@/lib/export/sizes';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        view: BallotsCardView;
        size: ViewSize;
        headline: string;
        /** The three maps by slot key: "county", "constituency", "ward". */
        mapImages?: Record<string, string>;
        /** The card's deep link. */
        url: string;
        theme?: MapTheme;
        /** Shown in a map's place while it is drawn. */
        mapPlaceholder?: string;
        // The share dialog gives every card these; this card's maps come in `mapImages`.
        mapImage?: string | null;
        mapAspect?: number;
    }>(),
    {
        mapImages: () => ({}),
        theme: () => THEMES.dark,
        mapPlaceholder: 'Drawing the map…',
    },
);

const layout = computed(() =>
    ballotsLayout(props.size, props.view, {
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

            <!-- Three papers: the county's three seats, the MP, the MCA -->
            <g v-for="p in layout.papers" :key="p.key" :data-paper="p.key">
                <rect
                    data-paper-box
                    :x="p.box.x + 0.5"
                    :y="p.box.y + 0.5"
                    :width="p.box.w - 1"
                    :height="p.box.h - 1"
                    :fill="theme.surface"
                    :stroke="theme.hairline"
                    stroke-width="1"
                />
                <rect
                    v-for="(r, i) in p.rules"
                    :key="`r${i}`"
                    :x="r.x"
                    :y="r.y"
                    :width="r.w"
                    :height="r.h"
                    :fill="theme.hairline"
                />
                <g v-for="s in p.seats" :key="s.seat" :data-seat="s.seat">
                    <rect
                        :x="s.edge.x"
                        :y="s.edge.y"
                        :width="s.edge.w"
                        :height="s.edge.h"
                        :fill="s.edge.colour"
                    />
                    <!-- "Governor" then the place, on one line: the browser sets the gap -->
                    <text
                        v-if="s.titleInline"
                        data-title
                        :x="s.title[0].x"
                        :y="s.title[0].y"
                        :font-size="s.title[0].size"
                        ><tspan
                            v-for="(t, i) in s.title"
                            :key="i"
                            :dx="i ? s.titleGap : undefined"
                            :font-weight="t.weight ?? 400"
                            :fill="tone(t.tone)"
                            >{{ t.text }}</tspan
                        ></text
                    >
                    <template v-else>
                        <text
                            v-for="(t, i) in s.title"
                            :key="`t${i}`"
                            :data-title="i === 0 ? '' : undefined"
                            :x="t.x"
                            :y="t.y"
                            :font-size="t.size"
                            :font-weight="t.weight ?? 400"
                            :fill="tone(t.tone)"
                        >
                            {{ t.text }}
                        </text>
                    </template>
                    <text
                        v-for="(t, i) in s.name"
                        :key="`n${i}`"
                        :data-name="s.vacant ? undefined : ''"
                        :data-vacant="s.vacant ? '' : undefined"
                        :x="t.x"
                        :y="t.y"
                        :font-size="t.size"
                        :font-weight="t.weight ?? 400"
                        :fill="tone(t.tone)"
                    >
                        {{ t.text }}
                    </text>
                    <rect
                        v-if="s.chip"
                        data-chip
                        :x="s.chip.x"
                        :y="s.chip.y"
                        :width="s.chip.w"
                        :height="s.chip.h"
                        rx="2"
                        :fill="s.chip.colour"
                    />
                    <text
                        v-for="(t, i) in s.party"
                        :key="`p${i}`"
                        data-party
                        :x="t.x"
                        :y="t.y"
                        :font-size="t.size"
                        :fill="theme.muted"
                        ><tspan v-if="t.strong" :fill="theme.ink">{{
                            t.strong
                        }}</tspan
                        >{{
                            t.strong ? t.text.slice(t.strong.length) : t.text
                        }}</text
                    >
                    <text
                        v-if="s.since"
                        data-since
                        :x="s.since.x"
                        :y="s.since.y"
                        :font-size="s.since.size"
                        :fill="theme.muted"
                    >
                        {{ s.since.text }}
                    </text>
                </g>
                <image
                    v-if="mapImages[p.key]"
                    :data-map="p.key"
                    :x="p.map.x"
                    :y="p.map.y"
                    :width="p.map.w"
                    :height="p.map.h"
                    :href="mapImages[p.key]"
                    :xlink:href="mapImages[p.key]"
                />
                <text
                    v-else
                    :x="p.map.x + p.map.w / 2"
                    :y="p.map.y + p.map.h / 2"
                    text-anchor="middle"
                    :font-size="layout.footerFonts.small"
                    :fill="theme.muted"
                >
                    {{ mapPlaceholder }}
                </text>
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
