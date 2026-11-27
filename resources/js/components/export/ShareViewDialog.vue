<script setup lang="ts">
// "Share this view": the map as filtered now, as a social image with its caption. Pick a size and
// a theme, edit the headline, then share the image with its caption (phones), download it, or
// copy the caption. The view is fixed when the dialog opens, so the card does not change under
// the person. The PNG is made as soon as the preview is ready, so a tap on "Share" reaches the
// share sheet while the browser still counts it as the person's tap.
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { useStorage, watchDebounced } from '@vueuse/core';
import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
} from 'reka-ui';
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { CARD_FONTS } from '@/lib/export/fonts';
import { siteUrl } from '@/lib/export/format';
import type { ViewLayout } from '@/lib/export/viewLayout';
import { FontLoadError, svgToPng } from '@/lib/export/rasterize';
import {
    canShareFiles,
    downloadBlob,
    shareFiles,
    shareOrDownload,
} from '@/lib/export/share';
import {
    VIEW_SIZES,
    VIEW_SIZE_LABELS,
    type ViewSize,
} from '@/lib/export/sizes';
import {
    type MapSlot,
    type ShareCard,
    type ShareableView,
    aspectOf,
    captionOf,
    componentOf,
    dialogCopy,
    filenameOf,
    headlineEditable,
    headlineWording,
    headlineOf,
    inTheme,
    layoutOf,
    mapSlotsOf,
    shareCards,
    sizesOf,
    slideFilename,
    slidePlace,
} from '@/lib/export/shareView';
import { type ViewMapContext, renderViewMap } from '@/lib/export/viewMap';
import { seatsInTheme } from '@/lib/export/viewState';
import { THEMES, type ThemeName } from '@/lib/map/theme';
import { TIPS, claimTip } from '@/lib/onboarding';

const props = defineProps<{
    /** The card the dialog opens on: any kind in the registry (`lib/export/shareView.ts`). */
    view: ShareableView;
    /**
     * The "Card" choice: the cards on offer for what is in view, the first being `view` itself
     * ("This view", then "County leaders", "By the numbers", ...). Absent or one card: no choice.
     */
    cards?: readonly ShareCard[];
    context: ViewMapContext;
}>();
const open = defineModel<boolean>('open', { default: false });

const options = computed<readonly ShareCard[]>(() =>
    props.cards?.length ? props.cards : shareCards([props.view]),
);
/** Which card is being made, by its key in `options`. */
const which = ref(options.value[0].key);
const current = computed(() =>
    options.value.find((o) => o.key === which.value),
);
/** The card's own choice, if it has one ("Compare with"); the dialog only shows it. */
const choice = computed(() => current.value?.choice ?? null);
/**
 * The person's pick for each card with a choice, by card key, while the dialog is open with
 * these cards; a card not in here is on its choice's own `value`, whose view is the card's view.
 */
const picks = ref<Record<string, string>>({});
const picked = computed(() => {
    const c = choice.value;
    return c ? (picks.value[which.value] ?? c.value) : null;
});
/** The slides of a series, while one is picked: the dialog only knows the entry has slides. */
const slides = computed(() => current.value?.slides ?? null);
/** The slide shown of each series, by card key, while the dialog is open with these cards. */
const steps = ref<Record<string, number>>({});
const step = computed(() => {
    const list = slides.value;
    return list
        ? Math.max(0, Math.min(steps.value[which.value] ?? 0, list.length - 1))
        : 0;
});
function setStep(i: number) {
    if (slides.value) steps.value = { ...steps.value, [which.value]: i };
}
/** "2 of 4" in each slide's footer; none for a card outside a series. */
const place = computed(() =>
    slides.value ? slidePlace(step.value, slides.value.length) : undefined,
);
const base = computed<ShareableView>(() => {
    if (slides.value) return slides.value[step.value];
    const c = choice.value;
    const p = picked.value;
    if (c && p !== null && p !== c.value) return c.make(p);
    return current.value?.view ?? props.view;
});
function choose(value: string) {
    const c = choice.value;
    if (!c) return;
    picks.value = { ...picks.value, [which.value]: value };
    c.remember?.(value);
}

