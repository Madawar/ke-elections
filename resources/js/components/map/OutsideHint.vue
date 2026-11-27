<script lang="ts">
// How often the hint has been shown, and whether the person has found the controls it points at.
// Using the back button or the surroundings switch fills the count, so the hint never returns.
export const HINT_KEY = 'kem.outsideHint.count';
export const MAX_SHOWS = 3;
/** How long the card stays before it closes by itself. */
export const HINT_MS = 6000;

// On a phone only the first sentence is shown (the buttons say the rest); the whole is still read out.
const lead = (unit: string) => `You're viewing ${unit}.`;
const REST = 'Go back to see more, or show the surroundings to pick a neighbour.';
export const hintText = (unit: string) => `${lead(unit)} ${REST}`;

// Storage can be blocked; the count is then kept in memory, for as long as the page is open.
let memory = 0;
function shown(): number {
    try {
        return Number(localStorage.getItem(HINT_KEY)) || 0;
    } catch {
        return memory;
    }
}
function setShown(n: number) {
    try {
        localStorage.setItem(HINT_KEY, String(n));
    } catch {
        memory = n;
    }
}
export const markHintUsed = () => setShown(MAX_SHOWS);
</script>

<script setup lang="ts">
// A small non-modal card for a tap outside the focused unit that did nothing. The page calls
// `nudge()` on such a tap and `dismiss()` on the next map tap; the card closes itself after 6 s,
// on Escape, and when either of its buttons is used.
import { useEventListener } from '@vueuse/core';
import { onBeforeUnmount, ref } from 'vue';

defineProps<{ unit: string; parent: string }>();
const emit = defineEmits<{ stepUp: []; showSurroundings: [] }>();

const open = ref(false);
let timer = 0;

function dismiss() {
    open.value = false;
    window.clearTimeout(timer);
}
/** Show the card if it is allowed to; false when it is not (or was open, and is now closed). */
function nudge(): boolean {
    if (open.value) {
        dismiss();
        return false;
    }
    const count = shown();
    if (count >= MAX_SHOWS) return false;
    setShown(count + 1);
    open.value = true;
    timer = window.setTimeout(dismiss, HINT_MS);
    return true;
}
function use(event: 'stepUp' | 'showSurroundings') {
    markHintUsed();
    dismiss();
    if (event === 'stepUp') emit('stepUp');
    else emit('showSurroundings');
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    if (open.value && e.key === 'Escape') dismiss();
});
onBeforeUnmount(() => window.clearTimeout(timer));
defineExpose({ nudge, dismiss });
</script>

<template>
    <div
        v-if="open"
        class="pointer-events-auto w-full max-w-full rounded-md border border-hairline bg-surface p-2.5 text-ink shadow-sm md:w-72 md:p-3"
    >
        <p class="text-[14px] leading-snug">
            <span>{{ lead(unit) + ' ' }}</span>
            <span class="max-md:sr-only">{{ REST }}</span>
        </p>
        <div
            data-hint-buttons
            class="mt-2 flex flex-row gap-1.5 md:flex-col"
        >
            <button
                type="button"
                class="flex min-h-11 flex-1 items-center justify-center rounded-md bg-ink px-2 text-center text-[13px] leading-tight font-medium text-surface focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none md:flex-none md:px-3 md:text-[14px]"
                @click="use('stepUp')"
            >
                Back to {{ parent }}
            </button>
            <button
                type="button"
                class="flex min-h-11 flex-1 items-center justify-center rounded-md border border-ink bg-surface px-2 text-center text-[13px] leading-tight font-medium text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none md:flex-none md:px-3 md:text-[14px]"
                @click="use('showSurroundings')"
            >
                Show surroundings
            </button>
        </div>
    </div>
</template>
