<script setup lang="ts">
// "Share this view": the map as filtered now, as a social image with its caption. Pick a size and
// a theme, edit the headline, then share the image with its caption (phones), download it, or
// copy the caption. The view is fixed when the dialog opens, so the card does not change under
// the person. The PNG is made as soon as the preview is ready, so a tap on "Share" reaches the
// share sheet while the browser still counts it as the person's tap.
import { refDebounced, useStorage } from '@vueuse/core';
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
import ViewCard from './ViewCard.vue';
import { captionFor } from '@/lib/export/caption';
import { CARD_FONTS } from '@/lib/export/fonts';
import { siteUrl } from '@/lib/export/format';
import { FontLoadError, svgToPng } from '@/lib/export/rasterize';
import {
    canShareFiles,
    downloadBlob,
    shareOrDownload,
} from '@/lib/export/share';
import {
    VIEW_SIZES,
    VIEW_SIZE_LABELS,
    type ViewSize,
    viewFilename,
} from '@/lib/export/sizes';
import {
    type ViewMapContext,
    renderViewMap,
    viewMapAspect,
} from '@/lib/export/viewMap';
import { viewLayout } from '@/lib/export/viewLayout';
import {
    type ViewState,
    headlineFor,
    seatsInTheme,
    withTheme,
} from '@/lib/export/viewState';
import { THEMES, type ThemeName } from '@/lib/map/theme';

const props = defineProps<{
    view: ViewState;
    context: ViewMapContext;
}>();
const open = defineModel<boolean>('open', { default: false });

const SIZES = Object.keys(VIEW_SIZES) as ViewSize[];
const stored = useStorage<ViewSize>('km.viewSize', 'square');
const size = computed<ViewSize>({
    get: () => (SIZES.includes(stored.value) ? stored.value : 'square'),
    set: (v) => (stored.value = v),
});
const themeName = ref<ThemeName>(props.view.theme);
const theme = computed(() => THEMES[themeName.value]);
const shown = computed(() =>
    withTheme(props.view, themeName.value, props.context),
);

const HEADLINE_MAX = 120;
const generated = computed(() => headlineFor(props.view));
const headlineInput = ref(generated.value);
/** The card follows the typing after a short pause, so the map is not redrawn on every key. */
const headlineTyped = refDebounced(headlineInput, 350);
const headline = computed(
    () => headlineTyped.value.trim().slice(0, HEADLINE_MAX) || generated.value,
);
const edited = computed(() => headlineInput.value.trim() !== generated.value);

const url = computed(() => siteUrl(props.view.path));
const caption = computed(() =>
    captionFor(
        shown.value,
        url.value,
        size.value === 'x' ? 'x' : 'instagram',
        headline.value,
    ),
);
const mapAspect = computed(() => viewMapAspect(props.view));
/** When this size has no room for every row, say how many it lists and which size lists all. */
const rowsHint = computed(() => {
    const at = (s: ViewSize) =>
        viewLayout(s, shown.value, {
            headline: headline.value,
            url: url.value,
            mapAspect: mapAspect.value,
        });
    const here = at(size.value);
    if (!here.rowsMore) return '';
    const all = shown.value.mix.rows.length;
    const fits = SIZES.filter((s) => !at(s).rowsMore).map(
        (s) => VIEW_SIZE_LABELS[s],
    );
    return `This size lists ${here.mixRows.length} of the ${all} ${shown.value.mix.rowWord}.${fits.length ? ` ${fits.join(' and ')} ${fits.length === 1 ? 'lists' : 'list'} them all.` : ''}`;
});
const filename = computed(() => viewFilename(props.view, size.value));

const mapImage = ref<string | null>(null);
const mapStatus = ref('Drawing the map…');
const blob = shallowRef<Blob | null>(null);
const status = ref<'drawing' | 'ready' | 'error'>('drawing');
const message = ref('');
const card = ref<HTMLElement | null>(null);
const captionBox = ref<HTMLTextAreaElement | null>(null);
const canShare = ref(false);

