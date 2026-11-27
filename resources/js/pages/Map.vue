<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { useEventListener, useMediaQuery, useStorage } from '@vueuse/core';
import { useAppearance } from '@/composables/useAppearance';
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    shallowRef,
    watch,
} from 'vue';
import InPowerExport from '@/components/export/InPowerExport.vue';
import LocatorExport from '@/components/export/LocatorExport.vue';
import ShareViewDialog from '@/components/export/ShareViewDialog.vue';
import AboutSheet from '@/components/map/AboutSheet.vue';
import BackButton from '@/components/map/BackButton.vue';
import BottomSheet from '@/components/map/BottomSheet.vue';
import LayersPanel from '@/components/map/LayersPanel.vue';
import Legend from '@/components/map/Legend.vue';
import MapControls from '@/components/map/MapControls.vue';
import MapView from '@/components/map/MapView.vue';
import NationalOverview from '@/components/map/NationalOverview.vue';
import Onboarding from '@/components/map/Onboarding.vue';
import PartyPanel from '@/components/map/PartyPanel.vue';
import OutsideHint, {
    hintText,
    markHintUsed,
} from '@/components/map/OutsideHint.vue';
import SearchBox from '@/components/map/SearchBox.vue';
import SeatChips from '@/components/map/SeatChips.vue';
import UnitList from '@/components/map/UnitList.vue';
import UnitPanel from '@/components/map/UnitPanel.vue';
import type { Picked } from '@/composables/useMap';
import {
    LEVEL_NAME,
    announcePerson,
    announceSelection,
} from '@/lib/map/announce';
import { CHIPS_BESIDE_SEARCH, mapPadding } from '@/lib/map/camera';
import {
    COUNTY_SEATS,
    COUNTY_SEAT_KEYS,
    type ColourKey,
    type Colouring,
    type SeatKey,
    NO_COLOURING,
    isSeatMode as isSeatColouring,
} from '@/lib/map/colouring';
import {
    CONSTITUENCY_MIN_ZOOM,
    FADE,
    type MapLevel,
    zoomOutTarget,
} from '@/lib/map/levels';
import {
    type RememberedModes,
    chipStepUp,
    modeForFocus,
    rememberLevel,
    validSeatModes,
} from '@/lib/map/seatMode';
import type { FocusSelection } from '@/lib/map/focus';
import {
    type FocusHistory,
    type FocusHistoryPort,
    type HistoryCause,
    type RestoreOptions,
    createFocusHistory,
    gatePopState,
} from '@/lib/map/history';
import {
    type LeaderRow,
    leaderSources,
    leadersFor,
    legendOmits,
} from '@/lib/leaders';
import { findContaining } from '@/lib/map/locate';
import { type MapOverlay, OVERLAYS } from '@/lib/map/overlays';
import { fileUrl } from '@/lib/map/style';
import { type PersonResult, SEAT_TITLE } from '@/lib/search';
import { SEAT_COLOURS, THEMES } from '@/lib/map/theme';
import { formatAsOf } from '@/lib/export/format';
import { leadersCardView } from '@/lib/export/leadersCard';
import { ballotsCardView } from '@/lib/export/ballotsCard';
import { fiveSeatsCardView } from '@/lib/export/fiveSeatsCard';
import { numbersCardView } from '@/lib/export/numbersCard';
import { partyCardView } from '@/lib/export/partyCard';
import { type ShareCard, shareCards, versusCard } from '@/lib/export/shareView';
import { TILE_SEATS, type TileSeat, tilesCardView } from '@/lib/export/tilesCard';
import { topCountiesCardView } from '@/lib/export/topCountiesCard';
import { parseViewQuery, snapshotView } from '@/lib/export/viewState';
import { type PartyScope, findParty, scopeFor } from '@/lib/party';
import { parsePartyPath } from '@/lib/map/urls';
import {
    type SeatsData,
    EMPTY_SEATS,
    countySeatsColouring,
    legendScope,
    loadSeats,
    mcaNameLines,
    mpOutline,
    seatColouring,
    seatSources,
    withIndependentColour,
} from '@/lib/seats';
import {
    SEAT_LABEL,
    buildLegend,
    buildProvinceLegend,
    legendOpenAfterSelect,
    pruneParties,
    settingsCount,
    toggleParty as toggledParties,
} from '@/lib/legend';
import { type Unit, UnitIndex } from '@/lib/units';

type ServerUnit = {
    level: MapLevel;
    code: number;
    name: string;
    ancestors: { level: string; code: number; name: string }[];
} | null;
type ServerParty = { abbrev: string; name: string } | null;
const props = defineProps<{ unit: ServerUnit; party?: ServerParty }>();

// ---- data -------------------------------------------------------------------------------
const manifest = ref<Record<string, string> | null>(null);
const index = shallowRef<UnitIndex | null>(null);
const loadedSeats = shallowRef<SeatsData>(EMPTY_SEATS);
// Independents are drawn in the theme's own `independent` colour everywhere (map, legend,
// seating charts, cards), so every view reads the seats through the current theme.
const seats = computed(() =>
    withIndependentColour(loadedSeats.value, THEMES[theme.value].independent),
);
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

// Set when the page goes away; whatever the data load finishes after that must not start anything.
let disposed = false;
onBeforeUnmount(() => {
    disposed = true;
    focusHistory?.dispose();
});

