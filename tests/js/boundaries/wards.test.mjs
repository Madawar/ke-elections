import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';
import { assembleWards, parsePatches } from '../../../boundaries/pipeline/wards.mjs';

const fixture = (name) => JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures', `${name}.geojson`), 'utf8'));
const iebc = fixture('iebc');
const arc = fixture('arc');

const gazette = {
    wards: new Map([
        [1, { code: 1, name: 'Ward One', constituencyCode: 1, countyCode: 1 }],
        [2, { code: 2, name: 'Ward Two', constituencyCode: 1, countyCode: 1 }],
        [3, { code: 3, name: 'Ward Three', constituencyCode: 1, countyCode: 1 }],
    ]),
    constituencies: new Map([[1, { code: 1, name: 'Constituency One', countyCode: 1 }]]),
    counties: new Map([[1, { code: 1, name: 'County One' }]]),
};

const patches = [{ iebcCode: 3, arcUid: 'X3' }];
const assemble = (overrides = {}) => assembleWards({ iebc, arc, patches, gazette, expected: 3, ...overrides });
const byCode = (result, code) => result.wards.features.find((f) => f.properties.code === code);

describe('assembleWards', () => {
    it('returns exactly the expected codes with gazette properties only', async () => {
        const { wards } = await assemble();
        expect(wards.type).toBe('FeatureCollection');
        expect(wards.features.map((f) => f.properties.code)).toEqual([1, 2, 3]);
        expect(wards.features[2].properties).toEqual({
            code: 3,
            name: 'Ward Three',
            constituency_code: 1,
            county_code: 1,
        });
    });

    it('erases the patch area from the overlapping IEBC ward', async () => {
        const result = await assemble();
        const inputArea = turf.area(iebc.features[2]);
        expect(turf.area(byCode(result, 2))).toBeLessThan(inputArea);
        expect(turf.area(byCode(result, 3))).toBeCloseTo(turf.area(arc.features[0]), 0);
    });

    it('leaves no overlap between any two output wards', async () => {
        const { wards } = await assemble();
        for (let i = 0; i < wards.features.length; i++) {
            for (let j = i + 1; j < wards.features.length; j++) {
                const shared = turf.intersect(turf.featureCollection([wards.features[i], wards.features[j]]));
                expect(shared ? turf.area(shared) : 0).toBeLessThan(1e-9);
            }
        }
    });

    it('merges pieces that share a code into one feature', async () => {
        const result = await assemble();
        expect(result.wards.features.filter((f) => f.properties.code === 1)).toHaveLength(1);
        expect(turf.area(byCode(result, 1))).toBeCloseTo(turf.area(iebc.features[0]) + turf.area(iebc.features[1]), 0);
    });

    it('logs dropped, merged, patched, cleaned and attribute-corrected steps', async () => {
        const { log } = await assemble();
        const steps = (name) => log.filter((entry) => entry.step === name);

        expect(steps('dropped').map((e) => e.detail.code)).toEqual([0]);
        expect(steps('merged').map((e) => e.detail)).toEqual([{ code: 1, pieces: 2 }]);
        expect(steps('patched').map((e) => e.detail)).toEqual([{ code: 3, arcUid: 'X3' }]);
        expect(steps('cleaned')).toHaveLength(1);
        expect(Array.isArray(steps('cleaned')[0].detail.messages)).toBe(true);

        const corrected = steps('attribute-corrected');
        expect(corrected).toHaveLength(1);
        expect(corrected[0].detail).toEqual({
            code: 2,
            changes: [{ field: 'name', source: 'WARD TWO OLD', gazette: 'Ward Two' }],
        });
    });

    it('drops features with empty geometry even when the code is valid', async () => {
        const withEmpty = {
            ...iebc,
            features: [...iebc.features, { type: 'Feature', properties: { COUNTY_ASS: 9 }, geometry: null }],
        };
        const { log } = await assemble({ iebc: withEmpty });
        expect(log.filter((e) => e.step === 'dropped').map((e) => e.detail.code)).toEqual([0, 9]);
    });

    it('throws when a patch uid is not in the Red Cross data', async () => {
        await expect(assemble({ patches: [{ iebcCode: 3, arcUid: 'X9' }] })).rejects.toThrow(/arc uid X9 not found/);
    });

    it('throws when a patch targets a code already in the IEBC data', async () => {
        await expect(assemble({ patches: [{ iebcCode: 2, arcUid: 'X3' }] })).rejects.toThrow(/already present/);
    });

    it('throws with the validation result when codes are incomplete', async () => {
        await expect(assemble({ patches: [] })).rejects.toThrow(/missing/);
    });
});

describe('parsePatches', () => {
    const csv = readFileSync(resolve(import.meta.dirname, '../../../boundaries/overrides/ward_patches.csv'), 'utf8');

    it('reads the 13 reviewed patch rows', () => {
        const rows = parsePatches(csv);
        expect(rows).toHaveLength(13);
        expect(rows[11]).toEqual({ iebcCode: 735, arcUid: 'qsljIZxApCc' });
    });
});
