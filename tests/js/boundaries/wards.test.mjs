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

const patches = [{ iebcCode: 3, arcUid: 'X3', mode: 'fill', reason: 'missing' }];
const replace = { iebcCode: 1, arcUid: 'R1', mode: 'replace', reason: 'misfiled' };
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
        expect(steps('replaced')).toEqual([]);
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
        await expect(assemble({ patches: [{ iebcCode: 3, arcUid: 'X9', mode: 'fill' }] })).rejects.toThrow(/arc uid X9 not found/);
    });

    it('throws when a fill patch targets a code already in the IEBC data', async () => {
        await expect(assemble({ patches: [{ iebcCode: 2, arcUid: 'X3', mode: 'fill' }] })).rejects.toThrow(/already present/);
    });

    it('throws when a replace patch targets a code the IEBC data does not have', async () => {
        await expect(
            assemble({ patches: [{ iebcCode: 3, arcUid: 'R1', mode: 'replace', reason: 'x' }], expected: 2 }),
        ).rejects.toThrow(/not in the IEBC data/);
    });

    it('throws with the validation result when codes are incomplete', async () => {
        await expect(assemble({ patches: [] })).rejects.toThrow(/missing/);
    });
});

describe('assembleWards with mode=replace', () => {
    const run = () => assemble({ patches: [...patches, replace] });

    it('swaps the IEBC polygon for the Red Cross one', async () => {
        const result = await run();
        expect(result.wards.features.map((f) => f.properties.code)).toEqual([1, 2, 3]);
        const r1 = arc.features.find((f) => f.properties.uid === 'R1');
        expect(turf.area(byCode(result, 1))).toBeCloseTo(turf.area(r1), 0);
        // The old IEBC polygon's west part (x < 8) is gone from code 1.
        expect(turf.booleanPointInPolygon(turf.point([4, 5]), byCode(result, 1))).toBe(false);
        expect(turf.booleanPointInPolygon(turf.point([15, 5]), byCode(result, 1))).toBe(true);
    });

    it('erases the new polygon from its neighbours and leaves no overlap', async () => {
        const result = await run();
        const before = await assemble();
        expect(turf.area(byCode(result, 2))).toBeLessThan(turf.area(byCode(before, 2)));
        expect(turf.booleanPointInPolygon(turf.point([21, 5]), byCode(result, 2))).toBe(false);
        const { features } = result.wards;
        for (let i = 0; i < features.length; i++) {
            for (let j = i + 1; j < features.length; j++) {
                const shared = turf.intersect(turf.featureCollection([features[i], features[j]]));
                expect(shared ? turf.area(shared) : 0, `${features[i].properties.code}/${features[j].properties.code}`).toBeLessThan(1e-9);
            }
        }
    });

    it('logs the replacement with the source name of the polygon it removed, not as a name correction', async () => {
        const { log } = await run();
        expect(log.filter((e) => e.step === 'replaced').map((e) => e.detail)).toEqual([
            { code: 1, arcUid: 'R1', reason: 'misfiled', sourceName: 'WARD ONE', pieces: 2 },
        ]);
        expect(log.filter((e) => e.step === 'merged')).toEqual([]);
        expect(log.filter((e) => e.step === 'attribute-corrected').map((e) => e.detail.code)).toEqual([2]);
    });
});

describe('parsePatches', () => {
    const csv = readFileSync(resolve(import.meta.dirname, '../../../boundaries/overrides/ward_patches.csv'), 'utf8');

    it('reads the 13 reviewed fill rows first, each with a reason', () => {
        const rows = parsePatches(csv);
        const fills = rows.filter((r) => r.mode === 'fill');
        expect(fills).toHaveLength(13);
        expect(rows[11]).toMatchObject({ iebcCode: 735, arcUid: 'qsljIZxApCc', mode: 'fill' });
        for (const row of rows) expect(row.reason, `row ${row.iebcCode}`).toMatch(/\S/);
    });

    it('reads replace rows, including Mandera Township', () => {
        const rows = parsePatches(csv);
        expect(rows.find((r) => r.iebcCode === 212)).toMatchObject({ mode: 'replace' });
        expect(rows.find((r) => r.iebcCode === 922)).toMatchObject({ mode: 'replace' });
    });

    it('defaults to fill when there is no mode column, and rejects an unknown mode or a missing reason', () => {
        expect(parsePatches('iebc_code,arc_uid\n5,A\n')).toEqual([{ iebcCode: 5, arcUid: 'A', mode: 'fill', reason: '' }]);
        expect(() => parsePatches('iebc_code,arc_uid,mode,reason\n5,A,swap,x\n')).toThrow(/mode/);
        expect(() => parsePatches('iebc_code,arc_uid,mode,reason\n5,A,replace,\n')).toThrow(/reason/);
    });

    it('rejects a duplicate iebc_code or a duplicate arc_uid', () => {
        expect(() => parsePatches('iebc_code,arc_uid\n5,A\n5,B\n')).toThrow(/duplicate.*iebc_code 5/i);
        expect(() => parsePatches('iebc_code,arc_uid\n5,A\n6,A\n')).toThrow(/duplicate.*arc_uid A/i);
    });
});