// Map images by size, theme and box: a changed headline only redraws the map when it moves the box.
const images = new Map<string, Promise<string>>();
let token = 0;
/** The map the latest build is waiting for; a queued drawing of any other map is skipped. */
let wantedKey = '';
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

async function build() {
    const t = ++token;
    const s = size.value;
    const name = themeName.value;
    status.value = 'drawing';
    message.value = 'Drawing the card…';
    blob.value = null;
    const box = viewLayout(s, shown.value, {
        headline: headline.value,
        url: url.value,
        mapAspect: mapAspect.value,
    }).map;
    const key = `${s}|${name}|${box.w}x${box.h}`;
    wantedKey = key;
    let pending = images.get(key);
    if (!pending) {
        mapImage.value = null;
        mapStatus.value = 'Drawing the map…';
        const view = shown.value;
        pending = queue.then(() => {
            // Skip a map nobody waits for any more; a later build may still want this one,
            // even after the build that queued it has moved on.
            if (key !== wantedKey) throw new Superseded();
            return renderViewMap(
                view,
                {
                    ...props.context,
                    seats: seatsInTheme(props.context.seats, name),
                },
                THEMES[name],
                box,
            );
        });
        queue = pending.catch(() => {});
        images.set(key, pending);
    }
    try {
        const image = await pending;
        if (t !== token) return;
        mapImage.value = image;
    } catch (error) {
        images.delete(key);
        if (t !== token) return;
        // Skipped while another size was wanted, and wanted again now: draw it.
        if (error instanceof Superseded) return void build();
        console.error(error);
        // Say so in the dialog, never on the card: no image is made without its map.
        mapImage.value = null;
        mapStatus.value = '';
        status.value = 'error';
        message.value =
            'The map could not be drawn on this device, so no image was made. Try again, or try another browser.';
        return;
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

watch(
    [open, size, themeName, headline],
    ([isOpen]) => {
        if (isOpen) {
            canShare.value = canShareFiles();
            void build();
        } else {
            token++;
            images.clear();
        }
    },
    { immediate: true },
);
// A new view (opened again from another state) starts from its own headline and theme.
watch(
    () => props.view,
    (view) => {
        images.clear();
        themeName.value = view.theme;
        headlineInput.value = headlineFor(view);
    },
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
                            Share this view
                        </DialogTitle>
                        <DialogDescription class="text-[14px] text-muted-ink">
                            The map as it is now, with its numbers, sized for
                            Instagram, stories or X.
                        </DialogDescription>
                    </div>
                    <DialogClose
                        class="min-h-11 px-2 text-[14px] underline underline-offset-4"
                    >
                        Close
                    </DialogClose>
                </div>

                <div class="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-2">
                    <fieldset>
                        <legend class="mb-2 text-[15px] font-semibold">
                            Size
                        </legend>
                        <div class="grid grid-cols-4 gap-1.5">
                            <label
                                v-for="s in SIZES"
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
                    </fieldset>

                    <fieldset class="mt-3">
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

                    <div class="mt-3">
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
                                @click="headlineInput = generated"
                            >
                                Use the numbers again
                            </button>
                        </div>
                        <input
                            id="view-headline"
                            v-model="headlineInput"
                            type="text"
                            :maxlength="HEADLINE_MAX"
                            class="mt-1 h-11 w-full rounded-md border border-hairline bg-surface px-3 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                        />
                        <p class="mt-1 text-[13px] text-muted-ink">
                            Keep it to the numbers, so the image stays neutral.
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
                        <ViewCard
                            :view="shown"
                            :size="size"
                            :headline="headline"
                            :map-image="mapImage"
                            :map-placeholder="mapStatus"
                            :map-aspect="mapAspect"
                            :url="url"
                            :theme="theme"
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
                        {{ message }}
                    </p>
                    <div class="flex gap-2">
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
