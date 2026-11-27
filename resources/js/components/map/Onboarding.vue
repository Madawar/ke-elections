<script setup lang="ts">
// The first-visit tour and the one-time contextual tips: small non-modal popovers with a pointer
// to a real control. The map stays usable, Escape closes, focus moves into the popover and goes
// back to the control when it closes. The page starts the tour (`startTour`, `restartTour`) and
// asks for a tip when its trigger happens (`showTip`); `lib/onboarding` holds the words and the
// rules (tour first, never together, one tip per session, each once ever).
import { useEventListener } from '@vueuse/core';
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import {
    type Box,
    type Placement,
    type TipContext,
    type TipId,
    TIPS,
    TOUR_KEY,
    TOUR_STEPS,
    type TourStep,
    claimTip,
    canClaimTip,
    clearTour,
    isVisible,
    placePopover,
    resolveAnchor,
    setFlag,
    state,
    tourDue,
} from '@/lib/onboarding';

const props = withDefaults(
    defineProps<{
        /** The strip of the screen the panel covers: the map's visible middle is what is left. */
        mapInset?: { left: number; bottom: number };
        /** A unit is focused and shown above the sheet: tips keep off that area. */
        avoidMap?: boolean;
        /** Get the screen ready for a step (open the sheet so its control shows). */
        prepare?: (step: TourStep['id']) => Promise<void> | void;
        /** How long a tip waits for the layout to settle after its trigger. */
        settleMs?: number;
    }>(),
    { mapInset: () => ({ left: 0, bottom: 0 }), settleMs: 350 },
);

interface Shown {
    kind: 'tour' | 'tip';
    /** What the popover points at, and what has the focus back when it closes. */
    anchor: HTMLElement;
    centre: boolean;
    sides: TourStep['sides'];
    text: string;
    detail?: string;
    /** Tour only. */
    step?: TourStep;
    position?: number;
    total?: number;
}
const current = ref<Shown | null>(null);
/** `docked`: no pointer, the card sits above the phone's sheet (as the outside-tap hint does). */
const placement = ref<(Placement & { docked?: boolean }) | null>(null);
const box = ref<HTMLElement | null>(null);
const primary = ref<HTMLButtonElement | null>(null);

const isLast = computed(
    () =>
        current.value?.kind === 'tour' &&
        current.value.position === current.value.total,
);

// ---- the tour ---------------------------------------------------------------------------
let index = -1;
let shownCount = 0;

/** Where a step points now: its own control, or the stand-in it names; null when neither is on screen. */
function resolveStep(step: TourStep) {
    const own = resolveAnchor(step.anchors);
    if (own) return { anchor: own, text: step.text, detail: step.detail };
    const alt = step.fallback && resolveAnchor(step.fallback.anchors);
    return alt && step.fallback
        ? { anchor: alt, text: step.fallback.text, detail: undefined }
        : null;
}
const remainingAfter = (i: number) =>
    TOUR_STEPS.slice(i + 1).filter((s) => resolveStep(s) !== null).length;

async function goto(from: number) {
    for (let i = from; i < TOUR_STEPS.length; i++) {
        const step = TOUR_STEPS[i];
        if (props.prepare) await props.prepare(step.id);
        const r = resolveStep(step);
        if (!r) continue;
        index = i;
        shownCount += 1;
        current.value = {
            kind: 'tour',
            anchor: r.anchor,
            centre: !!step.centre && r.anchor.dataset.onboarding === 'map',
            sides: step.sides,
            text: r.text,
            detail: r.detail,
            step,
            position: shownCount,
            total: shownCount + remainingAfter(i),
        };
        await show();
        return;
    }
    closeTour();
}
function begin(): boolean {
    if (!TOUR_STEPS.some((s) => resolveStep(s))) return false;
    state.tourStarted = true;
    state.tourActive = true;
    index = -1;
    shownCount = 0;
    void goto(0);
    return true;
}
/** Start the tour on a first visit (nothing happens after it was done, skipped or shown). */
function startTour(): boolean {
    return tourDue() ? begin() : false;
}
/** "Show tips again": clear what was seen, and start the tour over. */
function restartTour(): boolean {
    dismissTip();
    clearTour();
    return begin();
}
function closeTour() {
    setFlag(TOUR_KEY);
    state.tourActive = false;
    close(true);
}
const next = () => void goto(index + 1);

