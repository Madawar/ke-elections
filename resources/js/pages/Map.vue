<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { useEventListener, useMediaQuery, useStorage } from '@vueuse/core';
import { useAppearance } from '@/composables/useAppearance';
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import AboutSheet from '@/components/map/AboutSheet.vue';
import BottomSheet from '@/components/map/BottomSheet.vue';
import LayersPanel, { type ColourKey } from '@/components/map/LayersPanel.vue';
import Legend from '@/components/map/Legend.vue';
import MapControls from '@/components/map/MapControls.vue';
import MapView from '@/components/map/MapView.vue';
import NationalOverview from '@/components/map/NationalOverview.vue';
import SearchBox from '@/components/map/SearchBox.vue';
import UnitList from '@/components/map/UnitList.vue';
import UnitPanel from '@/components/map/UnitPanel.vue';
import type { Picked } from '@/composables/useMap';
import {
    type Colouring,
    type SeatKey,
    NO_COLOURING,
} from '@/lib/map/colouring';
import { type MapLevel, levelForZoom, zoomOutTarget } from '@/lib/map/levels';
import { findContaining } from '@/lib/map/locate';
import { type MapOverlay, OVERLAYS } from '@/lib/map/overlays';
import { fileUrl } from '@/lib/map/style';
import { OTHER, PROVINCE_TINTS, SEAT_COLOURS, THEMES } from '@/lib/map/theme';
import { unitPath } from '@/lib/map/urls';
import {
    type SeatsData,
    EMPTY_SEATS,
    loadSeats,
    seatColouring,
    seatLegend,
} from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';

type ServerUnit = {
    level: MapLevel;
    code: number;
    name: string;
    ancestors: { level: string; code: number; name: string }[];
} | null;
const props = defineProps<{ unit: ServerUnit }>();

const LEVEL_NAME = {
    province: 'former province',
    county: 'county',
    constituency: 'constituency',
    ward: 'ward',
} as const;
const DEPTH = { province: 0, county: 1, constituency: 2, ward: 3 } as const;
const SEAT_LABEL: Record<SeatKey, string> = {
    governor: 'Governor',
    senator: 'Senator',
    woman_rep: 'Woman Rep',
    mp: 'MP',
    mca: 'MCA',
};

// ---- data -------------------------------------------------------------------------------
const manifest = ref<Record<string, string> | null>(null);
const index = shallowRef<UnitIndex | null>(null);
const seats = shallowRef<SeatsData>(EMPTY_SEATS);
const towns = shallowRef<
    {
        name: string;
        ward_code: number;
        constituency_code: number;
        county_code: number;
        rank: number;
    }[]
>([]);
const loadError = ref<string | null>(null);

const provinceOfCounty = computed(
    () =>
        new Map(
            (index.value?.all() ?? [])
                .filter((u) => u.l === 'county')
                .map((u) => [u.c, u.p ?? 0]),
        ),
);

onMounted(async () => {
    try {
        const m = (await (
            await fetch('/boundaries/manifest.json', { cache: 'no-cache' })
        ).json()) as Record<string, string>;
        const [units, data] = await Promise.all([
            UnitIndex.load(fileUrl(m, 'units.json')),
            loadSeats(),
        ]);
        index.value = units;
        seats.value = data;
        manifest.value = m;
        if (props.unit)
            selectUnit(units.get(props.unit.level, props.unit.code) ?? null, {
                push: false,
                animate: false,
            });
        fetch(fileUrl(m, 'towns.geojson'))
            .then((r) => r.json())
            .then(
                (fc) =>
                    (towns.value = fc.features.map(
                        (f: { properties: never }) => f.properties,
                    )),
            )
            .catch(() => {});
    } catch (e) {
        loadError.value =
            'The map data could not be loaded. Check your connection and reload.';
        console.error(e);
    }
});

// ---- preferences ------------------------------------------------------------------------
// One theme setting for the whole app (the starter kit's appearance cookie + storage), so the
// server renders the right theme and the map follows it.
const { appearance, resolvedAppearance, updateAppearance } = useAppearance();
const theme = computed(() => resolvedAppearance.value);
const themePref = computed({
    get: () => appearance.value,
    set: (v) => updateAppearance(v),
});

