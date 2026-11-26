// Design tokens shared by the map (MapLibre paint needs literal colours) and recorded in
// docs/design/visual-direction.md. CSS mirrors these as custom properties in resources/css/app.css.

export type ThemeName = 'light' | 'dark';

export interface MapTheme {
    ground: string; // outside Kenya / water-less background
    land: string; // Kenya fill under the unit fills
    surface: string;
    ink: string;
    muted: string;
    hairline: string;
    countyLine: string;
    constituencyLine: string;
    wardLine: string;
    selected: string;
    hover: string;
    label: string;
    labelHalo: string;
    town: string;
    noData: string; // a seat with no approved holder
    faded: string; // a seat whose party is not highlighted; distinct from the "Other" party grey and from noData
}

export const THEMES: Record<ThemeName, MapTheme> = {
    // Direction A "Ballot box"
    light: {
        ground: '#DCE3DF',
        land: '#EEF1EF',
        surface: '#FFFFFF',
        ink: '#13233A',
        muted: '#4C5B6B',
        hairline: '#D5DCD8',
        countyLine: '#13233A',
        constituencyLine: '#4C5B6B',
        wardLine: '#8D9A94',
        selected: '#13233A',
        hover: '#13233A',
        label: '#13233A',
        labelHalo: '#EEF1EF',
        town: '#4C5B6B',
        noData: '#E3E8E5',
        faded: '#C3CBC7',
    },
    // Direction B "Tally night"
    dark: {
        ground: '#0A1A23',
        land: '#0F2430',
        surface: '#16303F',
        ink: '#E8EEF0',
        muted: '#9DB0BA',
        hairline: '#284555',
        countyLine: '#E8EEF0',
        constituencyLine: '#9DB0BA',
        wardLine: '#4E6B7A',
        selected: '#F2C230',
        hover: '#E8EEF0',
        label: '#E8EEF0',
        labelHalo: '#0F2430',
        town: '#9DB0BA',
        noData: '#1C3A4A',
        faded: '#34566A',
    },
};

/** IEBC ballot-paper / box-lid colours per seat. */
export const SEAT_COLOURS = {
    president: '#FFFFFF',
    governor: '#3E8FD0',
    senator: '#F2C230',
    woman_rep: '#7A4FA0',
    mp: '#2E8B57',
    mca: '#C8A97E',
} as const;

/** Colour-blind-safe categorical palette (Okabe-Ito) used for parties without an admin colour. */
export const CATEGORICAL = [
    '#E69F00',
    '#56B4E9',
    '#009E73',
    '#F0E442',
    '#0072B2',
    '#D55E00',
    '#CC79A7',
    '#000000',
];
export const OTHER = '#9AA5A0';

/** Former provinces get muted tints so the "Former province" colouring stays calm. */
export const PROVINCE_TINTS = [
    '#C9D8C5',
    '#E4D3B4',
    '#C4D3E0',
    '#D9C6D6',
    '#D6DDB8',
    '#BFD9D6',
    '#E1C7BD',
    '#CFCFDF',
];

/** Shown in the About sheet and on every export (plan: Global Constraints). */
export const ATTRIBUTION =
    'Boundaries: IEBC 2012 delimitation (via mikelmaron/kenya-election-data) · 13 wards: American Red Cross (HDX), CC BY 4.0 · Codes: Kenya Gazette Notice 13771 (2026) · Towns: © OpenStreetMap contributors';
