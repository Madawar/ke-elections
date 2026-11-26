<script setup lang="ts">
// Footer on every card: source and "as of" date, boundary attribution, site and deep link.
import { computed } from 'vue';
import { type Box, type FooterFonts, footerBlock } from '@/lib/export/layout';
import { ATTRIBUTION, type MapTheme } from '@/lib/map/theme';

const props = defineProps<{
    box: Box;
    fonts: FooterFonts;
    source: string;
    asOf: string | null;
    url: string;
    theme: MapTheme;
}>();

const block = computed(() =>
    footerBlock(props.box, props.fonts, {
        source: props.source,
        asOf: props.asOf,
        attribution: ATTRIBUTION,
        url: props.url,
    }),
);
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
            v-for="(line, i) in block.lines"
            :key="i"
            :x="line.x"
            :y="line.y"
            :font-size="line.size"
            :font-weight="line.weight ?? 400"
            :text-anchor="line.anchor ?? 'start'"
            :fill="line.tone === 'ink' ? theme.ink : theme.muted"
            >{{ line.text }}</text
        >
    </g>
</template>