// ---- the tips ---------------------------------------------------------------------------
let tipToken = 0;
let pending = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Show a tip for something the person just did, if the rules allow it and its control is on
 * screen once the layout has settled. False when it was not shown (and it is then not used up).
 */
async function showTip(id: TipId, ctx: TipContext = {}): Promise<boolean> {
    if (pending || current.value || !canClaimTip(id)) return false;
    pending = true;
    const token = ++tipToken;
    try {
        await nextTick();
        if (props.settleMs > 0) await sleep(props.settleMs);
        if (token !== tipToken || current.value) return false;
        const tip = TIPS[id];
        const anchor = resolveAnchor(tip.anchors);
        if (!anchor || !claimTip(id)) return false;
        current.value = {
            kind: 'tip',
            anchor,
            centre: false,
            sides: tip.sides,
            text: tip.text(ctx),
        };
        await show();
        return true;
    } finally {
        pending = false;
    }
}
/** The person moved on (chose another unit): a tip waiting to show, or open, is dropped. */
function dismissTip() {
    tipToken += 1;
    if (current.value?.kind === 'tip') close(false);
}
const busy = () => state.tourActive || current.value !== null || pending;

// ---- showing and closing ----------------------------------------------------------------
async function show() {
    placement.value = null;
    await nextTick();
    reposition();
    await nextTick();
    primary.value?.focus({ preventScroll: true });
}
const FOCUSABLE = 'button, a[href], input, [tabindex="0"]';
function close(returnFocus: boolean) {
    const was = current.value;
    // Back to the control the popover was about, unless the person has already gone elsewhere.
    const active = document.activeElement;
    const focusWasHere =
        !active || active === document.body || !!box.value?.contains(active);
    current.value = null;
    placement.value = null;
    if (!was || !returnFocus || !focusWasHere) return;
    const target = was.anchor.matches(FOCUSABLE)
        ? was.anchor
        : was.anchor.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus({ preventScroll: true });
}
function dismiss() {
    if (current.value?.kind === 'tour') closeTour();
    else close(true);
}

/** The point the "map" step shows: the middle of the part of the map no panel covers. */
function mapCentre(el: HTMLElement): Box {
    const r = el.getBoundingClientRect();
    const left = r.left + props.mapInset.left;
    return {
        left: left + (r.width - props.mapInset.left) / 2,
        top: r.top + (r.height - props.mapInset.bottom) / 2,
        width: 0,
        height: 0,
    };
}
/** A control above the phone's sheet keeps its popover above the sheet too. */
function roomBelow(anchor: Box): number {
    const floor = window.innerHeight - props.mapInset.bottom;
    return anchor.top + anchor.height <= floor ? floor : window.innerHeight;
}
function reposition() {
    const c = current.value;
    const el = box.value;
    if (!c || !el) return;
    const r = c.centre ? mapCentre(c.anchor) : c.anchor.getBoundingClientRect();
    const avoid: Box[] =
        c.kind === 'tip' && props.avoidMap
            ? [
                  {
                      left: 0,
                      top: 0,
                      width: window.innerWidth,
                      height: window.innerHeight - props.mapInset.bottom,
                  },
              ]
            : [];
    const next = placePopover({
        anchor: { left: r.left, top: r.top, width: r.width, height: r.height },
        size: { width: el.offsetWidth, height: el.offsetHeight },
        viewport: { width: window.innerWidth, height: roomBelow(r) },
        prefer: c.sides,
        avoid,
        // On a wide screen the side panel is not covered by what points at the map.
        minLeft: r.left >= props.mapInset.left ? props.mapInset.left + 12 : 12,
    });
    // Beside a focused unit on a phone nothing clear is left near the control: dock above the sheet.
    const docked = c.kind === 'tip' && props.avoidMap && !next.clear;
    const p = placement.value;
    if (
        !p ||
        p.left !== next.left ||
        p.top !== next.top ||
        p.side !== next.side ||
        p.docked !== docked
    )
        placement.value = { ...next, docked };
}
/** Keep up with a sheet that moves or a row that scrolls; drop a step whose control has gone. */
function tick() {
    const c = current.value;
    if (!c) return;
    if (!c.anchor.isConnected || !isVisible(c.anchor)) {
        if (c.kind === 'tip') return close(false);
        const r = c.step && resolveStep(c.step);
        if (!r) return void goto(index + 1);
        c.anchor = r.anchor;
    }
    reposition();
}
const timer = window.setInterval(tick, 250);
onBeforeUnmount(() => {
    window.clearInterval(timer);
    tipToken += 1;
    state.tourActive = false;
});
useEventListener(window, 'resize', tick);
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    if (current.value && e.key === 'Escape') dismiss();
});
// A tap anywhere else puts a tip away (the tour stays: it is a walk the person chose to take).
useEventListener(
    document,
    'pointerdown',
    (e: Event) => {
        if (current.value?.kind !== 'tip') return;
        if (box.value?.contains(e.target as Node)) return;
        close(false);
    },
    { capture: true },
);

