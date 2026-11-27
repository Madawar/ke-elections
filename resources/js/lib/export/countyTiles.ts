// The county tile grid: one equal tile per county, laid out roughly like the map, by IEBC county
// code (never by name). North is at the top, the lake counties are on the left, the coast at the
// bottom right and Nairobi City near the middle; the bottom-left corner is left empty for the key.
//
// Real neighbours are kept next to each other where the shape allows: the grid is checked against
// the counties that share a border (countyNeighbours.json, computed from the committed county
// boundaries by boundaries/pipeline/neighbours.mjs), and the pairs still apart are recorded in
// docs/superpowers/plans/2026-11-27-share-formats-2-progress.md.

export interface TileCell {
    col: number;
    row: number;
}

export const TILE_COLUMNS = 8;
export const TILE_ROWS = 9;

/** County code to its cell. The names are for the reader; the card takes them from the unit index. */
export const COUNTY_TILES: Record<number, TileCell> = {
    // Row 0
    23: { col: 3, row: 0 }, // Turkana
    10: { col: 4, row: 0 }, // Marsabit
    9: { col: 7, row: 0 }, // Mandera
    // Row 1
    26: { col: 1, row: 1 }, // Trans Nzoia
    24: { col: 2, row: 1 }, // West Pokot
    30: { col: 3, row: 1 }, // Baringo
    25: { col: 4, row: 1 }, // Samburu
    8: { col: 6, row: 1 }, // Wajir
    // Row 2
    39: { col: 0, row: 2 }, // Bungoma
    37: { col: 1, row: 2 }, // Kakamega
    27: { col: 2, row: 2 }, // Uasin Gishu
    28: { col: 3, row: 2 }, // Elgeyo/Marakwet
    31: { col: 4, row: 2 }, // Laikipia
    11: { col: 5, row: 2 }, // Isiolo
    // Row 3
    40: { col: 0, row: 3 }, // Busia
    38: { col: 1, row: 3 }, // Vihiga
    29: { col: 2, row: 3 }, // Nandi
    18: { col: 3, row: 3 }, // Nyandarua
    19: { col: 4, row: 3 }, // Nyeri
    12: { col: 5, row: 3 }, // Meru
    // Row 4
    41: { col: 0, row: 4 }, // Siaya
    42: { col: 1, row: 4 }, // Kisumu
    35: { col: 2, row: 4 }, // Kericho
    32: { col: 3, row: 4 }, // Nakuru
    21: { col: 4, row: 4 }, // Murang'a
    20: { col: 5, row: 4 }, // Kirinyaga
    // Row 5
    43: { col: 0, row: 5 }, // Homa Bay
    46: { col: 1, row: 5 }, // Nyamira
    36: { col: 2, row: 5 }, // Bomet
    22: { col: 3, row: 5 }, // Kiambu
    14: { col: 4, row: 5 }, // Embu
    13: { col: 5, row: 5 }, // Tharaka - Nithi
    7: { col: 7, row: 5 }, // Garissa
    // Row 6
    44: { col: 0, row: 6 }, // Migori
    45: { col: 1, row: 6 }, // Kisii
    33: { col: 2, row: 6 }, // Narok
    47: { col: 3, row: 6 }, // Nairobi City
    16: { col: 4, row: 6 }, // Machakos
    15: { col: 5, row: 6 }, // Kitui
    4: { col: 6, row: 6 }, // Tana River
    5: { col: 7, row: 6 }, // Lamu
    // Row 7
    34: { col: 3, row: 7 }, // Kajiado
    17: { col: 4, row: 7 }, // Makueni
    6: { col: 5, row: 7 }, // Taita Taveta
    3: { col: 6, row: 7 }, // Kilifi
    // Row 8
    2: { col: 5, row: 8 }, // Kwale
    1: { col: 6, row: 8 }, // Mombasa
};