/**
 * The card's sizes. The person's stored size is shown when the card has it; otherwise the card's
 * first size is, and the stored choice stays for the next card that has it.
 */
const sizes = computed(() => {
    const list = slides.value;
    // A series offers the sizes every slide has, in the first slide's order.
    return list
        ? sizesOf(list[0]).filter((s) => list.every((v) => sizesOf(v).includes(s)))
        : sizesOf(base.value);
});
const stored = useStorage<ViewSize>('km.viewSize', 'square');
const size = computed<ViewSize>({
    get: () =>
        sizes.value.includes(stored.value) ? stored.value : sizes.value[0],
    set: (v) => (stored.value = v),
});
const themeName = ref<ThemeName>(base.value.theme);
const theme = computed(() => THEMES[themeName.value]);
const shown = computed(() =>
    inTheme(base.value, themeName.value, props.context),
);
/** The registry's component for the card; the template gives every card the same props. */
const cardComponent = computed(() => componentOf(shown.value));
/** The seat view alone says when a size leaves rows out (`rowsHint`). */
const seatView = computed(() => {
    const v = shown.value;
    return v.kind === 'party' ? v : null;
});
/** A series is described, and captioned, by its first slide. */
const copy = computed(() => dialogCopy(slides.value?.[0] ?? base.value));

const HEADLINE_MAX = 120;
const generated = computed(() => headlineOf(base.value));
/** False for a card whose headline is a fixed template: it is shown, not edited. */
const editable = computed(
    () => !slides.value && headlineEditable(base.value),
);
const wording = computed(() => headlineWording(base.value));
const headlineInput = ref(generated.value);
/**
 * The headline on the card. It follows the typing after a short pause, so the map is not redrawn
 * on every key; a headline the dialog sets itself (opening, switching card, "Use the numbers
 * again") goes on at once, so a card never carries the other card's headline while a pause runs.
 */
const headlineTyped = ref(headlineInput.value);
watchDebounced(headlineInput, (text) => (headlineTyped.value = text), {
    debounce: 350,
});
function setHeadline(text: string) {
    headlineInput.value = text;
    headlineTyped.value = text;
}
const headline = computed(() =>
    editable.value
        ? headlineTyped.value.trim().slice(0, HEADLINE_MAX) || generated.value
        : generated.value,
);
const edited = computed(() => headlineInput.value.trim() !== generated.value);

const url = computed(() => siteUrl(base.value.path));
const caption = computed(() => {
    const first = slides.value?.[0];
    return captionOf(
        first ? inTheme(first, themeName.value, props.context) : shown.value,
        first ? siteUrl(first.path) : url.value,
        size.value === 'x' ? 'x' : 'instagram',
        first ? headlineOf(first) : headline.value,
    );
});
const mapAspect = computed(() => aspectOf(base.value));
/** When this size has no room for every row, say how many it lists and which size lists all. */
const rowsHint = computed(() => {
    const v = seatView.value;
    if (!v) return '';
    const at = (s: ViewSize) =>
        layoutOf(s, v, {
            headline: headline.value,
            url: url.value,
            mapAspect: mapAspect.value,
        }) as ViewLayout;
    const here = at(size.value);
    if (!here.rowsMore) return '';
    const all = v.mix.rows.length;
    const fits = sizes.value
        .filter((s) => !at(s).rowsMore)
        .map((s) => VIEW_SIZE_LABELS[s]);
    return `This size lists ${here.mixRows.length} of the ${all} ${v.mix.rowWord}.${fits.length ? ` ${fits.join(' and ')} ${fits.length === 1 ? 'lists' : 'list'} them all.` : ''}`;
});
const filename = computed(() =>
    slides.value
        ? slideFilename(base.value, size.value, step.value, slides.value.length)
        : filenameOf(base.value, size.value),
);

/** The card's map images by slot key; `mapImage` is the one-map cards' "map". */
const mapImages = shallowRef<Record<string, string>>({});
const mapImage = computed(() => mapImages.value.map ?? null);
const mapStatus = ref('Drawing the map…');
const blob = shallowRef<Blob | null>(null);
const status = ref<'drawing' | 'ready' | 'error'>('drawing');
const message = ref('');
/** "Drawing 2 of 4…" while every slide of a series is made; shown in place of the message. */
const progress = ref('');
interface SlideFile {
    blob: Blob;
    filename: string;
}
/** Counts the runs of "Download all"; closing the dialog or a newer run stops an older one. */
let batch = 0;
const batching = ref(false);
/** The last series made, for the size and theme it was made in, so a second tap reuses it. */
let made: { key: string; files: SlideFile[] } | null = null;

