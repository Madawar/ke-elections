<script setup lang="ts">
// "Colour the map by seat": one row of chips floating on the map. It is a radiogroup (arrow keys
// move and choose), one chip per ballot colour, and the active chip is filled with its colour.
import { nextTick, onMounted, ref, watch } from 'vue';
import type { ColourKey } from '@/lib/map/colouring';
import type { MapLevel } from '@/lib/map/levels';
import { chipStepUp } from '@/lib/map/seatMode';

type ChipKey = Exclude<ColourKey, 'province'>;

const props = defineProps<{
    /** Seats with no approved data yet: shown, but they cannot be chosen. */
    unavailable?: ChipKey[];
    /** What is focused: a seat held above it is muted, and leads up to the unit that shows it. */
    focusLevel?: MapLevel | null;
    /** Names of the focused unit's parents, for the muted chips' accessible names. */
    parents?: { county?: string; constituency?: string };
}>();
const emit = defineEmits<{
    /** A muted chip was pressed: go up to that level (and show this seat there). */
    stepUp: [key: ChipKey, level: 'county' | 'constituency'];
}>();
const model = defineModel<ColourKey>({ required: true });

// Fills follow the IEBC ballot colours (`seat-*` tokens; MP's face is a touch darker for contrast).
// The text colours are fixed `seat-ink` and `seat-paper`, not the theme's ink, which turns light
// in dark mode and would vanish on the yellow and beige.
const CHIPS: { key: ChipKey; label: string; face: string }[] = [
    { key: 'none', label: 'None', face: 'bg-ink text-surface' },
    {
        key: 'governor',
        label: 'Governor',
        face: 'bg-seat-governor text-seat-ink',
    },
    {
        key: 'senator',
        label: 'Senator',
        face: 'bg-seat-senator text-seat-ink',
    },
    {
        key: 'woman_rep',
        label: 'Woman Rep',
        face: 'bg-seat-woman-rep text-seat-paper',
    },
    { key: 'mp', label: 'MP', face: 'bg-seat-mp-chip text-seat-paper' },
    { key: 'mca', label: 'MCA', face: 'bg-seat-mca text-seat-ink' },
];

const buttons = ref<HTMLButtonElement[]>([]);
const isOff = (key: ChipKey) => props.unavailable?.includes(key) ?? false;
const upFor = (key: ChipKey) => chipStepUp(props.focusLevel ?? null, key);
const isMuted = (key: ChipKey) => upFor(key) !== null;
/** "County-wide": the note on a muted chip, and its full name for a screen reader. */
const note = (key: ChipKey) =>
    upFor(key) === 'county' ? 'County-wide' : 'Constituency-wide';
const nameOf = (chip: { key: ChipKey; label: string }) => {
    const up = upFor(chip.key);
    if (!up) return undefined;
    const where = props.parents?.[up] ?? `the ${up}`;
    return `${chip.label} — ${up}-wide seat; go back to ${where} to see it`;
};
const choose = (key: ChipKey) => {
    const up = upFor(key);
    if (up) emit('stepUp', key, up);
    else if (!isOff(key)) model.value = key;
};
// The chip in the tab order: the active one, or the first when the mode has no chip (provinces).
const tabbable = () => {
    const i = CHIPS.findIndex((c) => c.key === model.value);
    return i === -1 ? 0 : i;
};
// Arrow keys walk the chips that can be chosen here; muted ones are reached with Tab.
const skipped = (key: ChipKey) => isOff(key) || isMuted(key);

// A narrow row scrolls sideways: keep the chosen chip in view, wherever the choice came from.
function showActive() {
    const i = CHIPS.findIndex((c) => c.key === model.value);
    buttons.value[i]?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
}
onMounted(showActive);
watch(model, () => nextTick(showActive));

async function onKey(e: KeyboardEvent, from: number) {
    const step =
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? 1
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
              ? -1
              : e.key === 'Home'
                ? 'first'
                : e.key === 'End'
                  ? 'last'
                  : 0;
    if (!step) return;
    e.preventDefault();
    const n = CHIPS.length;
    let to = from;
    if (step === 'first') to = 0;
    else if (step === 'last') to = n - 1;
    else
        for (let k = 1; k <= n; k++) {
            const i = (from + step * k + n * k) % n;
            if (!skipped(CHIPS[i].key)) {
                to = i;
                break;
            }
        }
    // Home and End land on a chip that can be chosen.
    if (skipped(CHIPS[to].key)) return;
    choose(CHIPS[to].key);
    await nextTick();
    buttons.value[to]?.focus();
}
</script>

<template>
    <div
        role="radiogroup"
        aria-label="Colour the map by seat"
        data-onboarding="seat-chips"
        class="pointer-events-none flex w-fit max-w-full snap-x snap-proximity gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
        <button
            v-for="(chip, i) in CHIPS"
            :key="chip.key"
            ref="buttons"
            type="button"
            role="radio"
            class="pointer-events-auto flex min-h-11 shrink-0 snap-start items-center focus-visible:outline-none"
            :aria-checked="model === chip.key"
            :aria-disabled="isOff(chip.key) || undefined"
            :aria-label="nameOf(chip)"
            :data-muted="isMuted(chip.key) || undefined"
            :tabindex="i === tabbable() || isMuted(chip.key) ? 0 : -1"
            @click="choose(chip.key)"
            @keydown="onKey($event, i)"
        >
            <span
                data-chip-face
                class="flex h-9 items-center rounded-full border px-3.5 text-[14px] font-semibold shadow-sm [word-spacing:0.12em]"
                :class="[
                    model === chip.key
                        ? [chip.face, 'border-ink']
                        : 'border-hairline bg-surface text-ink',
                    isOff(chip.key) ? 'opacity-50' : '',
                    isMuted(chip.key) ? 'border-dashed text-muted-ink' : '',
                    'in-focus-visible:ring-2 in-focus-visible:ring-ink in-focus-visible:ring-offset-2 in-focus-visible:ring-offset-surface',
                ]"
            >
                <span class="flex flex-col items-center leading-none">
                    <span data-chip-label>{{ chip.label }}</span>
                    <span
                        v-if="isMuted(chip.key)"
                        class="mt-0.5 text-[11px] font-normal"
                        >{{ note(chip.key) }}</span
                    >
                </span>
            </span>
        </button>
    </div>
</template>
