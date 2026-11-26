// What the screen-reader live region says each time the selection changes.
import type { Level } from '@/lib/units';

export const LEVEL_NAME: Record<Level, string> = {
    province: 'former province',
    county: 'county',
    constituency: 'constituency',
    ward: 'ward',
};

export function announceSelection(
    unit: { l: Level; n: string } | null,
    ancestors: { n: string }[],
): string {
    if (!unit) return 'Showing all of Kenya';
    return `Selected: ${unit.n} ${LEVEL_NAME[unit.l]}, ${ancestors.map((a) => a.n).join(', ')}`;
}

/**
 * What the live region says when a person is picked in search: who, which seat, and where the
 * map has gone to show it. Without a unit (a nominated member) the overview shows their party.
 */
export function announcePerson(
    person: { name: string; title: string },
    unit: { l: Level; n: string } | null,
): string {
    const base = `${person.name}, ${person.title}`;
    return unit
        ? `${base}, shown in ${unit.n} ${LEVEL_NAME[unit.l]}`
        : `${base}, party seats highlighted in the national overview`;
}
