// Hand a finished card to the phone's share sheet (WhatsApp, X...) or save it as a file.

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

const PROBE = () =>
    new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' });

/** True when this browser can share image files (most phones; few desktops). */
export function canShareFiles(): boolean {
    if (typeof navigator === 'undefined') return false;
    if (typeof navigator.share !== 'function') return false;
    try {
        return navigator.canShare?.({ files: [PROBE()] }) ?? false;
    } catch {
        return false;
    }
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Some browsers read the object URL after click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Share the image as a file where the device supports it, otherwise download it. A cancelled
 * share sheet is left alone; any other share failure falls back to a download. `text` goes with
 * the file where the receiving app takes it (a caption, say).
 */
export async function shareOrDownload(
    blob: Blob,
    filename: string,
    title: string,
    text?: string,
): Promise<ShareResult> {
    const file = new File([blob], filename, {
        type: blob.type || 'image/png',
    });
    const files = [file];
    let canShare = false;
    try {
        canShare =
            typeof navigator !== 'undefined' &&
            typeof navigator.share === 'function' &&
            (navigator.canShare?.({ files }) ?? false);
    } catch {
        canShare = false;
    }
    if (canShare) {
        try {
            await navigator.share(
                text ? { files, title, text } : { files, title },
            );
            return 'shared';
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError')
                return 'cancelled';
        }
    }
    downloadBlob(blob, filename);
    return 'downloaded';
}

export type ShareFilesResult = 'shared' | 'cancelled' | 'blocked' | 'unavailable';

/**
 * Share several images in one call (a series), where the device can share them all. `blocked`:
 * the browser refused because the tap that asked is too long ago (the images took a while to
 * make), so the person can tap again; `unavailable`: this device cannot share these files, or
 * the share failed some other way, and the caller saves them instead.
 */
export async function shareFiles(
    items: readonly { blob: Blob; filename: string }[],
    title: string,
    text?: string,
): Promise<ShareFilesResult> {
    const files = items.map(
        (i) => new File([i.blob], i.filename, { type: i.blob.type || 'image/png' }),
    );
    try {
        if (
            typeof navigator === 'undefined' ||
            typeof navigator.share !== 'function' ||
            !(navigator.canShare?.({ files }) ?? false)
        )
            return 'unavailable';
    } catch {
        return 'unavailable';
    }
    try {
        await navigator.share(text ? { files, title, text } : { files, title });
        return 'shared';
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
        if (error instanceof DOMException && error.name === 'NotAllowedError') return 'blocked';
        return 'unavailable';
    }
}
