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
/**
 * The footer's lines as they are without a page text; the link joined by its page text (drawn in
 * one text element) is taken out of them and drawn on its own, with the page text in it.
 */
const page = computed(() => block.value.page);
const linkIndex = computed(() => (page.value?.joins ? block.value.lines.length - 1 : -1));
const plain = computed(() => block.value.lines.filter((_, i) => i !== linkIndex.value));
// Lists, not v-if, so a card outside a series has no placeholder in its markup.
const joined = computed(() =>
    linkIndex.value >= 0 ? [block.value.lines[linkIndex.value]] : [],
);
/** The page text where it stands apart from the link (in the brand's place). */
const separate = computed(() =>
    page.value && !page.value.joins ? [page.value] : [],
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
            v-for="(line, i) in plain"
            :key="i"
            :x="line.x"
            :y="line.y"
            :font-size="line.size"
            :font-weight="line.weight ?? 400"
            :text-anchor="line.anchor ?? 'start'"
            :fill="line.tone === 'ink' ? theme.ink : theme.muted"
            >{{ line.text }}</text
        >
        <text
            v-for="line in joined"
            :key="`link-${line.text}`"
            data-link
            :x="line.x"
            :y="line.y"
            :font-size="line.size"
            :font-weight="line.weight ?? 400"
            :text-anchor="line.anchor ?? 'start'"
            :fill="line.tone === 'ink' ? theme.ink : theme.muted"
            ><tspan
                v-if="page?.joins === 'before'"
                data-page
                font-weight="400"
                :fill="theme.muted"
                >{{ page.text }}</tspan
            ><tspan :dx="page?.joins === 'before' ? page.gap : undefined">{{
                line.text
            }}</tspan
            ><tspan
                v-if="page?.joins === 'after'"
                data-page
                font-weight="400"
                :fill="theme.muted"
                :dx="page.gap"
                >{{ page.text }}</tspan
            ></text
        >
        <text
            v-for="p in separate"
            :key="`page-${p.text}`"
            data-page
            :x="p.x"
            :y="p.y"
            :font-size="p.size"
            font-weight="400"
            :text-anchor="p.anchor ?? 'start'"
            :fill="theme.muted"
            >{{ p.text }}</text
        >
    </g>
</template>
