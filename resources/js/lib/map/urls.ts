import type { MapLevel } from './levels';

const LEVELS = new Set(['county', 'constituency', 'ward']);

export const unitPath = (level: MapLevel, code: number): string =>
    `/${level}/${code}`;

export function parseUnitPath(
    path: string,
): { level: MapLevel; code: number } | null {
    const m = /^\/(county|constituency|ward)\/([1-9][0-9]*)\/?$/.exec(path);
    if (!m || !LEVELS.has(m[1])) return null;
    return { level: m[1] as MapLevel, code: Number(m[2]) };
}
