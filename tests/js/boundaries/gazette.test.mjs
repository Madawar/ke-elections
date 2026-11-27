import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadGazette, loadProvinces } from '../../../boundaries/pipeline/gazette.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const gazetteCsv = read('../../../data/reference/iebc_wards_2027_gn13771.csv');
const provincesCsv = read('../../../boundaries/overrides/provinces.csv');
const header = 'county_code,county_name,const_code,const_name,caw_code,caw_name,source';

describe('loadGazette', () => {
    const { wards, constituencies, counties } = loadGazette(gazetteCsv);

    it('holds 1450 wards, 290 constituencies and 47 counties', () => {
        expect(wards.size).toBe(1450);
        expect(constituencies.size).toBe(290);
        expect(counties.size).toBe(47);
    });

    it('maps a ward to its parents', () => {
        expect(wards.get(735)).toEqual({ code: 735, name: 'Lelan', constituencyCode: 148, countyCode: 28 });
        expect(wards.get(1448).name).toBe('Ngei');
        expect(constituencies.get(148).countyCode).toBe(28);
    });

    it('throws on a non-integer code', () => {
        expect(() => loadGazette(`${header}\nx,A,1,B,1,C,s`)).toThrow();
    });

    it('throws when a constituency is listed under two counties', () => {
        const bad = [header, '1,A,1,B,1,C,s', '2,D,1,B,2,E,s'].join('\r\n');
        expect(() => loadGazette(bad)).toThrow(/conflict/i);
    });

    it('reads quoted fields', () => {
        const csv = `${header}\r\n1,"A, B",1,C,1,"D ""E""",s\r\n`;
        const g = loadGazette(csv);
        expect(g.counties.get(1).name).toBe('A, B');
        expect(g.wards.get(1).name).toBe('D "E"');
    });
});

describe('loadProvinces', () => {
    const provinces = loadProvinces(provincesCsv);

    it('covers 47 counties and 8 provinces', () => {
        expect(provinces.size).toBe(47);
        expect(new Set([...provinces.values()].map((p) => p.code)).size).toBe(8);
    });

    it('maps counties to provinces', () => {
        expect(provinces.get(47)).toEqual({ code: 8, name: 'Nairobi' });
        expect(provinces.get(7)).toEqual({ code: 2, name: 'North Eastern' });
        expect(provinces.get(1)).toEqual({ code: 1, name: 'Coast' });
    });

    it('throws unless exactly counties 1-47 are covered', () => {
        expect(() => loadProvinces('county_code,province_code,province_name\n1,1,Coast')).toThrow();
    });
});