onMounted(async () => {
    try {
        const m = (await (
            await fetch('/boundaries/manifest.json', { cache: 'no-cache' })
        ).json()) as Record<string, string>;
        const [units, data] = await Promise.all([
            UnitIndex.load(fileUrl(m, 'units.json')),
            loadSeats(),
        ]);
        // Gone before the data came: the popstate gate is taken only below, and must not be left held.
        if (disposed) return;
        index.value = units;
        loadedSeats.value = data;
        manifest.value = m;
        // What the person had before arrived (their last choice, or a link's): the county level's.
        remembered.value = { county: colourKey.value };
        applySharedView(data);
        if (props.unit)
            selectUnit(units.get(props.unit.level, props.unit.code) ?? null, {
                history: 'none',
                animate: false,
            });
        // A /party/{abbrev}?in=county-47 link: the scope is the focus (or above it), so the map
        // starts on it, and the history's first entry remembers that focus.
        const linked = props.party
            ? parsePartyPath(location.pathname + location.search)?.scope
            : null;
        const scopeUnit = linked && units.get(linked.level, linked.code);
        if (!props.unit && scopeUnit)
            selectUnit(scopeUnit, { history: 'none', animate: false });
        focusHistory = createFocusHistory(historyPort, restoreFocus);
        // ... and opens that party's profile (one the data does not have shows the map).
        if (props.party) showParty(props.party.abbrev, linked);
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

// The colouring a visit opens with is the person's own choice at Kenya or a county level, read
// once. The focus switching the mode on its own (MCA inside a constituency) and a link's
// ?seat= are not choices and are never saved (see chooseMode), so the next visit does not
// open all of Kenya in ward-level colours.
const COLOUR_STORAGE = 'km.colour';
function savedColour(): ColourKey {
    try {
        const v = localStorage.getItem(COLOUR_STORAGE) as ColourKey | null;
        return v && validSeatModes(null).includes(v) ? v : 'none';
    } catch {
        return 'none';
    }
}
function saveColour(mode: ColourKey) {
    try {
        localStorage.setItem(COLOUR_STORAGE, mode);
    } catch {
        // Private windows and blocked storage: the choice just lasts for this visit.
    }
}
const colourKey = ref<ColourKey>(savedColour());
const onlyParties = useStorage<string[]>('km.only', []);
const enabledOverlays = useStorage<string[]>(
    'km.overlays',
    OVERLAYS.filter((o) => o.defaultOn).map((o) => o.id),
);
const overlays = ref<MapOverlay[]>(OVERLAYS);

const seatCount = (seat: SeatKey) =>
    Object.values(seats.value.totals[seat] ?? {}).reduce((a, b) => a + b, 0);
// The chips for seats with no approved data yet cannot be chosen (all stay open until it loads).
type ChipKey = Exclude<ColourKey, 'province'>;
const unavailableSeats = computed<ChipKey[]>(() => {
    if (loadedSeats.value === EMPTY_SEATS) return [];
    const off: ChipKey[] = (Object.keys(SEAT_LABEL) as SeatKey[]).filter(
        (seat) => seatCount(seat) === 0,
    );
    // "County seats" needs at least one of the three county seats.
    if (COUNTY_SEAT_KEYS.every((seat) => off.includes(seat)))
        off.push(COUNTY_SEATS);
    return off;
});
watch(unavailableSeats, (off) => {
    if ((off as ColourKey[]).includes(colourKey.value))
        colourKey.value = 'none';
});

// What the person chose at each level (Kenya shares the county level's), so stepping back out
// brings their choice back after the focus switched the mode on its own.
const remembered = ref<RememberedModes>({});
/**
 * The person chose a mode: use it, and remember it for the level they are looking at. Only a
 * choice made at Kenya or a county is saved for the next visit; a link's seat is not a choice
 * (`save: false`).
 */
function chooseMode(mode: ColourKey, { save = true }: { save?: boolean } = {}) {
    const focus = focusOf(selection.value)?.level ?? null;
    // A mode that means nothing at this level (the province tint inside a constituency) is refused.
    if (!validSeatModes(focus).includes(mode)) return;
    colourKey.value = mode;
    remembered.value = { ...remembered.value, [rememberLevel(focus)]: mode };
    if (save && rememberLevel(focus) === 'county') saveColour(mode);
}
/** The mode that fits the focus: the person's choice for that level, else one that fits. */
function modeFor(unit: Unit | null): ColourKey {
    const mode = modeForFocus(
        focusOf(unit)?.level ?? null,
        colourKey.value,
        remembered.value,
    );
    return (unavailableSeats.value as ColourKey[]).includes(mode)
        ? 'none'
        : mode;
}

const colouring = computed<Colouring>(() => {
    const k = colourKey.value;
    if (k === 'none') return NO_COLOURING;
    if (k === 'province')
        return { ...NO_COLOURING, mode: { kind: 'province' } };
    const t = THEMES[theme.value];
    const tokens = {
        noData: t.noData,
        faded: t.faded,
        only: new Set(onlyParties.value),
    };
    if (k === COUNTY_SEATS) return countySeatsColouring(seats.value, tokens);
    const fills = seatColouring(seats.value, k, tokens);
    if (k !== 'mca') return fills;
    // The MCA view: each ward label may carry its MCA's name, and each constituency is outlined
    // in its MP's party colour (with its own highlight), unless that is switched off.
    return {
        ...fills,
        names: mcaNameLines(seats.value),
        ...(outlinesOn.value
            ? {
                  outline: mpOutline(seats.value, {
                      noData: t.noData,
                      faded: t.faded,
                      only: new Set(onlyMpParties.value),
                  }),
              }
            : {}),
    };
});

// ---- MP outlines over the MCA wards ----------------------------------------------------------
// "Show MPs as outlines" (map settings): on by default, and remembered.
const MP_OUTLINES_KEY = 'kem.mpOutlines';
function readMpOutlines() {
    try {
        return localStorage.getItem(MP_OUTLINES_KEY) !== 'false';
    } catch {
        return true;
    }
}
const mpOutlines = ref(readMpOutlines());
watch(mpOutlines, (on) => {
    try {
        localStorage.setItem(MP_OUTLINES_KEY, String(on));
    } catch {
        // Storage can be blocked; the choice then lasts until the page closes.
    }
});
// The outlines are drawn in the MCA view, over the wards of whatever is in view. A focused ward
// has no constituency outline around it to draw.
const outlinesOn = computed(
    () =>
        colourKey.value === 'mca' &&
        mpOutlines.value &&
        focusOf(selection.value)?.level !== 'ward',
);
// The outlines have their own highlight, apart from the ward fills'. It lasts while the MCA view
// does: it is not remembered across visits (a later visit would open with outlines faded and no
// sign of why), and leaving the MCA view clears it.
const onlyMpParties = ref<string[]>([]);
watch(colourKey, (k) => {
    if (k !== 'mca') onlyMpParties.value = [];
});
// With nothing focused the outlines only show from the constituency zoom band down (the style
// fades them in over 6.4 to 7.2); the legend lists them only when they can be on screen.
const outlinesInView = computed(
    () =>
        focusOf(selection.value) !== null ||
        (mapRef.value?.zoom ?? 0) >= CONSTITUENCY_MIN_ZOOM - FADE,
);
/** The outlines' own legend: MP seats in the same scope, from the same function as every legend. */
const mpLegend = computed(() => {
    if (!outlinesOn.value || !outlinesInView.value || !index.value) return null;
    const scope = legendScope(index.value, 'mp', focusOf(selection.value));
    return buildLegend(
        seats.value,
        'mp',
        scope && { codes: scope.codes, unitName: scope.unit.n },
        onlyMpParties.value,
        asOfText.value,
    );
});
function toggleMpParty(key: string) {
    if (!mpLegend.value) return;
    onlyMpParties.value = toggledParties(
        mpLegend.value.members,
        onlyMpParties.value,
        key,
    );
}
/** "Show all": every highlight goes, the fills' and the outlines'. */
function clearHighlights() {
    onlyParties.value = [];
    onlyMpParties.value = [];
}

const asOfText = computed(() =>
    formatAsOf(seats.value.data_as_of ?? seats.value.as_of),
);
const legend = computed(() => {
    const k = colourKey.value;
    if (k === 'none') return null;
    if (k === 'province')
        return buildProvinceLegend(
            (index.value?.all() ?? []).filter((u) => u.l === 'province'),
        );
    // While a unit is focused the counts cover only the seats inside it (or the one seat above it).
    const scope = index.value
        ? legendScope(index.value, k, focusOf(selection.value))
        : null;
    // The box's one source line also covers the leaders strip and the MP outlines' list.
    const mpScope =
        outlinesOn.value && index.value
            ? legendScope(index.value, 'mp', focusOf(selection.value))
            : null;
    return buildLegend(
        seats.value,
        k,
        scope && { codes: scope.codes, unitName: scope.unit.n },
        onlyParties.value,
        asOfText.value,
        [
            ...leaderSources(leadersHere.value),
            ...(outlinesOn.value && outlinesInView.value
                ? seatSources(seats.value, 'mp', mpScope?.codes)
                : []),
        ],
    );
});
/** A legend row was pressed: switch the parties it stands for on or off, each independently. */
function toggleParty(key: string) {
    if (!legend.value) return;
    const wasFiltered = onlyParties.value.length > 0;
    onlyParties.value = toggledParties(
        legend.value.members,
        onlyParties.value,
        key,
    );
    // The first time a party is picked out, say how to clear it.
    if (!wasFiltered && onlyParties.value.length > 0)
        void onboarding.value?.showTip('party', {
            party: legend.value.rows.find((r) => r.key === key)?.label,
        });
}
// A different seat keeps the highlighted parties that hold it and drops the rest.
watch(colourKey, (k) => {
    onlyParties.value = pruneParties(seats.value, k, onlyParties.value);
});
/**
 * A shared view's link (`?seat=mca&parties=uda,odm`) sets the colouring and the highlight once the
 * data is in, then leaves the address bar on the plain unit path.
 */
function applySharedView(data: SeatsData) {
    const { seat, parties } = parseViewQuery(location.search, data);
    if (seat) {
        chooseMode(seat, { save: false });
        onlyParties.value = parties;
    }
    // Take only our own two parameters off the address; anything else (utm_…) stays.
    const query = new URLSearchParams(location.search);
    if (query.has('seat') || query.has('parties')) {
        query.delete('seat');
        query.delete('parties');
        const rest = query.toString();
        history.replaceState(
            history.state,
            '',
            `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`,
        );
    }
}
// What the person set: a colouring, plus each legend row they pressed ("Other" counts once).
const activeSettings = computed(
    () =>
        settingsCount(colourKey.value, legend.value) +
        // ... and each row pressed in the outlines' own list.
        (mpLegend.value?.showing.length ?? 0),
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
// The legend is open by default on desktop, beside a focused unit too (the fit keeps the unit clear
// of it); the person can collapse it to its chip. On a phone it starts as the chip.
const legendOpen = ref(isDesktop.value);
watch(isDesktop, (d) => (legendOpen.value = d));
// The open legend is capped to the room under the controls at the top (the search bar, the seat
// chips, and the back button while a unit is focused), so it is never pushed under them. The
// chips sit beside the search bar on wide desktops, and under it everywhere else.
const isWide = useMediaQuery(`(min-width: ${CHIPS_BESIDE_SEARCH}px)`);
const legendTopClearance = computed(
    () => (isWide.value ? 64 : 116) + (selection.value ? 52 : 0),
);
const legendMaxHeight = computed(
    () =>
        `calc(100dvh - ${(isDesktop.value ? 24 : sheetHeight.value + 12) + legendTopClearance.value}px)`,
);
// Only an open legend beside a focused unit takes room from the fit.
const legendBoxOpen = computed(
    () =>
        isDesktop.value &&
        legendOpen.value &&
        legend.value !== null &&
        selection.value !== null,
);
// What a person picked in search points at: a seat row in the unit panel, or a party in the overview.
const highlightSeat = ref<string | undefined>();
const highlightParty = ref<string | undefined>();
// The party whose profile fills the panel (its abbreviation), if any. The focus behind it stays.
const partyAbbrev = ref<string | null>(null);
// What its numbers cover: a county or a constituency, or all of Kenya (null).
const partyScope = ref<PartyScope>(null);

// With a unit selected the map shows only that unit; this keeps the rest faintly in view instead.
const SURROUNDINGS_KEY = 'kem.showSurroundings';
function readSurroundings() {
    try {
        return localStorage.getItem(SURROUNDINGS_KEY) === 'true';
    } catch {
        return false;
    }
}
const showSurroundings = ref(readSurroundings());
watch(showSurroundings, (on) => {
    // Turning the switch (either way) means the person has found it: the hint is not needed again.
    markHintUsed();
    outsideHint.value?.dismiss();
    try {
        localStorage.setItem(SURROUNDINGS_KEY, String(on));
    } catch {
        // Storage can be blocked; the choice then lasts until the page closes.
    }
    mapRef.value?.setShowSurroundings(on);
});
const focusOf = (unit: Unit | null) =>
    unit && unit.l !== 'province' ? { level: unit.l, code: unit.c } : null;

const boundsOf = (level: MapLevel, code: number) =>
    index.value?.get(level, code)?.b;

/**
 * Show a unit (null: all of Kenya). `history` is how the address bar follows (see lib/map/history):
 * a person's choice pushes an entry; a step up (the Back button, the zoom-out control: 'up', or
 * zooming out of the unit: 'zoom') goes back to the previous entry when that is the parent, else
 * pushes ('up') or replaces ('zoom'); 'none' leaves it alone (the first paint, and restoring an
 * entry the browser went back to).
 */
function selectUnit(
    unit: Unit | null,
    {
        history = 'user',
        fit = true,
        animate = true,
        recentre = true,
    }: {
        history?: HistoryCause | 'none';
        fit?: boolean;
        animate?: boolean;
        recentre?: boolean;
    } = {},
) {
    outsideHint.value?.dismiss();
    onboarding.value?.dismissTip();
    overlayInfo.value = null;
    tip.value = null;
    highlightSeat.value = undefined;
    highlightParty.value = undefined;
    // Choosing a place leaves a party's profile; restoreFocus shows one again where it belongs.
    partyAbbrev.value = null;
    legendOpen.value = legendOpenAfterSelect(legendOpen.value, {
        desktop: isDesktop.value,
        wasFocused: selection.value !== null,
        focusing: unit !== null,
    });
    selection.value = unit;
    colourKey.value = modeFor(unit);
    applyPadding();
    autoCentre.value = recentre;
    view.value = 'unit';
    const map = mapRef.value;
    map?.setFocus(focusOf(unit));
    if (!unit) {
        map?.clearSelection();
        announce.value = announceSelection(null, []);
        if (fit) map?.fitKenya(animate);
        recordHistory(null, history);
        document.title = 'Kenya Electoral Map';
        return;
    }
    if (unit.l !== 'province') map?.select(unit.l, unit.c, { fit, animate });
    const ancestors = index.value?.ancestors(unit.l, unit.c) ?? [];
    if (unit.l !== 'province') recordHistory(focusOf(unit), history);
    announce.value = announceSelection(unit, ancestors);
    document.title = `${unit.n} ${unit.l.charAt(0).toUpperCase()}${unit.l.slice(1)} — Kenya Electoral Map`;
    if (!isDesktop.value && snap.value === 'peek') snap.value = 'half';
    // The first time the person picks a place (not a link or a step back), point at Share this view.
    if (history === 'user') void onboarding.value?.showTip('unit');
}

// ---- party profile ------------------------------------------------------------------------
const partyTitle = (abbrev: string, scope: PartyScope) => {
    const party = findParty(seats.value, abbrev);
    const where = scope && index.value?.get(scope.level, scope.code)?.n;
    return party
        ? `${party.name} (${party.abbrev})${where ? ` in ${where}` : ''} — Kenya Electoral Map`
        : null;
};
/**
 * Show a party's profile in the panel, without touching the history. The scope is a county or a
 * constituency of the data (anything else is all of Kenya). False for an unknown party.
 */
function showParty(abbrev: string, scope: PartyScope = null): boolean {
    const party = findParty(seats.value, abbrev);
    if (!party) return false;
    const known = scope && index.value?.get(scope.level, scope.code);
    view.value = 'unit';
    partyAbbrev.value = party.abbrev;
    partyScope.value = known ? scope : null;
    document.title =
        partyTitle(party.abbrev, partyScope.value) ?? document.title;
    announce.value = `${party.name}: seats held now${known ? ` in ${known.n}` : ''}.`;
    if (!isDesktop.value && snap.value === 'peek') snap.value = 'half';
    return true;
}
/**
 * The person opened a party's profile (legend, a seat row, the overview or search): one history
 * entry. Its numbers cover the focus: the county or constituency shown, a ward's constituency, or
 * Kenya when nothing is focused.
 */
function openParty(abbrev: string) {
    const focus = focusOf(selection.value);
    const scope = index.value ? scopeFor(index.value, focus) : null;
    if (!showParty(abbrev, scope) || !partyAbbrev.value) return;
    focusHistory?.openParty(partyAbbrev.value, focus, partyScope.value);
}
/** The profile's scope switch: the same entry, a different place. */
function setPartyScope(scope: PartyScope) {
    const abbrev = partyAbbrev.value;
    if (!abbrev) return;
    partyScope.value = scope;
    document.title = partyTitle(abbrev, scope) ?? document.title;
    focusHistory?.setPartyScope(abbrev, focusOf(selection.value), scope);
}
/** The person closed the profile: back to the entry it was opened from, the camera where it is. */
function closeParty() {
    if (!partyAbbrev.value) return;
    partyAbbrev.value = null;
    document.title = selection.value
        ? `${selection.value.n} ${selection.value.l.charAt(0).toUpperCase()}${selection.value.l.slice(1)} — Kenya Electoral Map`
        : 'Kenya Electoral Map';
    recordHistory(focusOf(selection.value), 'close');
}
/**
 * "Show on map" on a seat row: colour the map by that seat and highlight the party, leaving the
 * focus where it is. A seat held above the focus (a governor inside a constituency) goes up to the
 * unit that holds it, the same step the seat chips take.
 */
function showPartyOnMap(seat: SeatKey) {
    const abbrev = partyAbbrev.value;
    if (!abbrev) return;
    const stepUp = chipStepUp(focusOf(selection.value)?.level ?? null, seat);
    if (stepUp) onChipStepUp(seat, stepUp);
    else {
        chooseMode(seat);
        closeParty();
    }
    onlyParties.value = [abbrev];
    announce.value = `Showing ${SEAT_LABEL[seat]} seats held by ${findParty(seats.value, abbrev)?.name ?? abbrev} on the map.`;
}
function shareParty() {
    const abbrev = partyAbbrev.value;
    if (!abbrev) return;
    // Across Kenya the party's top 10 counties for MCA seats come too, when it holds any.
    sharedCards.value = shareCards([
        partyCardView({
            seats: seats.value,
            abbrev,
            theme: theme.value,
            index: index.value ?? undefined,
            scope: partyScope.value,
        }),
        !partyScope.value && topCountiesOf('mca', [abbrev]),
    ]);
}

// The person zoomed out of the focused unit: the focus (and the panel) move up to its parent, and
// the camera stays where their gesture left it.
function onZoomOut(next: FocusSelection | null) {
    const unit = next
        ? (index.value?.get(next.level, next.code) ?? null)
        : null;
    selectUnit(unit, { history: 'zoom', fit: false, recentre: false });
}

function onPickPerson({ holder, unit }: PersonResult) {
    selectUnit(unit ?? null);
    if (unit) highlightSeat.value = holder.seat;
    else highlightParty.value = holder.party ?? undefined;
    // Say who was picked and where it is shown; selecting the unit only announced the unit.
    announce.value = announcePerson(
        { name: holder.name, title: SEAT_TITLE[holder.seat] },
        unit ?? null,
    );
    if (!isDesktop.value && snap.value === 'peek') snap.value = 'half';
}

// ---- leaders here -----------------------------------------------------------------------
// Who holds each seat that covers the focused unit, at the top of the legend box. The same rows as
// the panel's "Who represents" (lib/leaders.ts), less the one seat the legend's single bar counts.
const leadersHere = computed(() =>
    index.value
        ? leadersFor(selection.value, seats.value, index.value, {
              omit: legendOmits(
                  index.value,
                  colourKey.value,
                  focusOf(selection.value),
              ),
          })
        : [],
);
/** A name in "Leaders here" was pressed: point at that person's row in the panel. The focus stays. */
function onPickLeader(row: LeaderRow) {
    if (!row.holder) return;
    partyAbbrev.value = null;
    view.value = 'unit';
    // Set again even for the same seat, so the row scrolls back into view.
    highlightSeat.value = undefined;
    void nextTick(() => (highlightSeat.value = row.seat));
    announce.value = `${row.holder.name}, ${row.title}${row.where ? ` (${row.where})` : ''}: shown in the panel.`;
    if (!isDesktop.value && snap.value === 'peek') snap.value = 'half';
}

// A chip for a seat held above the focus was pressed: go up to the unit that shows it, and show it.
function onChipStepUp(seat: ColourKey, level: 'county' | 'constituency') {
    const s = selection.value;
    const target =
        s && index.value?.ancestors(s.l, s.c).find((a) => a.l === level);
    if (!target) return;
    selectUnit(target, { history: 'up' });
    chooseMode(seat);
}
const chipParents = computed(() => {
    const s = selection.value;
    const up = (level: string) =>
        (s && index.value?.ancestors(s.l, s.c).find((a) => a.l === level)?.n) ||
        undefined;
    return { county: up('county'), constituency: up('constituency') };
});

// The first time the chips for county-wide seats are muted (inside a constituency or a ward).
watch(
    () => focusOf(selection.value)?.level ?? null,
    (level) => {
        const county = chipParents.value.county;
        if ((level === 'constituency' || level === 'ward') && county)
            void onboarding.value?.showTip('muted-chip', { county });
    },
);

const onPick = (p: Picked) =>
    selectUnit(index.value?.get(p.level, p.code) ?? null);

// ---- onboarding -------------------------------------------------------------------------
const onboarding = ref<InstanceType<typeof Onboarding> | null>(null);
let tourTimer = 0;
onBeforeUnmount(() => window.clearTimeout(tourTimer));
// With no WebGL2 the list view replaces the map (it never becomes ready): the tour still runs,
// without its map step, and the tips (which wait for the tour) are not blocked for good.
watch(unsupported, (off) => {
    if (off)
        tourTimer = window.setTimeout(() => onboarding.value?.startTour(), 700);
});
// The part of the screen the panel covers, so the tour can point at the middle of what is left.
const mapInset = computed(() =>
    isDesktop.value
        ? { left: 400, bottom: 0 }
        : { left: 0, bottom: sheetHeight.value },
);
/** The share step points inside the sheet: on a phone, open it so the button shows. */
async function prepareStep(id: string) {
    if (id !== 'share' || isDesktop.value || snap.value !== 'peek') return;
    if (!canShareView.value) return;
    snap.value = 'half';
    await new Promise((r) => setTimeout(r, 300));
}
/** "Show tips again" in the About sheet: leave it, and start the tour over. */
function showTipsAgain() {
    view.value = 'unit';
    outsideHint.value?.dismiss();
    void nextTick(() => onboarding.value?.restartTour());
}

// The map can mount after the data (or the other way round): apply a pending deep link once both exist.
watch(
    () => mapRef.value?.ready,
    (ready) => {
        // A first visit gets the tour once the map is up and the sheet has settled.
        if (ready) tourTimer = window.setTimeout(() => onboarding.value?.startTour(), 700);
        if (ready) {
            mapRef.value?.setShowSurroundings(showSurroundings.value);
            mapRef.value?.setFocus(focusOf(selection.value));
        }
        if (ready && selection.value && selection.value.l !== 'province')
            mapRef.value?.select(selection.value.l, selection.value.c, {
                fit: true,
                animate: false,
            });
    },
);

// ---- history ----------------------------------------------------------------------------
// The address bar follows the focus, and each unit the person chooses is a history entry, so the
// browser's back button and the phone's back gesture walk back through what they looked at.
// Entries are made through Inertia's router (client-side, state preserved): they carry the page
// Inertia needs to rebuild the entry after a reload, or after leaving to another page and coming
// back. Going back to an entry is handled here, not by Inertia: it would put the page back from
// its saved copy and rebuild the map, so our listener runs first (see `installPopStateGate`) and
// keeps Inertia from seeing the event.
let focusHistory: FocusHistory | null = null;

function serverUnitOf(focus: FocusSelection | null): ServerUnit {
    const unit = focus && index.value?.get(focus.level, focus.code);
    if (!focus || !unit) return null;
    return {
        level: focus.level,
        code: focus.code,
        name: unit.n,
        ancestors: (index.value?.ancestors(focus.level, focus.code) ?? []).map(
            (a) => ({ level: a.l, code: a.c, name: a.n }),
        ),
    };
}
function serverPartyOf(slug: string | undefined): ServerParty {
    const party = slug ? findParty(loadedSeats.value, slug) : undefined;
    return party ? { abbrev: party.abbrev, name: party.name } : null;
}
const visit = (
    url: string,
    focus: FocusSelection | null,
    party?: { abbrev: string },
) => ({
    url,
    props: (current: Record<string, unknown>) => ({
        ...current,
        unit: serverUnitOf(focus),
        party: serverPartyOf(party?.abbrev),
    }),
    preserveState: true,
    preserveScroll: true,
});
const historyPort: FocusHistoryPort = {
    // A party's address carries its scope after the ?; the others are the path alone.
    path: () =>
        parsePartyPath(location.pathname)
            ? location.pathname + location.search
            : location.pathname,
    push: (url, focus, party) => router.push(visit(url, focus, party)),
    replace: (url, focus, party) => router.replace(visit(url, focus, party)),
    back: () => window.history.back(),
    onPopState: gatePopState,
};
function recordHistory(
    focus: FocusSelection | null,
    cause: HistoryCause | 'none',
) {
    if (cause !== 'none') focusHistory?.record(focus, cause);
}
/** The browser went back or forward to one of our entries: show its focus and fit the camera to it. */
function restoreFocus(
    focus: FocusSelection | null,
    { fit, party, partyScope: scope }: RestoreOptions,
) {
    const unit = focus
        ? (index.value?.get(focus.level, focus.code) ?? null)
        : null;
    // Going back because of a zoom must not snap the camera away from where the person's fingers are.
    selectUnit(unit, { history: 'none', fit, recentre: fit });
    // An entry for a party's profile shows it over the focus it was opened over.
    if (party) showParty(party, scope);
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
            { history: 'up' },
        );
    else if (selection.value) selectUnit(null, { history: 'up' });
    else mapRef.value?.zoomOutStep();
}
// The level above the selection, by name; the back button, the hint and the zoom-out label use it.
const parentName = computed(() => {
    const s = selection.value;
    if (!s || s.l === 'province') return null;
    const parent = index.value?.ancestors(s.l, s.c)[0];
    return parent && parent.l !== 'province' ? parent.n : 'All of Kenya';
});
const zoomOutLabel = computed(() =>
    !selection.value
        ? 'Zoom out'
        : parentName.value === 'All of Kenya'
          ? 'Zoom out to all of Kenya'
          : `Zoom out to ${parentName.value}`,
);

// The back button, and the hint a tap outside the focused unit shows (it does nothing otherwise).
const outsideHint = ref<InstanceType<typeof OutsideHint> | null>(null);
function stepBack() {
    markHintUsed();
    outsideHint.value?.dismiss();
    zoomOut();
}
function onOutsideClick() {
    const s = selection.value;
    // With the surroundings shown there is a neighbour to pick, and Back is on screen: no nudge.
    if (!s || s.l === 'province' || showSurroundings.value) return;
    // The tour and the tips have the floor: never two cards at once.
    if (onboarding.value?.busy()) return;
    if (outsideHint.value?.nudge()) announce.value = hintText(s.n);
}

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
        mapPadding({
            desktop: isDesktop.value,
            sheetHeight: sheetHeight.value,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            legendOpen: legendBoxOpen.value,
        }),
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
watch(
    [sheetHeight, isDesktop, legendBoxOpen, () => mapRef.value?.ready],
    scheduleRecentre,
);
useEventListener(window, 'resize', scheduleRecentre);

// Zooming out steps the selection up (see onZoomOut), so the panel always shows the selection.
const panelUnit = computed(() => selection.value);

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

// ---- overlay features (polling stations) -----------------------------------------------
const overlayInfo = ref<{ title: string; detail: string } | null>(null);
function onOverlayClick(
    overlay: MapOverlay,
    properties: Record<string, unknown>,
) {
    if (overlay.id !== 'stations') return;
    const ward = index.value?.get('ward', Number(properties.ward_code));
    const parent = ward ? index.value?.ancestors('ward', ward.c)[0] : undefined;
    overlayInfo.value = {
        title: String(properties.name ?? 'Polling station'),
        detail: `Polling station${ward ? ` listed under ${ward.n} ward${parent ? `, ${parent.n}` : ''}` : ''}. IEBC 2013 location.`,
    };
    if (!isDesktop.value && snap.value === 'peek') snap.value = 'half';
}
async function locate() {
    if (!navigator.geolocation || !manifest.value) {
        locateMessage.value = 'This device cannot share its location.';
        void onboarding.value?.showTip('locate', { reason: 'unsupported' });
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
            } catch {
                locateMessage.value =
                    'The ward map could not be loaded. Check your connection and try again.';
            } finally {
                locating.value = false;
            }
        },
        (error) => {
            locating.value = false;
            locateMessage.value = 'Location was not shared.';
            // Code 1 is "permission denied"; anything else is the device not finding itself.
            void onboarding.value?.showTip('locate', {
                reason: error.code === error.PERMISSION_DENIED ? 'denied' : 'failed',
            });
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
}

// ---- hover tooltip (devices with a mouse) -----------------------------------------------
const tip = ref<{ text: string; x: number; y: number } | null>(null);
function onHover(p: Picked | null, point: { x: number; y: number }) {
    const u = p && index.value?.get(p.level, p.code);
    // In the MCA view a ward's tooltip names its MCA: on the map itself only the selected ward does.
    const mca =
        u?.l === 'ward' && colourKey.value === 'mca'
            ? colouring.value.names?.get(u.c)
            : undefined;
    tip.value = u
        ? {
              text: `${u.n} ${LEVEL_NAME[u.l]}${mca ? `. MCA: ${mca}` : ''}`,
              x: point.x,
              y: point.y,
          }
        : null;
}

const partyName = computed(() =>
    partyAbbrev.value
        ? (findParty(seats.value, partyAbbrev.value)?.name ?? partyAbbrev.value)
        : null,
);
const title = computed(
    () => partyName.value ?? (panelUnit.value ? panelUnit.value.n : 'Kenya'),
);
const subtitle = computed(() => {
    if (partyName.value) return 'Political party';
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
    props.party
        ? `${props.party.name} (${props.party.abbrev})`
        : props.unit
        ? `${props.unit.name} ${props.unit.level.charAt(0).toUpperCase()}${props.unit.level.slice(1)}`
        : '',
);
// ---- share image ------------------------------------------------------------------------
// The unit is fixed when the dialog opens, so the card doesn't change under the person.
const exportUnit = shallowRef<(Unit & { l: MapLevel }) | null>(null);
const exportNational = ref(false);
function shareUnit() {
    const u = panelUnit.value;
    if (u && u.l !== 'province') exportUnit.value = u as Unit & { l: MapLevel };
}

// ---- share this view --------------------------------------------------------------------
// The view is fixed when the dialog opens, so the card doesn't change under the person.
const isSeatMode = computed(() => isSeatColouring(colourKey.value));
// A seat view can be shared as it is. "County seats" has cards for all of Kenya (five seats, by
// the numbers) and for a county (its leaders); its stripes have no "This view".
const canShareView = computed(() => {
    if (!isSeatMode.value) return false;
    if (colourKey.value !== COUNTY_SEATS) return true;
    const level = focusOf(selection.value)?.level;
    return !level || level === 'county';
});
// The cards the share dialog offers, the first being the one it opens on; empty while it is shut.
const sharedCards = shallowRef<ShareCard[]>([]);
// A county's or a constituency's leaders card; a ward's is "Who represents this ward".
const leadersOf = (focus: FocusSelection | null) =>
    !index.value || !focus
        ? null
        : focus.level === 'ward'
          ? ballotsCardView({
                seats: seats.value,
                index: index.value,
                ward: focus.code,
                theme: theme.value,
            })
          : leadersCardView({
                seats: seats.value,
                index: index.value,
                focus,
                theme: theme.value,
            });
/**
 * "Top 10 counties" for all of Kenya: a seat a county has more than one of (MP, MCA) and exactly
 * one group highlighted (a party or the independents) that holds any of it; otherwise null.
 */
function topCountiesOf(seat: ColourKey, only: readonly string[]) {
    if (!index.value || (seat !== 'mp' && seat !== 'mca') || only.length !== 1)
        return null;
    const card = topCountiesCardView({
        seats: seats.value,
        index: index.value,
        seat,
        group: only[0],
        theme: theme.value,
    });
    return card.rows.length ? card : null;
}
function shareView() {
    const k = colourKey.value;
    if (!index.value || k === 'none' || k === 'province') return;
    const focus = focusOf(selection.value);
    if (k === COUNTY_SEATS) {
        if (focus) return shareLeaders();
        // All of Kenya on the striped map: the national cards, with no "This view".
        sharedCards.value = shareCards([
            fiveSeatsCardView({ seats: seats.value, index: index.value, theme: theme.value }),
            numbersCardView({ seats: seats.value, index: index.value, theme: theme.value }),
        ]);
        return;
    }
    // A county on the MP or MCA view: "Side by side" with another county, after the others.
    const versus =
        focus?.level === 'county' && (k === 'mp' || k === 'mca')
            ? [
                  versusCard({
                      seats: seats.value,
                      index: index.value,
                      seat: k,
                      county: focus.code,
                      theme: theme.value,
                  }),
              ]
            : [];
    // "This view", then the other cards for what is in view: one line each.
    sharedCards.value = shareCards([
        snapshotView({
            seats: seats.value,
            index: index.value,
            seat: k,
            focus,
            only: onlyParties.value,
            showSurroundings: showSurroundings.value,
            theme: theme.value,
            mpOutlines: mpOutlines.value,
            onlyMp: onlyMpParties.value,
        }),
        leadersOf(focus),
        // A seat a county has one of, all of Kenya: every county as a tile (highlights ignored).
        !focus &&
            TILE_SEATS.includes(k as TileSeat) &&
            tilesCardView({
                seats: seats.value,
                index: index.value,
                seat: k as TileSeat,
                theme: theme.value,
            }),
        !focus &&
            fiveSeatsCardView({
                seats: seats.value,
                index: index.value,
                theme: theme.value,
            }),
        !focus &&
            numbersCardView({
                seats: seats.value,
                index: index.value,
                theme: theme.value,
            }),
        !focus && topCountiesOf(k, onlyParties.value),
    ]).concat(versus);
}

/**
 * The leaders card of the focused unit ("County leaders in <county>", "Leaders of <constituency>"),
 * or a ward's "Who represents" card.
 */
function shareLeaders() {
    sharedCards.value = shareCards([leadersOf(focusOf(selection.value))]);
}

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
            :index="index"
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
            @outside-click="onOutsideClick"
            @zoom-out="onZoomOut"
            @overlay-click="onOverlayClick"
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
            <SearchBox
                :index="index"
                :holders="seats.holders"
                :parties="seats.parties"
                @pick="(u) => selectUnit(u)"
                @pick-person="onPickPerson"
                @pick-party="openParty"
            />
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

        <!-- Seat chips: under the search bar on phones, beside it on wide desktops (2xl: seven chips). Hidden while the
             sheet is at full height, as the legend is. -->
        <div
            v-if="!(snap === 'full' && !isDesktop)"
            class="pointer-events-none absolute top-[64px] right-3 left-3 z-20 md:left-[400px] 2xl:top-3 2xl:left-[864px]"
        >
            <SeatChips
                :model-value="colourKey"
                :unavailable="unavailableSeats"
                :focus-level="focusOf(selection)?.level ?? null"
                :parents="chipParents"
                @update:modelValue="chooseMode"
                @step-up="onChipStepUp"
            />
        </div>

        <!-- Back button: under the search bar and the chips (beside them on wide desktops). -->
        <div
            v-if="!(snap === 'full' && !isDesktop)"
            class="pointer-events-none absolute top-[116px] left-3 z-20 flex flex-col items-start gap-2 md:left-[400px] 2xl:top-[64px]"
        >
            <BackButton :parent="parentName" @step-up="stepBack" />
        </div>

        <!-- The hint: docked above the sheet on a phone (a card up top would cover the unit), beside
             the back button from md up. The right edge stays clear of the zoom controls. -->
        <div
            v-if="!(snap === 'full' && !isDesktop)"
            data-testid="outside-hint-slot"
            class="pointer-events-none absolute right-[72px] left-3 z-20 md:top-[168px] md:right-auto md:left-[400px] 2xl:top-[116px]"
            :style="isDesktop ? undefined : { bottom: `${sheetHeight + 12}px` }"
        >
            <OutsideHint
                ref="outsideHint"
                :unit="selection?.n ?? ''"
                :parent="parentName ?? ''"
                @step-up="zoomOut"
                @show-surroundings="showSurroundings = true"
            />
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
            data-onboarding="legend"
            class="absolute left-3 z-10 md:left-[396px]"
            :style="{ bottom: isDesktop ? '24px' : `${sheetHeight + 12}px` }"
        >
            <Legend
                v-model:open="legendOpen"
                :title="legend.title"
                :max-height="legendMaxHeight"
                :chip-label="legend.chipLabel"
                :rows="legend.rows"
                :note="legend.note"
                :highlighted="legend.highlighted"
                :filtered="
                    legend.filtered || (!!mpLegend && mpLegend.filtered)
                "
                :outline="
                    mpLegend && {
                        title: 'MPs (outline)',
                        rows: mpLegend.rows,
                        highlighted: mpLegend.highlighted,
                    }
                "
                fill-title="MCAs (fill)"
                :shareable="canShareView"
                :share-emphasis="
                    canShareView &&
                    (onlyParties.length > 0 || !!focusOf(selection))
                "
                @toggle="toggleParty"
                @toggle-outline="toggleMpParty"
                :leaders="leadersHere"
                @clear="clearHighlights"
                @share="shareView"
                @party="openParty"
                @leader="onPickLeader"
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
                    <button
                        v-else-if="partyAbbrev"
                        type="button"
                        class="min-h-11 px-2 text-[14px] underline underline-offset-4"
                        @click="closeParty"
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
                <div
                    v-if="overlayInfo"
                    class="mb-2 flex items-start gap-2 rounded-md border border-hairline px-3 py-2"
                >
                    <div class="min-w-0 flex-1">
                        <p class="text-[15px] font-medium text-ink">
                            {{ overlayInfo.title }}
                        </p>
                        <p class="text-[13px] text-muted-ink">
                            {{ overlayInfo.detail }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="min-h-11 px-2 text-[14px] underline underline-offset-4"
                        @click="overlayInfo = null"
                    >
                        Close
                    </button>
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
                :colour="colourKey"
                :province-available="
                    validSeatModes(focusOf(selection)?.level ?? null).includes(
                        'province',
                    )
                "
                @update:colour="chooseMode"
                v-model:mp-outlines="mpOutlines"
                v-model:enabled="enabledOverlays"
                v-model:theme="themePref"
                :overlays="overlays"
                :swatch-for="(o) => o.swatch?.(THEMES[theme])"
            />
            <AboutSheet v-else-if="view === 'about'" @show-tips="showTipsAgain" />
            <UnitList
                v-else-if="view === 'list' && index"
                :index="index"
                @pick="(u) => selectUnit(u)"
            />
            <template v-else-if="index">
                <PartyPanel
                    v-if="partyAbbrev"
                    :seats="seats"
                    :abbrev="partyAbbrev"
                    :index="index"
                    :scope="partyScope"
                    :focus="focusOf(selection)"
                    @scope="setPartyScope"
                    @show="showPartyOnMap"
                    @share="shareParty"
                />
                <UnitPanel
                    v-else-if="panelUnit"
                    :unit="panelUnit"
                    :index="index"
                    :seats="seats"
                    :towns="townsIn"
                    :highlight-seat="highlightSeat"
                    v-model:show-surroundings="showSurroundings"
                    :can-share-view="canShareView"
                    @go="(u) => selectUnit(u)"
                    @party="openParty"
                    @share="shareUnit"
                    @share-view="shareView"
                    @share-leaders="shareLeaders"
                />
                <NationalOverview
                    v-else
                    :seats="seats"
                    :highlight-party="highlightParty"
                    :can-share-view="canShareView"
                    @colour-by="chooseMode"
                    @party="openParty"
                    @share="exportNational = true"
                    @share-view="shareView"
                />
            </template>
        </BottomSheet>

        <LocatorExport
            v-if="exportUnit && index && manifest"
            :open="true"
            :unit="exportUnit"
            :index="index"
            :seats="seats"
            :manifest="manifest"
            :province-of-county="provinceOfCounty"
            :theme="THEMES[theme]"
            :colouring="colouring"
            :show-surroundings="showSurroundings"
            @update:open="(v) => !v && (exportUnit = null)"
        />
        <ShareViewDialog
            v-if="sharedCards.length && index && manifest"
            :open="true"
            :view="sharedCards[0].view"
            :cards="sharedCards"
            :context="{
                manifest,
                provinceOfCounty,
                index,
                seats,
            }"
            @update:open="(v) => !v && (sharedCards = [])"
        />
        <InPowerExport
            v-model:open="exportNational"
            :seats="seats"
            :theme="THEMES[theme]"
        />

        <Onboarding
            ref="onboarding"
            :map-inset="mapInset"
            :avoid-map="!isDesktop && selection !== null"
            :prepare="prepareStep"
        />

        <div class="sr-only" aria-live="polite">{{ announce }}</div>
    </div>
</template>