const colourKey = useStorage<ColourKey>('km.colour', 'none');
const onlyParties = useStorage<string[]>('km.only', []);
const enabledOverlays = useStorage<string[]>(
    'km.overlays',
    OVERLAYS.filter((o) => o.defaultOn).map((o) => o.id),
);
const overlays = ref<MapOverlay[]>(OVERLAYS);

const seatCount = (seat: SeatKey) =>
    Object.values(seats.value.totals[seat] ?? {}).reduce((a, b) => a + b, 0);
const colourOptions = computed(() => [
    { key: 'none' as const, label: 'Boundaries only', available: true },
    { key: 'province' as const, label: 'Former province', available: true },
    ...(Object.keys(SEAT_LABEL) as SeatKey[]).map((seat) => {
        const n = seatCount(seat);
        return {
            key: seat,
            label: `${SEAT_LABEL[seat]} party`,
            available: n > 0,
            note: n > 0 ? undefined : 'No approved data yet',
            swatch: SEAT_COLOURS[seat],
        };
    }),
]);
watch(colourOptions, (opts) => {
    if (!opts.find((o) => o.key === colourKey.value)?.available)
        colourKey.value = 'none';
});

const colouring = computed<Colouring>(() => {
    const k = colourKey.value;
    if (k === 'none') return NO_COLOURING;
    if (k === 'province')
        return { ...NO_COLOURING, mode: { kind: 'province' } };
    const t = THEMES[theme.value];
    return seatColouring(seats.value, k, {
        noData: t.noData,
        faded: t.hairline,
        only: new Set(onlyParties.value),
    });
});