const card = ref<HTMLElement | null>(null);
const captionBox = ref<HTMLTextAreaElement | null>(null);
const canShare = ref(false);

// Map images by card (with its pick, for a card with a choice), size, theme, slot and box: a
// changed headline only redraws a map when it moves its box, and each card's maps are kept apart.
const images = new Map<string, Promise<string>>();
/** The keys in `images` whose drawing has finished; the others are queued or drawing. */
const finished = new Set<string>();
let token = 0;
/** The maps the latest build is waiting for; a queued drawing of any other map is skipped. */
let wanted = new Set<string>();
// Off-screen maps are drawn one at a time, however fast the person switches.
let queue: Promise<unknown> = Promise.resolve();
class Superseded extends Error {}

async function cardSvg(): Promise<SVGSVGElement | null> {
    await nextTick();
    for (let i = 0; i < 30; i++) {
        const svg = card.value?.querySelector('svg');
        if (svg) return svg;
        await new Promise((r) => requestAnimationFrame(r));
    }
    return null;
}

/** The drawing of one slot's map: the cached one, or a new one queued behind the others. */
function mapOf(slot: MapSlot, key: string, name: ThemeName): Promise<string> {
    const cached = images.get(key);
    if (cached) return cached;
    const drawing: Promise<string> = queue.then(() => {
        // Skip a map nobody waits for any more; a later build may still want this one,
        // even after the build that queued it has moved on. It leaves the cache, so coming
        // back to its card queues it again rather than meeting a skipped drawing.
        if (!wanted.has(key)) {
            if (images.get(key) === drawing) images.delete(key);
            throw new Superseded();
        }
        return renderViewMap(
            slot.spec,
            {
                ...props.context,
                seats: seatsInTheme(props.context.seats, name),
            },
            THEMES[name],
            slot.box,
        ).then((image) => {
            if (images.get(key) === drawing) finished.add(key);
            return image;
        });
    });
    queue = drawing.catch(() => {});
    images.set(key, drawing);
    return drawing;
}

/** Forget one map, so the next build that wants it draws it again. */
function forget(key: string) {
    images.delete(key);
    finished.delete(key);
}

async function build() {
    const t = ++token;
    const s = size.value;
    const name = themeName.value;
    status.value = 'drawing';
    message.value = 'Drawing the card…';
    blob.value = null;
    const slots = mapSlotsOf(s, shown.value, {
        headline: headline.value,
        url: url.value,
        mapAspect: mapAspect.value,
    });
    // A card's pick, or a slide's place, is part of its key: two picks of one card, or two slides
    // of one series, may have the same slot and box.
    const cardKey = slides.value
        ? `${which.value}#${step.value}`
        : picked.value === null
          ? which.value
          : `${which.value}=${picked.value}`;
    const keys = slots.map(
        (slot) =>
            `${cardKey}|${s}|${name}|${slot.key}|${slot.box.w}x${slot.box.h}`,
    );
    wanted = new Set(keys);
    // Any of this card's maps still to draw: the preview shows none of the maps it had (they may
    // be another card's, under the same slot key), and fills up as this card's are drawn.
    if (keys.some((k) => !finished.has(k))) {
        mapImages.value = {};
        mapStatus.value = 'Drawing the map…';
    }
    // Every slot is queued now, in the layout's order, and the card waits for all of them.
    const pending = slots.map((slot, i) => mapOf(slot, keys[i], name));
    const drawn: Record<string, string> = {};
    for (let i = 0; i < slots.length; i++) {
        try {
            drawn[slots[i].key] = await pending[i];
            if (t !== token) return;
            mapImages.value = { ...drawn };
        } catch (error) {
            if (images.get(keys[i]) === pending[i]) forget(keys[i]);
            if (t !== token) return;
            // Skipped while another card or size was wanted, and wanted again now: draw it.
            if (error instanceof Superseded) return build();
            console.error(error);
            // Say so in the dialog, never on the card: no image is made without its maps.
            mapImages.value = {};
            mapStatus.value = '';
            status.value = 'error';
            message.value =
                'The map could not be drawn on this device, so no image was made. Try again, or try another browser.';
            return;
        }
    }
    const svg = await cardSvg();
    if (t !== token) return;
    if (!svg) {
        status.value = 'error';
        message.value = 'The card could not be drawn.';
        return;
    }
    try {
        const { w, h } = VIEW_SIZES[s];
        const png = await svgToPng(svg, w, h, CARD_FONTS);
        if (t !== token) return;
        blob.value = png;
        status.value = 'ready';
        message.value = '';
    } catch (error) {
        if (t !== token) return;
        console.error(error);
        status.value = 'error';
        message.value =
            error instanceof FontLoadError
                ? 'The card’s typeface could not be loaded. Reload the page and try again.'
                : 'The image could not be made in this browser. Try another browser, or take a screenshot of the preview.';
    }
}

