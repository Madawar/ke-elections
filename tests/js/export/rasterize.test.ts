import { describe, expect, it } from 'vitest';
import { fontFaceCss, serializeSvg } from '@/lib/export/rasterize';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('serializeSvg', () => {
    it('sizes a copy, inlines the font faces, and leaves the original alone', () => {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 1080 1080');
        svg.setAttribute('class', 'w-full');
        const text = document.createElementNS(SVG_NS, 'text');
        text.textContent = 'Ngei';
        svg.appendChild(text);

        const css = fontFaceCss([
            {
                family: 'Archivo Variable',
                src: 'data:font/woff2;base64,AAAA',
                weight: '100 900',
                stretch: '62% 125%',
                unicodeRange: 'U+0000-00FF',
            },
        ]);
        const out = serializeSvg(svg, 1080, 1080, css);

        expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(out).toContain('width="1080"');
        expect(out).toContain('height="1080"');
        expect(out).toContain("font-family: 'Archivo Variable'");
        expect(out).toContain('url(data:font/woff2;base64,AAAA)');
        expect(out).toContain('unicode-range: U+0000-00FF');
        expect(out).toContain('Ngei');
        expect(out).not.toContain('class="w-full"');
        expect(svg.querySelector('style')).toBeNull();
        expect(svg.getAttribute('width')).toBeNull();
    });
});