const legend = computed(() => {
    const k = colourKey.value;
    if (k === 'none') return null;
    if (k === 'province') {
        const provinces = (index.value?.all() ?? [])
            .filter((u) => u.l === 'province')
            .sort((a, b) => a.c - b.c);
        return {
            title: 'Former provinces',
            rows: provinces.map((p) => ({
                key: String(p.c),
                label: p.n,
                colour: PROVINCE_TINTS[(p.c - 1) % PROVINCE_TINTS.length],
            })),
        };
    }
    const rows = seatLegend(seats.value, k);
    const shown = rows.filter((r) => r.colour !== OTHER).slice(0, 7);
    const other = rows
        .filter((r) => !shown.includes(r))
        .reduce((n, r) => n + r.seats, 0);
    const mapped = shown.map((r) => ({
        key: r.abbrev,
        label: r.abbrev === 'IND' ? 'Independent' : r.abbrev,
        colour: r.colour,
        count: r.seats,
    }));
    if (other)
        mapped.push({
            key: 'other',
            label: 'Other and independent',
            colour: OTHER,
            count: other,
        });
    return {
        title: `${SEAT_LABEL[k]} seats by party`,
        rows: mapped,
        note: `Elected 2022, with changes since. Source: IEBC gazette notices${seats.value.as_of ? `, imported ${new Date(seats.value.as_of).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`,
    };
});
const partyChips = computed(() =>
    colourKey.value === 'none' || colourKey.value === 'province'
        ? []
        : seatLegend(seats.value, colourKey.value),
);
const activeSettings = computed(
    () => (colourKey.value !== 'none' ? 1 : 0) + onlyParties.value.length,
);

// ---- selection and camera ---------------------------------------------------------------
const mapRef = ref<InstanceType<typeof MapView> | null>(null);
const selection = shallowRef<Unit | null>(null);
const autoCentre = ref(true);
const unsupported = ref(false);
const announce = ref('');
const isDesktop = useMediaQuery('(min-width: 768px)');
const snap = ref<'peek' | 'half' | 'full'>('peek');
const sheetHeight = ref(112);
const view = ref<'unit' | 'layers' | 'about' | 'list'>('unit');

const boundsOf = (level: MapLevel, code: number) =>
    index.value?.get(level, code)?.b;

function selectUnit(
    unit: Unit | null,
    { push = true, fit = true, animate = true } = {},
) {
    selection.value = unit;
    autoCentre.value = true;
    view.value = 'unit';
    const map = mapRef.value;
    if (!unit) {
        map?.clearSelection();
        if (fit) map?.fitKenya(animate);
        if (push) replaceUrl('/', null);
        document.title = 'Kenya Electoral Map';
        return;
    }
    if (unit.l !== 'province') map?.select(unit.l, unit.c, { fit, animate });
    const ancestors = index.value?.ancestors(unit.l, unit.c) ?? [];
    if (push && unit.l !== 'province')
        replaceUrl(unitPath(unit.l, unit.c), {
            level: unit.l,
            code: unit.c,
            name: unit.n,
            ancestors: ancestors.map((a) => ({
                level: a.l,
                code: a.c,
                name: a.n,
            })),
        });
    announce.value = `Selected: ${unit.n} ${LEVEL_NAME[unit.l]}, ${ancestors.map((a) => a.n).join(', ')}`;
    document.title = `${unit.n} ${unit.l.charAt(0).toUpperCase()}${unit.l.slice(1)} — Kenya Electoral Map`;
    if (!isDesktop.value && snap.value === 'peek') snap.value = 'half';
}

const onPick = (p: Picked) =>
    selectUnit(index.value?.get(p.level, p.code) ?? null);

// The map can mount after the data (or the other way round): apply a pending deep link once both exist.
watch(
    () => mapRef.value?.ready,
    (ready) => {
        if (ready && selection.value && selection.value.l !== 'province')
            mapRef.value?.select(selection.value.l, selection.value.c, {
                fit: true,
                animate: false,
            });
    },
);

/**
 * Keep the address bar on the selected unit so it can be shared. This replaces the current
 * history entry through Inertia (client-side, state preserved) instead of pushing new ones:
 * Inertia remounts the page on Back, which would rebuild the map, so Back leaves the map and
 * the breadcrumb and zoom-out control step back up a level.
 */
function replaceUrl(url: string, unit: ServerUnit) {
    if (location.pathname === url) return;
    router.replace({
        url,
        props: (current) => ({ ...current, unit }),
        preserveState: true,
        preserveScroll: true,
    });
}

function zoomOut() {
    if (!index.value) return;
    const target = zoomOutTarget(
        selection.value
            ? { level: selection.value.l, code: selection.value.c }
            : null,
        (l, c) => index.value!.get(l, c),
    );
    if (target.unit)
        selectUnit(
            index.value.get(target.unit.level, target.unit.code) ?? null,
        );
    else if (selection.value) selectUnit(null);
    else mapRef.value?.zoomOutStep();
}
const zoomOutLabel = computed(() => {
    const s = selection.value;
    if (!s) return 'Zoom out';
    const parent = index.value?.ancestors(s.l, s.c)[0];
    return parent && parent.l !== 'province'
        ? `Zoom out to ${parent.n}`
        : 'Zoom out to all of Kenya';
});

function recentre() {
    autoCentre.value = true;
    const s = selection.value;
    if (s && s.l !== 'province') mapRef.value?.select(s.l, s.c, { fit: true });
    else mapRef.value?.fitKenya();
}

// Auto-centre is the default: when the sheet or the screen changes size, keep the selection
// (or Kenya) in view above the sheet, until the person moves the map by hand.
function applyPadding() {
    const map = mapRef.value;
    if (!map) return;
    map.setPadding(
        isDesktop.value
            ? { left: 380 + 24, bottom: 24, top: 80, right: 72 }
            : {
                  left: 16,
                  right: 64,
                  top: 72,
                  bottom:
                      Math.min(sheetHeight.value, window.innerHeight * 0.6) +
                      16,
              },
    );
}
let recentreTimer = 0;
function scheduleRecentre() {
    applyPadding();
    window.clearTimeout(recentreTimer);
    recentreTimer = window.setTimeout(
        () => autoCentre.value && recentre(),
        200,
    );
}
watch([sheetHeight, isDesktop, () => mapRef.value?.ready], scheduleRecentre);
useEventListener(window, 'resize', scheduleRecentre);

// When the person zooms out past a level, the panel follows to the selection's ancestor at that level.
const panelUnit = computed(() => {
    const s = selection.value;
    const zoom = mapRef.value?.zoom ?? 0;
    if (!s || autoCentre.value || !index.value) return s;
    const level = levelForZoom(zoom);
    if (DEPTH[s.l] <= DEPTH[level]) return s;
    return index.value.ancestors(s.l, s.c).find((a) => a.l === level) ?? s;
});

const townsIn = computed(() => {
    const u = panelUnit.value;
    if (!u || u.l === 'province' || u.l === 'county') return [];
    const key = u.l === 'ward' ? 'ward_code' : 'constituency_code';
    return towns.value
        .filter((t) => t[key] === u.c)
        .sort((a, b) => a.rank - b.rank)
        .map((t) => t.name)
        .slice(0, 12);
});

// ---- find my ward -----------------------------------------------------------------------
const locating = ref(false);
const locateMessage = ref('');
async function locate() {
    if (!navigator.geolocation || !manifest.value) {
        locateMessage.value = 'This device cannot share its location.';
        return;
    }
    locating.value = true;
    locateMessage.value = '';
    navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
            try {
                const wards = await (
                    await fetch(fileUrl(manifest.value!, 'wards.geojson'))
                ).json();
                const code = findContaining(wards.features, [
                    coords.longitude,
                    coords.latitude,
                ]);
                if (code) selectUnit(index.value?.get('ward', code) ?? null);
                else
                    locateMessage.value =
                        'Your location is outside Kenya’s wards.';
            } finally {
                locating.value = false;
            }
        },
        () => {
            locating.value = false;
            locateMessage.value = 'Location was not shared.';
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
}

// ---- hover tooltip (devices with a mouse) -----------------------------------------------
const tip = ref<{ text: string; x: number; y: number } | null>(null);
function onHover(p: Picked | null, point: { x: number; y: number }) {
    const u = p && index.value?.get(p.level, p.code);
    tip.value = u
        ? { text: `${u.n} ${LEVEL_NAME[u.l]}`, x: point.x, y: point.y }
        : null;
}

const title = computed(() => (panelUnit.value ? panelUnit.value.n : 'Kenya'));
const subtitle = computed(() => {
    const u = panelUnit.value;
    if (!u) return '47 counties, 290 constituencies, 1,450 wards';
    const parent = index.value
        ?.ancestors(u.l, u.c)
        .find((a) => a.l !== 'province');
    return parent
        ? `${LEVEL_NAME[u.l].replace(/^./, (c) => c.toUpperCase())} in ${parent.n}`
        : LEVEL_NAME[u.l].replace(/^./, (c) => c.toUpperCase());
});
const headTitle = computed(() =>
    props.unit
        ? `${props.unit.name} ${props.unit.level.charAt(0).toUpperCase()}${props.unit.level.slice(1)}`
        : '',
);
const showView = (v: typeof view.value) => {
    view.value = view.value === v ? 'unit' : v;
    if (!isDesktop.value && snap.value === 'peek') snap.value = 'half';
};
</script>

<template>
    <Head :title="headTitle" />
    <div class="km-app fixed inset-0 overflow-hidden">
        <MapView
            v-if="manifest && index && !unsupported"
            ref="mapRef"
            :manifest="manifest"
            :province-of-county="provinceOfCounty"
            :bounds-of="boundsOf"
            :theme="theme"
            :colouring="colouring"
            :overlays="overlays"
            :enabled-overlays="enabledOverlays"
            @select="onPick"
            @hover="onHover"
            @unsupported="
                unsupported = true;
                view = 'list';
            "
            @user-move="autoCentre = false"
        />
        <p
            v-if="loadError"
            class="absolute inset-x-4 top-24 rounded-md border border-hairline bg-surface p-3 text-[15px]"
        >
            {{ loadError }}
        </p>

        <!-- Search: top on phones, above the map to the right of the panel on desktop -->
        <div
            class="absolute top-3 right-3 left-3 z-20 flex gap-2 md:left-[400px] md:max-w-md"
        >
            <SearchBox :index="index" @pick="(u) => selectUnit(u)" />
            <button
                type="button"
                class="relative flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[15px] text-ink shadow-sm"
                :aria-pressed="view === 'layers'"
                @click="showView('layers')"
            >
                <svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
                    <path
                        d="M10 3 2 7l8 4 8-4-8-4ZM2 11l8 4 8-4M2 14.5l8 4 8-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linejoin="round"
                    />
                </svg>
                <span class="hidden sm:inline">Map</span>
                <span
                    v-if="activeSettings"
                    class="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-surface tabular-nums"
                    >{{ activeSettings }}</span
                >
            </button>
        </div>

        <div
            class="absolute right-3 z-10 transition-[bottom] duration-200"
            :style="{
                bottom: isDesktop
                    ? '24px'
                    : `${Math.min(sheetHeight, 9999) + 12}px`,
            }"
        >
            <MapControls
                :can-zoom-out="true"
                :zoom-out-label="zoomOutLabel"
                :show-recentre="!autoCentre"
                :locating="locating"
                @zoom-in="
                    autoCentre = false;
                    mapRef?.zoomIn();
                "
                @zoom-out="zoomOut"
                @recentre="recentre"
                @locate="locate"
            />
        </div>

        <div
            v-if="legend && !(snap === 'full' && !isDesktop)"
            class="absolute left-3 z-10 md:left-[396px]"
            :style="{ bottom: isDesktop ? '24px' : `${sheetHeight + 12}px` }"
        >
            <Legend
                :title="legend.title"
                :rows="legend.rows"
                :note="legend.note"
                :collapsed="!isDesktop"
            />
        </div>

        <div
            v-if="tip"
            class="pointer-events-none absolute z-30 rounded-[4px] bg-ink px-2 py-1 text-[13px] text-surface"
            :style="{ left: `${tip.x + 12}px`, top: `${tip.y + 12}px` }"
        >
            {{ tip.text }}
        </div>

        <BottomSheet v-model:snap="snap" @height="(h) => (sheetHeight = h)">
            <template #header>
                <div class="flex items-start gap-2 pb-2">
                    <div class="min-w-0 flex-1">
                        <h1
                            class="truncate text-[20px] leading-tight font-semibold text-ink"
                            style="font-variation-settings: 'wdth' 100"
                        >
                            {{
                                view === 'layers'
                                    ? 'Map settings'
                                    : view === 'about'
                                      ? 'About this map'
                                      : view === 'list'
                                        ? 'All counties'
                                        : title
                            }}
                        </h1>
                        <p
                            v-if="view === 'unit'"
                            class="truncate text-[14px] text-muted-ink"
                        >
                            {{ subtitle }}
                        </p>
                    </div>
                    <button
                        v-if="view !== 'unit'"
                        type="button"
                        class="min-h-11 px-2 text-[14px] underline underline-offset-4"
                        @click="view = 'unit'"
                    >
                        Done
                    </button>
                    <template v-else>
                        <button
                            type="button"
                            class="min-h-11 px-2 text-[14px] text-muted-ink underline underline-offset-4"
                            @click="showView('list')"
                        >
                            List
                        </button>
                        <button
                            type="button"
                            class="min-h-11 px-2 text-[14px] text-muted-ink underline underline-offset-4"
                            @click="showView('about')"
                        >
                            About
                        </button>
                    </template>
                </div>
                <p v-if="locateMessage" class="pb-2 text-[13px] text-muted-ink">
                    {{ locateMessage }}
                </p>
                <p v-if="unsupported" class="pb-2 text-[13px] text-muted-ink">
                    This device can't draw the map, so here is the list of every
                    unit instead.
                </p>
            </template>

            <LayersPanel
                v-if="view === 'layers'"
                v-model:colour="colourKey"
                v-model:only="onlyParties"
                v-model:enabled="enabledOverlays"
                v-model:theme="themePref"
                :colour-options="colourOptions"
                :parties="partyChips"
                :overlays="overlays"
                :swatch-for="(o) => o.swatch?.(THEMES[theme])"
            />
            <AboutSheet v-else-if="view === 'about'" />
            <UnitList
                v-else-if="view === 'list' && index"
                :index="index"
                @pick="(u) => selectUnit(u)"
            />
            <template v-else-if="index">
                <UnitPanel
                    v-if="panelUnit"
                    :unit="panelUnit"
                    :index="index"
                    :seats="seats"
                    :towns="townsIn"
                    @go="(u) => selectUnit(u)"
                />
                <NationalOverview
                    v-else
                    :seats="seats"
                    @colour-by="(s) => (colourKey = s)"
                />
            </template>
        </BottomSheet>

        <div class="sr-only" aria-live="polite">{{ announce }}</div>
    </div>
</template>