// The first time the dialog opens, one line says which size is for what (once ever, after the tour).
const sizeTip = ref(false);
watch(
    open,
    (isOpen) => {
        sizeTip.value = isOpen && claimTip('share-dialog');
    },
    { immediate: true },
);

/** The latest build, so "Download all" can wait for each slide's. */
let building: Promise<void> = Promise.resolve();
/** Until no newer build has started since: the card shown is then the one built. */
async function settled() {
    for (;;) {
        const b = building;
        await b;
        await nextTick();
        if (b === building) return;
    }
}

watch(
    [open, size, themeName, headline, which, picked, step],
    ([isOpen]) => {
        if (isOpen) {
            canShare.value = canShareFiles();
            building = build();
        } else {
            token++;
            // "Download all" stops with the dialog.
            batch++;
            batching.value = false;
            progress.value = '';
            made = null;
            // Nobody waits for the queued maps any more: they are skipped, not drawn.
            wanted = new Set();
            images.clear();
            finished.clear();
        }
    },
    { immediate: true },
);
// A new view (opened again from another state) starts on its first card, with that card's own
// headline and theme.
watch(
    () => [props.view, props.cards],
    () => {
        images.clear();
        finished.clear();
        picks.value = {};
        steps.value = {};
        made = null;
        which.value = options.value[0].key;
        themeName.value = base.value.theme;
        setHeadline(headlineOf(base.value));
    },
);
// The other card, or the card with another pick, has its own headline. This runs as the choice
// changes, before the card is built again, so the new card starts from its own headline (its map
// has its own cache key).
watch(
    [which, picked, step],
    () => {
        setHeadline(headlineOf(base.value));
    },
    { flush: 'sync' },
);

async function share() {
    if (!blob.value) return;
    const result = await shareOrDownload(
        blob.value,
        filename.value,
        headline.value,
        caption.value,
    );
    if (result === 'downloaded') message.value = `Saved ${filename.value}`;
}
function download() {
    if (!blob.value) return;
    downloadBlob(blob.value, filename.value);
    message.value = `Saved ${filename.value}`;
}

// ---- a series: every slide in turn ----
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Every slide of the series as an image, in order: the preview steps through them, each drawn
 * as the person would see it, and "Drawing 2 of 4" says where it is. Null when a slide could not
 * be made (the dialog then shows the usual error, on that slide) or the run was stopped.
 */
async function makeAll(): Promise<SlideFile[] | null> {
    const list = slides.value;
    if (!list) return null;
    const key = `${which.value}|${size.value}|${themeName.value}`;
    if (made?.key === key) return made.files;
    const run = ++batch;
    const back = step.value;
    batching.value = true;
    const files: SlideFile[] = [];
    let failed = false;
    try {
        for (let i = 0; i < list.length; i++) {
            progress.value = `Drawing ${i + 1} of ${list.length}…`;
            setStep(i);
            await nextTick();
            await settled();
            if (run !== batch) return null;
            if (status.value !== 'ready' || !blob.value) {
                failed = true;
                return null;
            }
            files.push({ blob: blob.value, filename: filename.value });
        }
        made = { key, files };
        return files;
    } finally {
        if (run === batch) {
            batching.value = false;
            progress.value = '';
            // Back to the slide the person was on; a failed run stays on the slide that failed.
            if (!failed && open.value) {
                setStep(back);
                await nextTick();
                await settled();
            }
        }
    }
}

