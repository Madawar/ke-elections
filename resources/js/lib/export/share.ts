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
 * share sheet is left alone; any other share failure falls back to a download.
 */
export async function shareOrDownload(
    blob: Blob,
    filename: string,
    title: string,
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
            await navigator.share({ files, title });
            return 'shared';
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError')
                return 'cancelled';
        }
    }
    downloadBlob(blob, filename);
    return 'downloaded';
}
