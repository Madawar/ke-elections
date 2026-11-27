<script setup lang="ts">
// Footer on every card: source and "as of" date, the credits for what the card uses, site and
// deep link.
import { computed } from 'vue';
import { type Box, type FooterFonts, footerBlock } from '@/lib/export/layout';
import { ATTRIBUTION, type MapTheme } from '@/lib/map/theme';

const props = withDefaults(
    defineProps<{
        box: Box;
        fonts: FooterFonts;
        source: string;
        asOf: string | null;
        url: string;
        theme: MapTheme;
        /** The credit line: every map credit unless the card uses less (it was measured with it). */
        attribution?: string;
        /**
         * A slide's place in its series ("2 of 4"), on the link's line; a card outside a series
         * has none and its footer is drawn exactly as before.
         */
        page?: string;
    }>(),
    { attribution: ATTRIBUTION },
);

const block = computed(() =>
    footerBlock(props.box, props.fonts, {
        source: props.source,
        asOf: props.asOf,
        attribution: props.attribution,
        url: props.url,
        page: props.page,
    }),
);
/** The footer's lines, and the page text after them when there is one. */
const texts = computed(() => [
    ...block.value.lines.map((line) => ({ ...line, page: false })),
    ...(block.value.page ? [{ ...block.value.page, page: true }] : []),
]);
</script>

<template>
    <g data-footer>
        <line
            :x1="box.x"
            :x2="box.x + box.w"
            :y1="block.rule"
            :y2="block.rule"
            :stroke="theme.hairline"
            stroke-width="2"
        />
        <text
            v-for="(line, i) in texts"
            :key="i"
            :x="line.x"
            :y="line.y"
            :font-size="line.size"
            :font-weight="line.weight ?? 400"
            :text-anchor="line.anchor ?? 'start'"
            :fill="line.tone === 'ink' ? theme.ink : theme.muted"
            :data-page="line.page ? '' : undefined"
            >{{ line.text }}</text
        >
    </g>
</template>