/** Saves the files one after another; false when the dialog was closed on the way. */
async function saveEach(files: SlideFile[]): Promise<boolean> {
    const run = batch;
    for (const [i, f] of files.entries()) {
        if (i) await pause(250);
        if (run !== batch || !open.value) return false;
        downloadBlob(f.blob, f.filename);
    }
    // A browser may keep only the first of several downloads (some phones ask, some refuse).
    message.value = `Saved ${files.length} images. If your browser saved only some, step to each slide and use Download PNG.`;
    return true;
}

async function downloadAll() {
    const files = await makeAll();
    if (files) await saveEach(files);
}

/** Shares every slide's file in one call; where it cannot, saves them. */
async function shareAll() {
    const first = slides.value?.[0];
    const files = await makeAll();
    if (!files || !first) return;
    const result = await shareFiles(files, headlineOf(first), caption.value);
    if (result === 'blocked')
        message.value = `The ${files.length} images are ready. Tap Share all ${files.length} again to send them.`;
    else if (result === 'unavailable') await saveEach(files);
}
async function copyCaption() {
    try {
        await navigator.clipboard.writeText(caption.value);
        message.value = 'Caption copied';
    } catch {
        // No clipboard access: select the text so the person can copy it themselves.
        captionBox.value?.focus();
        captionBox.value?.select();
        message.value = 'The caption is selected. Copy it from the box above.';
    }
}
</script>

