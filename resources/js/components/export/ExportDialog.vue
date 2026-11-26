<script setup lang="ts">
// Share-image dialog: pick a size, see the card, then share it (phones) or download it.
// The card itself comes from the default slot; `prepare` draws anything it needs first (the
// map images), once per size. The PNG is made as soon as the preview is ready, so a tap on
// "Share" reaches the share sheet while the browser still counts it as the person's tap.
import { useStorage } from '@vueuse/core';
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
import { svgToPng } from '@/lib/export/rasterize';
import {
    canShareFiles,
    downloadBlob,
    shareOrDownload,
} from '@/lib/export/share';
import { CARD_SIZES, type CardSize, SIZE_LABELS } from '@/lib/export/sizes';

export type CardImages = Record<string, string | undefined>;

const props = defineProps<{
    title: string;
    description: string;
    /** Title passed to the share sheet. */
    shareTitle: string;
    filename: (size: CardSize) => string;
    prepare?: (size: CardSize) => Promise<CardImages>;
}>();
const open = defineModel<boolean>('open', { default: false });

const SIZES = Object.keys(CARD_SIZES) as CardSize[];
const stored = useStorage<CardSize>('km.exportSize', 'square');
const size = computed<CardSize>({
    get: () => (SIZES.includes(stored.value) ? stored.value : 'square'),
    set: (v) => (stored.value = v),
});

const images = shallowRef<CardImages>({});
const mapStatus = ref('Drawing the map…');
const blob = shallowRef<Blob | null>(null);
const status = ref<'drawing' | 'ready' | 'error'>('drawing');
const message = ref('');
const card = ref<HTMLElement | null>(null);
const canShare = ref(false);

let imageCache = new Map<CardSize, Promise<CardImages>>();
let pngCache = new Map<CardSize, Blob>();
let token = 0;

/** The card's SVG, once the dialog (a portal that mounts on open) has rendered it. */
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
    status.value = 'drawing';
    message.value = 'Drawing the card…';
    blob.value = pngCache.get(s) ?? null;
    if (blob.value && imageCache.has(s)) {
        images.value = await imageCache.get(s)!;
        status.value = 'ready';
        message.value = '';
        return;
    }
    images.value = {};
    mapStatus.value = 'Drawing the map…';
    if (props.prepare) {
        let pending = imageCache.get(s);
        if (!pending) {
            pending = props.prepare(s);
            imageCache.set(s, pending);
        }
        try {
            const result = await pending;
            if (t !== token) return;
            images.value = result;
        } catch (error) {
            imageCache.delete(s);
            if (t !== token) return;
            console.error(error);
            mapStatus.value = 'The map could not be drawn on this device';
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
        const png = await svgToPng(
            svg,
            CARD_SIZES[s].w,
            CARD_SIZES[s].h,
            CARD_FONTS,
        );
        if (t !== token) return;
        pngCache.set(s, png);
        blob.value = png;
        status.value = 'ready';
        message.value = '';
    } catch (error) {
        if (t !== token) return;
        console.error(error);
        status.value = 'error';
        message.value =
            'The image could not be made in this browser. Try another browser, or take a screenshot of the preview.';
    }
}

watch(
    [open, size],
    ([isOpen]) => {
        if (isOpen) {
            canShare.value = canShareFiles();
            void build();
        } else {
            token++;
            imageCache = new Map();
            pngCache = new Map();
        }
    },
    { immediate: true },
);

async function share() {
    if (!blob.value) return;
    const result = await shareOrDownload(
        blob.value,
        props.filename(size.value),
        props.shareTitle,
    );
    if (result === 'downloaded')
        message.value = `Saved ${props.filename(size.value)}`;
}
function download() {
    if (!blob.value) return;
    downloadBlob(blob.value, props.filename(size.value));
    message.value = `Saved ${props.filename(size.value)}`;
}
</script>

<template>
    <DialogRoot v-model:open="open">
        <DialogPortal>
            <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
            <DialogContent
                class="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-[12px] border border-b-0 border-hairline bg-surface font-display text-ink shadow-lg md:inset-auto md:top-1/2 md:left-1/2 md:w-[600px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[12px] md:border-b"
                style="font-variation-settings: 'wdth' 92"
            >
                <div class="flex items-start gap-2 px-4 pt-3">
                    <div class="min-w-0 flex-1">
                        <DialogTitle
                            class="text-[20px] leading-tight font-semibold"
                            style="font-variation-settings: 'wdth' 100"
                        >
                            {{ title }}
                        </DialogTitle>
                        <DialogDescription class="text-[14px] text-muted-ink">
                            {{ description }}
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
                                    name="export-size"
                                    class="sr-only"
                                    :value="s"
                                />
                                <span>{{ SIZE_LABELS[s] }}</span>
                                <span
                                    class="text-[12px] text-muted-ink tabular-nums"
                                    >{{ CARD_SIZES[s].w }}×{{
                                        CARD_SIZES[s].h
                                    }}</span
                                >
                            </label>
                        </div>
                    </fieldset>

                    <div
                        ref="card"
                        class="mt-3 flex justify-center rounded-md border border-hairline bg-ground p-2 [&>svg]:h-auto [&>svg]:max-h-[48dvh] [&>svg]:w-auto [&>svg]:max-w-full"
                    >
                        <slot
                            :size="size"
                            :images="images"
                            :map-status="mapStatus"
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
                            Download
                        </button>
                    </div>
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
