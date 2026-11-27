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

/** What a party's numbers cover: a county or a constituency; null is all of Kenya. */
export type PartyScope = { level: 'county' | 'constituency'; code: number } | null;

/**
 * A party's page: its abbreviation in lower case, and the place its numbers cover after `?in=`
 * (`/party/uda`, `/party/wdm-k`, `/party/uda?in=county-47`).
 */
export const partyPath = (abbrev: string, scope: PartyScope = null): string =>
    `/party/${abbrev.toLowerCase()}${scope ? `?in=${scope.level}-${scope.code}` : ''}`;

/** The abbreviation (lower case) and scope in a party path; null for any other path. */
export function parsePartyPath(
    path: string,
): { abbrev: string; scope: PartyScope } | null {
    const m =
        /^\/party\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?(?:\?(.*))?$/i.exec(path);
    if (!m) return null;
    const scope = /^(county|constituency)-([1-9][0-9]*)$/.exec(
        new URLSearchParams(m[2] ?? '').get('in') ?? '',
    );
    return {
        abbrev: m[1].toLowerCase(),
        scope: scope
            ? { level: scope[1] as 'county' | 'constituency', code: Number(scope[2]) }
            : null,
    };
}