// ---- looks ------------------------------------------------------------------------------
const POINTER: Record<Placement['side'], string> = {
    below: '-top-[6px] border-t-[1.5px] border-l-[1.5px]',
    above: '-bottom-[6px] border-r-[1.5px] border-b-[1.5px]',
    left: '-right-[6px] border-t-[1.5px] border-r-[1.5px]',
    right: '-left-[6px] border-b-[1.5px] border-l-[1.5px]',
};
const boxStyle = computed(() => {
    const p = placement.value;
    if (!p) return { left: '0px', top: '0px', visibility: 'hidden' as const };
    // Docked: clear of the zoom controls on the right, like the outside-tap hint.
    if (p.docked)
        return {
            left: '12px',
            right: '72px',
            width: 'auto',
            bottom: `${props.mapInset.bottom + 12}px`,
        };
    return { left: `${p.left}px`, top: `${p.top}px` };
});
const pointerStyle = computed(() => {
    const p = placement.value;
    if (!p) return {};
    return p.side === 'below' || p.side === 'above'
        ? { left: `${p.arrow - 5}px` }
        : { top: `${p.arrow - 5}px` };
});

defineExpose({ startTour, restartTour, showTip, dismissTip, busy });
</script>

<template>
    <Transition
        enter-active-class="transition-opacity duration-150 motion-reduce:transition-none"
        enter-from-class="opacity-0"
    >
        <div
            v-if="current"
            ref="box"
            role="dialog"
            aria-modal="false"
            aria-labelledby="onboarding-text"
            data-onboarding-popover
            :data-kind="current.kind"
            :data-side="placement?.side"
            class="pointer-events-auto fixed z-40 w-[min(300px,calc(100vw-24px))] rounded-md border-[1.5px] border-ink bg-surface p-3 text-ink"
            :style="boxStyle"
        >
            <span
                v-if="placement && !placement.docked"
                class="absolute size-2.5 rotate-45 border-ink bg-surface"
                :class="POINTER[placement.side]"
                :style="pointerStyle"
                aria-hidden="true"
            />
            <div
                :class="current.kind === 'tip' ? 'flex items-center gap-2' : ''"
            >
                <p
                    id="onboarding-text"
                    class="min-w-0 flex-1 text-[15px] leading-snug"
                >
                    {{ current.text }}
                </p>
                <button
                    v-if="current.kind === 'tip'"
                    ref="primary"
                    type="button"
                    class="flex min-h-11 shrink-0 items-center justify-center rounded-md bg-ink px-4 text-[14px] font-medium text-surface focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
                    @click="dismiss"
                >
                    Got it
                </button>
            </div>
            <p
                v-if="current.detail"
                class="mt-1 text-[14px] leading-snug text-muted-ink"
            >
                {{ current.detail }}
            </p>
            <div
                v-if="current.kind === 'tour'"
                class="mt-2 flex items-center gap-1"
            >
                <span class="mr-auto text-[13px] text-muted-ink tabular-nums"
                    >{{ current.position }} of {{ current.total }}</span
                >
                <button
                    v-if="!isLast"
                    type="button"
                    class="min-h-11 px-2 text-[14px] underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                    @click="dismiss"
                >
                    Skip
                </button>
                <button
                    ref="primary"
                    type="button"
                    class="flex min-h-11 items-center justify-center rounded-md bg-ink px-4 text-[14px] font-medium text-surface focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
                    @click="isLast ? dismiss() : next()"
                >
                    {{ isLast ? 'Done' : 'Next' }}
                </button>
            </div>
        </div>
    </Transition>
</template>
