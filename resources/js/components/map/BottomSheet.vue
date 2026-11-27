<script setup lang="ts">
// Phone: a bottom sheet with three snaps, dragged by its handle and header only.
// 768px and up: a 380px side panel on the left, full height, with its own scroll.
import { useMediaQuery, useWindowSize } from '@vueuse/core';
import { computed, ref, watch } from 'vue';

export type Snap = 'peek' | 'half' | 'full';

const SNAPS: Snap[] = ['peek', 'half', 'full'];
const SNAP_CSS: Record<Snap, string> = {
    peek: 'calc(112px + env(safe-area-inset-bottom))',
    half: '50dvh',
    full: 'calc(100dvh - 72px)',
};
const SNAP_LABEL: Record<Snap, string> = {
    peek: 'collapsed',
    half: 'half height',
    full: 'full height',
};
const DRAG_THRESHOLD = 6;

const props = withDefaults(defineProps<{ desktop?: boolean }>(), {
    desktop: undefined,
});
const snap = defineModel<Snap>('snap', { default: 'peek' });
const emit = defineEmits<{ height: [px: number] }>();

const wideScreen = useMediaQuery('(min-width: 768px)');
const isDesktop = computed(() => props.desktop ?? wideScreen.value);
const { height: viewportHeight } = useWindowSize();

function snapPx(s: Snap): number {
    const vh = viewportHeight.value;
    if (s === 'peek') return 112;
    if (s === 'half') return Math.round(vh / 2);
    return Math.max(112, vh - 72);
}

watch(
    [snap, isDesktop, viewportHeight],
    () => emit('height', isDesktop.value ? 0 : snapPx(snap.value)),
    { immediate: true },
);

function step(by: number) {
    const i = SNAPS.indexOf(snap.value) + by;
    snap.value = SNAPS[Math.min(SNAPS.length - 1, Math.max(0, i))];
}

function cycle() {
    snap.value = SNAPS[(SNAPS.indexOf(snap.value) + 1) % SNAPS.length];
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') cycle();
    else if (e.key === 'ArrowUp') step(1);
    else if (e.key === 'ArrowDown') step(-1);
    else return;
    // Enter would otherwise also fire a click on the button and cycle twice.
    e.preventDefault();
}

// Dragging: the sheet follows the pointer, then settles on the nearest snap.
const drag = ref<{
    id: number;
    startY: number;
    startPx: number;
    moved: boolean;
    /** The press began on the handle button, whose click the captured pointer may never deliver. */
    onHandle: boolean;
} | null>(null);
const dragPx = ref<number | null>(null);
// A pointer gesture the sheet has already acted on (a drag, or a tap on the handle): the click
// that follows it, where one reaches the handle at all, is not a second tap.
const CLICK_AFTER_POINTER_MS = 600;
let handledAt = Number.NEGATIVE_INFINITY;

function onPointerDown(e: PointerEvent) {
    // A button or link in the header (List, About, Done) gets its own tap: capturing the pointer
    // would send the click to the sheet instead. Only the handle and plain header text drag.
    const target = e.target as Element | null;
    if (target?.closest('button:not([data-sheet-handle]), a, input, select'))
        return;
    drag.value = {
        id: e.pointerId,
        startY: e.clientY,
        startPx: snapPx(snap.value),
        moved: false,
        onHandle: !!target?.closest('[data-sheet-handle]'),
    };
    (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
    const d = drag.value;
    if (!d || e.pointerId !== d.id) return;
    const dy = d.startY - e.clientY;
    if (Math.abs(dy) > DRAG_THRESHOLD) d.moved = true;
    if (d.moved)
        dragPx.value = Math.min(
            snapPx('full'),
            Math.max(snapPx('peek'), d.startPx + dy),
        );
}

function onPointerUp(e: PointerEvent) {
    const d = drag.value;
    if (!d || e.pointerId !== d.id) return;
    if (d.moved && dragPx.value !== null) {
        const px = dragPx.value;
        snap.value = SNAPS.reduce((best, s) =>
            Math.abs(snapPx(s) - px) < Math.abs(snapPx(best) - px) ? s : best,
        );
        handledAt = performance.now();
    } else if (d.onHandle && e.type === 'pointerup') {
        // Capturing the pointer on the drag area sends a mouse or pen click to the area, not to
        // the handle button (the same thing that kept the header's buttons from working), so a
        // tap is resized here, on release. Touch taps usually still click the button after this.
        cycle();
        handledAt = performance.now();
    }
    drag.value = null;
    dragPx.value = null;
}

function onHandleClick(e: MouseEvent) {
    // detail is 0 for a keyboard click (Space), which no pointer gesture has handled.
    if (e.detail > 0 && performance.now() - handledAt < CLICK_AFTER_POINTER_MS)
        return;
    cycle();
}

const sheetStyle = computed(() => ({
    height: dragPx.value === null ? SNAP_CSS[snap.value] : `${dragPx.value}px`,
    paddingBottom: 'env(safe-area-inset-bottom)',
}));
</script>

<template>
    <aside
        v-if="isDesktop"
        data-sheet
        class="fixed inset-y-0 left-0 z-20 flex w-[380px] flex-col overflow-y-auto overscroll-contain border-r border-hairline bg-surface text-ink"
    >
        <header class="px-4 pt-4 pb-2">
            <slot name="header" />
        </header>
        <div data-sheet-content class="px-4 pb-6">
            <slot />
        </div>
    </aside>

    <aside
        v-else
        data-sheet
        class="fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[12px] border border-b-0 border-hairline bg-surface text-ink shadow-lg"
        :class="
            dragPx === null
                ? 'transition-[height] duration-180 ease-out motion-reduce:transition-none'
                : ''
        "
        :style="sheetStyle"
    >
        <div
            data-sheet-drag
            class="shrink-0 select-none"
            style="touch-action: none"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
        >
            <button
                type="button"
                data-sheet-handle
                class="flex h-11 w-full cursor-grab items-center justify-center rounded-t-[12px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
                :aria-label="`Resize panel, now ${SNAP_LABEL[snap]}`"
                @keydown="onKeydown"
                @click="onHandleClick"
            >
                <span
                    class="h-1 w-10 rounded-full bg-hairline"
                    aria-hidden="true"
                />
            </button>
            <header class="px-4 pb-2">
                <slot name="header" />
            </header>
        </div>
        <div
            data-sheet-content
            class="min-h-0 flex-1 overscroll-contain px-4 pb-4"
            :class="snap === 'full' ? 'overflow-y-auto' : 'overflow-hidden'"
        >
            <slot />
        </div>
    </aside>
</template>
