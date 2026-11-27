// Which ward contains a point (for "Find my ward"); plain ray casting, no dependencies.
type Ring = number[][];
type Geometry =
    | { type: 'Polygon'; coordinates: Ring[] }
    | { type: 'MultiPolygon'; coordinates: Ring[][] };

function inRing([x, y]: number[], ring: Ring): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}

const inPolygon = (p: number[], rings: Ring[]) =>
    inRing(p, rings[0]) && !rings.slice(1).some((hole) => inRing(p, hole));

export function pointInGeometry(point: [number, number], g: Geometry): boolean {
    return g.type === 'Polygon'
        ? inPolygon(point, g.coordinates)
        : g.coordinates.some((poly) => inPolygon(point, poly));
}

export function findContaining<
    T extends { geometry: Geometry; properties: { code: number } },
>(features: T[], point: [number, number]): number | null {
    return (
        features.find((f) => pointInGeometry(point, f.geometry))?.properties
            .code ?? null
    );
}
