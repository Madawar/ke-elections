<script setup lang="ts">
// "Kenya, five ways": the map of Kenya once per elected seat, in ballot order, each coloured by
// party, with one shared key. Drawn as SVG at the card's pixel size, shown as the live preview and
// rasterised to PNG, in the same look as the other share cards: their strip, headline and footer.
// Each map is its slot's image (`mapImages`, by seat), drawn by the share dialog.
import { computed } from 'vue';
import CardFooter from './CardFooter.vue';
import SampleWatermark from './SampleWatermark.vue';
import type { FiveSeatsCardView } from '@/lib/export/fiveSeatsCard';
import { fiveSeatsLayout } from '@/lib/export/fiveSeatsLayout';
import { CARD_FONT_FAMILY } from '@/lib/export/fonts';
import { formatAsOf } from '@/lib/export/format';
import type { ViewSize } from '@/lib/export/sizes';
import { type MapTheme, SEAT_COLOURS, THEMES } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        view: FiveSeatsCardView;
        size: ViewSize;
        headline: string;
        /** The five maps, by seat, as they are drawn. */
        mapImages?: Record<string, string>;
        /** Shown in a map's place while it is drawn. */
        mapPlaceholder?: string;
        /** The card's deep link. */
        url: string;
        theme?: MapTheme;
        // The share dialog gives every card these; this card's maps are its five slots.
        mapImage?: string | null;
        mapAspect?: number;
    }>(),
    {
        theme: () => THEMES.dark,
        mapImages: () => ({}),
        mapPlaceholder: 'Drawing the map…',
    },
);

const layout = computed(() =>
    fiveSeatsLayout(props.size, props.view, {
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

            <!-- One cell per seat, in ballot order -->
            <g v-for="m in layout.maps" :key="m.seat" :data-seat="m.seat">
                <rect
                    :x="m.rule.x"
                    :y="m.rule.y"
                    :width="m.rule.w"
                    :height="m.rule.h"
                    :fill="m.rule.colour"
                />
                <text
                    v-for="(t, i) in m.title"
                    :key="i"
                    :x="t.x"
                    :y="t.y"
                    :font-size="t.size"
                    :font-weight="t.weight ?? 400"
                    :fill="tone(t.tone)"
                >
                    {{ t.text }}
                </text>
                <image
                    v-if="mapImages[m.seat]"
                    :data-map="m.seat"
                    :x="m.box.x"
                    :y="m.box.y"
                    :width="m.box.w"
                    :height="m.box.h"
                    :href="mapImages[m.seat]"
                    :xlink:href="mapImages[m.seat]"
                />
                <text
                    v-else
                    :x="m.box.x + m.box.w / 2"
                    :y="m.box.y + m.box.h / 2"
                    text-anchor="middle"
                    :font-size="layout.key.note[0]?.size ?? 18"
                    :fill="theme.muted"
                >
                    {{ mapPlaceholder }}
                </text>
            </g>

            <!-- The shared key -->
            <g data-key>
                <rect
                    :x="layout.key.rule.x"
                    :y="layout.key.rule.y"
                    :width="layout.key.rule.w"
                    :height="layout.key.rule.h"
                    :fill="theme.hairline"
                />
                <text
                    v-for="(t, i) in layout.key.title"
                    :key="`t${i}`"
                    :x="t.x"
                    :y="t.y"
                    :font-size="t.size"
                    font-weight="700"
                    :fill="theme.ink"
                >
                    {{ t.text }}
                </text>
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
                        :stroke="e.key === 'none' ? theme.hairline : undefined"
                    />
                    <text
                        :x="e.label.x"
                        :y="e.label.y"
                        :font-size="e.label.size"
                        :fill="tone(e.label.tone)"
                    >
                        {{ e.label.text }}
                    </text>
                </g>
                <text
                    v-if="layout.key.note.length"
                    data-key-note
                    :font-size="layout.key.note[0].size"
                    :fill="theme.muted"
                >
                    <tspan
                        v-for="(line, i) in layout.key.note"
                        :key="i"
                        :x="line.x"
                        :y="line.y"
                        >{{
                            i < layout.key.note.length - 1
                                ? `${line.text} `
                                : line.text
                        }}</tspan
                    >
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
