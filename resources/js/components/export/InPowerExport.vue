<script setup lang="ts">
// The share dialog for the national "In power now" card.
import { computed } from 'vue';
import ExportDialog from './ExportDialog.vue';
import InPowerCard from './InPowerCard.vue';
import { siteUrl, sourceLine } from '@/lib/export/format';
import { inPowerFilename } from '@/lib/export/sizes';
import type { MapTheme } from '@/lib/map/theme';
import type { SeatsData } from '@/lib/seats';

const props = withDefaults(
    defineProps<{
        seats: SeatsData;
        theme: MapTheme;
        /** Set when the card shows sample records (none today: the holders are real). */
        sample?: boolean;
    }>(),
    { sample: false },
);
const open = defineModel<boolean>('open', { default: false });
const asOf = computed(
    () => props.seats.data_as_of ?? props.seats.as_of ?? null,
);
const url = computed(() => siteUrl('/'));
// The members counted in the two chambers, and the sites their records cite.
const CHAMBER_SEATS = new Set([
    'mp',
    'woman_rep',
    'nominated_mp',
    'senator',
    'nominated_senator',
]);
const source = computed(() =>
    sourceLine(
        props.seats.holders
            .filter((h) => CHAMBER_SEATS.has(h.seat))
            .map((h) => h.source_url),
    ),
);
</script>

<template>
    <ExportDialog
        v-model:open="open"
        title="Share image"
        description="A card of the National Assembly and Senate by party."
        share-title="In power now, Kenya Electoral Map"
        :filename="inPowerFilename"
        :inputs="[theme, seats]"
    >
        <template #default="{ size }">
            <InPowerCard
                :size="size"
                :seats="seats"
                :sample="sample"
                :as-of="asOf"
                :source="source"
                :url="url"
                :theme="theme"
            />
        </template>
    </ExportDialog>
</template>
