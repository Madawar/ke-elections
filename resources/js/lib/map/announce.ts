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
