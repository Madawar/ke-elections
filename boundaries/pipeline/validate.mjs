// Sanity checks for a GeoJSON feature set keyed by an integer code 1..expected.

const hasCoordinates = (geometry) => Array.isArray(geometry?.coordinates) && geometry.coordinates.length > 0;

export function validateCodes(features, { key, expected }) {
    const seen = new Set();
    const missing = [];
    const duplicates = new Set();
    const outOfRange = [];
    const empty = [];

    for (const feature of features) {
        const code = Number(feature.properties?.[key]);

        if (!Number.isInteger(code) || code < 1 || code > expected) {
            outOfRange.push(code);
        } else if (seen.has(code)) {
            duplicates.add(code);
        } else {
            seen.add(code);
        }

        if (!hasCoordinates(feature.geometry)) empty.push(code);
    }

    for (let code = 1; code <= expected; code++) {
        if (!seen.has(code)) missing.push(code);
    }

    const result = { missing, duplicates: [...duplicates], outOfRange, empty };
    const ok = Object.values(result).every((list) => list.length === 0);
    return { ok, ...result };
}
