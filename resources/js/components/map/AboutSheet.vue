<script setup lang="ts">
import { ATTRIBUTION } from '@/lib/map/theme';
</script>

<template>
    <div class="space-y-3 text-[14px] text-ink">
        <p>
            A neutral map of Kenya's 47 counties, 290 constituencies and 1,450
            wards. Every unit is identified by its IEBC code.
        </p>
        <p>
            Office holders come from IEBC gazette notices of the 2022 results,
            checked against parliament.go.ke and the Council of Governors, with
            by-elections and changes since. Each seat links to its source.
        </p>
        <p>
            Party colours only tell parties apart on the map. They are not the
            parties' own colours.
        </p>
        <p class="text-[13px] text-muted-ink">{{ ATTRIBUTION }}</p>
    </div>
</template>