<template>
    <DialogRoot v-model:open="open">
        <DialogPortal>
            <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
            <DialogContent
                class="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-[12px] border border-b-0 border-hairline bg-surface font-display text-ink shadow-lg md:inset-auto md:top-1/2 md:left-1/2 md:w-[640px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[12px] md:border-b"
                style="font-variation-settings: 'wdth' 92"
            >
                <div class="flex items-start gap-2 px-4 pt-3">
                    <div class="min-w-0 flex-1">
                        <DialogTitle
                            class="text-[20px] leading-tight font-semibold"
                            style="font-variation-settings: 'wdth' 100"
                        >
                            {{ copy.title }}
                        </DialogTitle>
                        <DialogDescription class="text-[14px] text-muted-ink">
                            {{ copy.description }}
                        </DialogDescription>
                    </div>
                    <DialogClose
                        class="min-h-11 px-2 text-[14px] underline underline-offset-4"
                    >
                        Close
                    </DialogClose>
                </div>

                <div class="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-2">
                    <fieldset
                        v-if="options.length > 1"
                        class="mb-3"
                        :disabled="batching"
                    >
                        <legend class="mb-2 text-[15px] font-semibold">
                            Card
                        </legend>
                        <div class="grid grid-cols-2 gap-1.5">
                            <label
                                v-for="option in options"
                                :key="option.key"
                                class="flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-[14px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
                                :class="
                                    which === option.key
                                        ? 'border-ink bg-ground'
                                        : 'border-hairline'
                                "
                            >
                                <input
                                    v-model="which"
                                    type="radio"
                                    name="view-card"
                                    class="sr-only"
                                    :value="option.key"
                                />
                                {{ option.label }}
                            </label>
                        </div>
                    </fieldset>
                    <div v-if="choice" class="mb-3">
                        <label
                            for="view-card-choice"
                            class="mb-1 block text-[15px] font-semibold"
                            >{{ choice.label }}</label
                        >
                        <select
                            id="view-card-choice"
                            data-card-choice
                            :value="picked ?? undefined"
                            class="h-11 w-full rounded-md border border-hairline bg-surface px-3 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                            @change="
                                choose(
                                    ($event.target as HTMLSelectElement).value,
                                )
                            "
                        >
                            <option
                                v-for="o in choice.options"
                                :key="o.value"
                                :value="o.value"
                            >
                                {{ o.label }}
                            </option>
                        </select>
                    </div>
                    <div
                        v-if="slides"
                        role="group"
                        aria-labelledby="view-slide-label"
                        data-slide-stepper
                        class="mb-3"
                    >
                        <p
                            id="view-slide-label"
                            class="mb-1 text-[15px] font-semibold"
                        >
                            Slide
                        </p>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                aria-label="Previous slide"
                                class="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-hairline px-3 text-[14px] focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-40"
                                :disabled="step === 0 || batching"
                                @click="setStep(step - 1)"
                            >
                                <ChevronLeft class="size-4" aria-hidden="true" />
                                Previous
                            </button>
                            <span
                                data-slide-place
                                role="status"
                                class="flex-1 text-center text-[15px] tabular-nums"
                                >{{ place }}</span
                            >
                            <button
                                type="button"
                                aria-label="Next slide"
                                class="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-hairline px-3 text-[14px] focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-40"
                                :disabled="step === slides.length - 1 || batching"
                                @click="setStep(step + 1)"
                            >
                                Next
                                <ChevronRight class="size-4" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    <fieldset :disabled="batching">
                        <legend class="mb-2 text-[15px] font-semibold">
                            Size
                        </legend>
                        <div
                            class="grid gap-1.5"
                            :class="
                                sizes.length === 4 ? 'grid-cols-4' : 'grid-cols-2'
                            "
                        >
                            <label
                                v-for="s in sizes"
                                :key="s"
                                class="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-md border px-1 py-1 text-center text-[14px] leading-tight has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
                                :class="
                                    size === s
                                        ? 'border-ink bg-ground'
                                        : 'border-hairline'
                                "
                            >
                                <input
                                    v-model="size"
                                    type="radio"
                                    name="view-size"
                                    class="sr-only"
                                    :value="s"
                                />
                                <span>{{ VIEW_SIZE_LABELS[s] }}</span>
                                <span
                                    class="text-[12px] text-muted-ink tabular-nums"
                                    >{{ VIEW_SIZES[s].w }}×{{
                                        VIEW_SIZES[s].h
                                    }}</span
                                >
                            </label>
                        </div>
                        <p
                            v-if="sizeTip"
                            role="status"
                            data-onboarding-tip
                            class="mt-2 flex items-start gap-2 border-l-4 border-ink pl-3 text-[14px]"
                        >
                            <span class="min-w-0 flex-1 pt-2.5">{{
                                TIPS['share-dialog'].text({})
                            }}</span>
                            <button
                                type="button"
                                class="min-h-11 shrink-0 px-2 underline underline-offset-4"
                                @click="sizeTip = false"
                            >
                                Got it
                            </button>
                        </p>
                    </fieldset>

                    <fieldset class="mt-3" :disabled="batching">
                        <legend class="mb-2 text-[15px] font-semibold">
                            Colours
                        </legend>
                        <div class="grid grid-cols-2 gap-1.5">
                            <label
                                v-for="t in ['dark', 'light'] as const"
                                :key="t"
                                class="flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-[14px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
                                :class="
                                    themeName === t
                                        ? 'border-ink bg-ground'
                                        : 'border-hairline'
                                "
                            >
                                <input
                                    v-model="themeName"
                                    type="radio"
                                    name="view-theme"
                                    class="sr-only"
                                    :value="t"
                                />
                                {{ t === 'dark' ? 'Dark' : 'Light' }}
                            </label>
                        </div>
                    </fieldset>

                    <div v-if="editable" class="mt-3">
                        <div class="flex items-baseline justify-between gap-2">
                            <label
                                for="view-headline"
                                class="text-[15px] font-semibold"
                                >Headline</label
                            >
                            <button
                                v-if="edited"
                                type="button"
                                class="min-h-11 text-[14px] underline underline-offset-4"
                                data-headline-reset
                                @click="setHeadline(generated)"
                            >
                                {{ wording.reset }}
                            </button>
                        </div>
                        <input
                            id="view-headline"
                            v-model="headlineInput"
                            type="text"
                            :maxlength="HEADLINE_MAX"
                            class="mt-1 h-11 w-full rounded-md border border-hairline bg-surface px-3 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                        />
                        <p
                            data-headline-hint
                            class="mt-1 text-[13px] text-muted-ink"
                        >
                            {{ wording.hint }}
                        </p>
                    </div>
                    <div v-else class="mt-3">
                        <h3 class="text-[15px] font-semibold">Headline</h3>
                        <p data-fixed-headline class="mt-1 text-[15px]">
                            {{ headline }}
                        </p>
                        <p class="mt-1 text-[13px] text-muted-ink">
                            This card’s headline is fixed, so it stays neutral.
                        </p>
                    </div>

                    <p
                        v-if="rowsHint"
                        data-rows-hint
                        class="mt-3 border-l-4 border-ink pl-3 text-[14px]"
                    >
                        {{ rowsHint }}
                    </p>
                    <div
                        ref="card"
                        data-preview
                        class="mt-3 flex justify-center rounded-md border border-hairline bg-ground p-2 [&>svg]:h-auto [&>svg]:max-h-[46dvh] [&>svg]:w-auto [&>svg]:max-w-full"
                    >
                        <component
                            :is="cardComponent"
                            :view="shown"
                            :size="size"
                            :headline="headline"
                            :map-image="mapImage"
                            :map-images="mapImages"
                            :map-placeholder="mapStatus"
                            :map-aspect="mapAspect"
                            :url="url"
                            :theme="theme"
                            :page="place"
                        />
                    </div>

                    <div class="mt-3">
                        <label
                            for="view-caption"
                            class="text-[15px] font-semibold"
                            >Caption{{ size === 'x' ? ' for X' : '' }}</label
                        >
                        <textarea
                            id="view-caption"
                            ref="captionBox"
                            :value="caption"
                            readonly
                            rows="6"
                            class="mt-1 w-full resize-none rounded-md border border-hairline bg-ground px-3 py-2 text-[14px] leading-snug text-ink"
                        />
                    </div>
                </div>

                <div
                    class="border-t border-hairline px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
                >
                    <p
                        class="mb-2 min-h-5 text-[13px] text-muted-ink"
                        aria-live="polite"
                    >
                        {{ progress || message }}
                    </p>
                    <div v-if="slides" class="grid grid-cols-2 gap-2">
                        <button
                            v-if="canShare"
                            type="button"
                            class="flex h-11 items-center justify-center rounded-md bg-ink px-3 text-[15px] font-medium text-surface disabled:opacity-50"
                            :disabled="status !== 'ready' || batching"
                            @click="shareAll"
                        >
                            Share all {{ slides.length }}
                        </button>
                        <button
                            type="button"
                            class="flex h-11 items-center justify-center rounded-md border border-hairline px-3 text-[15px] font-medium disabled:opacity-50"
                            :disabled="status !== 'ready' || batching"
                            @click="download"
                        >
                            Download PNG
                        </button>
                        <button
                            type="button"
                            class="flex h-11 items-center justify-center rounded-md px-3 text-[15px] font-medium disabled:opacity-50"
                            :class="
                                canShare
                                    ? 'border border-hairline'
                                    : 'bg-ink text-surface'
                            "
                            :disabled="status !== 'ready' || batching"
                            @click="downloadAll"
                        >
                            Download all {{ slides.length }}
                        </button>
                        <button
                            type="button"
                            class="flex h-11 items-center justify-center rounded-md border border-hairline px-3 text-[15px] font-medium"
                            @click="copyCaption"
                        >
                            Copy caption
                        </button>
                    </div>
                    <div v-else class="flex gap-2">
                        <button
                            v-if="canShare"
                            type="button"
                            class="flex h-11 flex-1 items-center justify-center rounded-md bg-ink px-3 text-[15px] font-medium text-surface disabled:opacity-50"
                            :disabled="status !== 'ready'"
                            @click="share"
                        >
                            Share
                        </button>
                        <button
                            type="button"
                            class="flex h-11 flex-1 items-center justify-center rounded-md px-3 text-[15px] font-medium disabled:opacity-50"
                            :class="
                                canShare
                                    ? 'border border-hairline'
                                    : 'bg-ink text-surface'
                            "
                            :disabled="status !== 'ready'"
                            @click="download"
                        >
                            Download PNG
                        </button>
                        <button
                            type="button"
                            class="flex h-11 flex-1 items-center justify-center rounded-md border border-hairline px-3 text-[15px] font-medium"
                            @click="copyCaption"
                        >
                            Copy caption
                        </button>
                    </div>
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
