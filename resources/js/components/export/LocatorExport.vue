<script setup lang="ts">
// The share dialog for one unit's locator card, with its map drawn off-screen in the current
// colouring and theme.
import { computed } from 'vue';
import ExportDialog from './ExportDialog.vue';
import LocatorCard from './LocatorCard.vue';
import { siteUrl, sourceLine } from '@/lib/export/format';
import { locatorLayout, legendBlock } from '@/lib/export/layout';
import {
    cardSeats,
    mapLegend,
    renderLocatorImages,
} from '@/lib/export/locator';
import { type CardSize, exportFilename } from '@/lib/export/sizes';
import type { Colouring } from '@/lib/map/colouring';
import type { MapLevel } from '@/lib/map/levels';
import { type MapTheme } from '@/lib/map/theme';
import { unitPath } from '@/lib/map/urls';
import type { SeatsData } from '@/lib/seats';
import type { Unit, UnitIndex } from '@/lib/units';

const props = withDefaults(
    defineProps<{
        unit: Unit & { l: MapLevel };
        index: UnitIndex;
        seats: SeatsData;
        manifest: Record<string, string>;
        provinceOfCounty: Map<number, number>;
        theme: MapTheme;
        colouring: Colouring;
        /** Set when the card shows sample records (none today: the holders are real). */
        sample?: boolean;
    }>(),
    { sample: false },
);
const open = defineModel<boolean>('open', { default: false });

const LEVEL = { county: 'county', constituency: 'constituency', ward: 'ward' };
const ancestors = computed(() =>
    props.index.ancestors(props.unit.l, props.unit.c),
);
const rows = computed(() => cardSeats(props.seats, props.unit));
const legend = computed(() =>
    mapLegend(props.seats, props.index, props.unit, props.colouring),
);
const countyCode = computed(() =>
    props.unit.l === 'county'
        ? props.unit.c
        : (ancestors.value.find((a) => a.l === 'county')?.c ?? 0),
);
const url = computed(() => siteUrl(unitPath(props.unit.l, props.unit.c)));
const asOf = computed(
    () => props.seats.data_as_of ?? props.seats.as_of ?? null,
);
// Credit the sites the shown holders actually come from.
const source = computed(() =>
    sourceLine(
        rows.value.flatMap((r) => (r.holder ? [r.holder.sourceUrl] : [])),
    ),
);
const name = computed(() => `${props.unit.n} ${LEVEL[props.unit.l]}`);

function prepare(size: CardSize) {
    const layout = locatorLayout(size, rows.value.length);
    const legendHeight = legend.value?.rows.length
        ? legendBlock(layout.map, layout.legendText, legend.value).panel.h +
          Math.round(layout.legendText * 0.7)
        : 0;
    return renderLocatorImages(
        {
            manifest: props.manifest,
            provinceOfCounty: props.provinceOfCounty,
            theme: props.theme,
            colouring: props.colouring,
        },
        props.unit,
        countyCode.value,
        { map: layout.map, inset: layout.inset, legendHeight },
    ) as Promise<Record<string, string | undefined>>;
}
</script>

<template>
    <ExportDialog
        v-model:open="open"
        title="Share image"
        :description="`A card showing where ${name} is and who holds its seats.`"
        :share-title="`${name}, Kenya Electoral Map`"
        :filename="(s) => exportFilename(unit.l, unit.c, s)"
        :prepare="prepare"
        :inputs="[unit, theme, colouring, seats]"
    >
        <template #default="{ size, images, mapStatus }">
            <LocatorCard
                :size="size"
                :unit="unit"
                :ancestors="ancestors"
                :seats="rows"
                :map-image="images.map ?? null"
                :inset-image="images.inset ?? null"
                :map-placeholder="mapStatus"
                :legend="legend"
                :sample="sample"
                :as-of="asOf"
                :source="source"
                :url="url"
                :theme="theme"
            />
        </template>
    </ExportDialog>
</template>
