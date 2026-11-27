// The second line of a ward's label in the MCA view: "<MCA name> (<ABBREV>)".
//
// It shows on the selected ward only. The plan's first rule was "wherever it fits": from zoom
// 11.5 or inside a focused constituency, on wards large enough on screen. That was built and
// looked at (2026-11-27): in a dense constituency (Mathare, Nairobi City) small or odd-shaped
// wards carried three-line labels that ran over their neighbours and the MP outline, and the
// unit directory has only bounding boxes to judge "large enough" by, which a long thin ward
// passes. So the plan's fallback applies: the name shows on the ward the person selected (and in
// the tooltip of a ward the pointer is over), where it always has the room.
import { textWidth, wrapText } from '@/lib/export/text';

/** The label's widest line, in ems of its text size (MapLibre's `text-max-width`). */
export const NAME_LINE_MAX_EMS = 9;

/**
 * A name line the label can carry: it wraps onto two lines at most, on spaces, with no word wider
 * than a line. A longer one is not shown at all (never cut mid-word).
 */
export function fitsNameLine(line: string, size = 11): boolean {
    const max = NAME_LINE_MAX_EMS * size;
    if (line.split(/\s+/).some((word) => textWidth(word, size) > max))
        return false;
    return wrapText(line, max, size).length <= 2;
}
