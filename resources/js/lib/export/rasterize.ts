// Turns a card's SVG into a PNG in the browser: inline the fonts as data URIs (an SVG drawn as
// an image cannot load anything else), draw it on a canvas, and encode it.

export interface CardFont {
    family: string;
    url: string;
    weight?: string;
    stretch?: string;
    unicodeRange?: string;
}

export class FontLoadError extends Error {}

const fontCache = new Map<string, Promise<string>>();

function blobToDataUri(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export function fontToDataUri(url: string): Promise<string> {
    let cached = fontCache.get(url);
    if (!cached) {
        cached = fetch(url)
            .then((r) => {
                if (!r.ok) throw new Error(`Font ${url}: HTTP ${r.status}`);
                return r.blob();
            })
            .then(blobToDataUri);
        cached.catch(() => fontCache.delete(url));
        fontCache.set(url, cached);
    }
    return cached;
}

export function fontFaceCss(
    faces: (Omit<CardFont, 'url'> & { src: string })[],
): string {
    return faces
        .map((f) =>
            [
                '@font-face {',
                `font-family: '${f.family}';`,
                `src: url(${f.src}) format('woff2');`,
                f.weight ? `font-weight: ${f.weight};` : '',
                f.stretch ? `font-stretch: ${f.stretch};` : '',
                f.unicodeRange ? `unicode-range: ${f.unicodeRange};` : '',
                '}',
            ]
                .filter(Boolean)
                .join(' '),
        )
        .join('\n');
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A standalone copy of the SVG at its pixel size, with `css` in a <style> element. */
export function serializeSvg(
    svg: SVGSVGElement,
    width: number,
    height: number,
    css: string,
): string {
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute('xmlns', SVG_NS);
    copy.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    copy.setAttribute('width', String(width));
    copy.setAttribute('height', String(height));
    copy.removeAttribute('class');
    copy.removeAttribute('style');
    const style = document.createElementNS(SVG_NS, 'style');
    style.textContent = css;
    copy.insertBefore(style, copy.firstChild);
    return new XMLSerializer().serializeToString(copy);
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'sync';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('The card could not be drawn.'));
        img.src = src;
    });
}

export async function svgToPng(
    svg: SVGSVGElement,
    width: number,
    height: number,
    fontFaces: CardFont[],
): Promise<Blob> {
    // Every box on the card is measured for Archivo, so a card in a fallback font could
    // overflow: without the font, stop and say so.
    const faces = await Promise.all(
        fontFaces.map(async (f) => {
            try {
                return { ...f, src: await fontToDataUri(f.url) };
            } catch (error) {
                throw new FontLoadError(String(error));
            }
        }),
    );
    const markup = serializeSvg(svg, width, height, fontFaceCss(faces));
    const img = await loadImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`,
    );
    await img.decode?.().catch(() => {});
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot draw images.');
    ctx.drawImage(img, 0, 0, width, height);
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) =>
                blob
                    ? resolve(blob)
                    : reject(new Error('The PNG could not be made.')),
            'image/png',
        ),
    );
}
