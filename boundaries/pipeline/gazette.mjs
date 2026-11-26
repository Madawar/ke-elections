// Loads the IEBC gazette CSV (wards -> constituencies -> counties) and the
// county -> province override map. Pure functions over CSV text.

/** Parse CSV text (RFC 4180 quoting, LF or CRLF) into an array of objects keyed by header. */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    const endField = () => {
        row.push(field);
        field = '';
    };
    const endRow = () => {
        endField();
        if (row.some((f) => f !== '')) rows.push(row);
        row = [];
    };

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (c === '"') {
                quoted = false;
            } else {
                field += c;
            }
        } else if (c === '"') {
            quoted = true;
        } else if (c === ',') {
            endField();
        } else if (c === '\n') {
            endRow();
        } else if (c !== '\r') {
            field += c;
        }
    }
    endRow();

    const [header, ...body] = rows;
    if (!header) return [];
    return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

function toCode(value, column, line) {
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) {
        throw new Error(`Invalid ${column} "${value}" on data row ${line}: expected an integer`);
    }
    return Number(text);
}

/** Add an entity to a map, rejecting a second entry that disagrees with the first. */
function register(map, entity, label) {
    const existing = map.get(entity.code);
    if (existing && JSON.stringify(existing) !== JSON.stringify(entity)) {
        throw new Error(`Conflicting ${label} ${entity.code}: ${JSON.stringify(existing)} vs ${JSON.stringify(entity)}`);
    }
    map.set(entity.code, entity);
}

export function loadGazette(csvText) {
    const wards = new Map();
    const constituencies = new Map();
    const counties = new Map();

    parseCsv(csvText).forEach((r, i) => {
        const line = i + 1;
        const countyCode = toCode(r.county_code, 'county_code', line);
        const constituencyCode = toCode(r.const_code, 'const_code', line);
        const wardCode = toCode(r.caw_code, 'caw_code', line);

        register(counties, { code: countyCode, name: r.county_name.trim() }, 'county');
        register(constituencies, { code: constituencyCode, name: r.const_name.trim(), countyCode }, 'constituency');
        register(wards, { code: wardCode, name: r.caw_name.trim(), constituencyCode, countyCode }, 'ward');
    });

    return { wards, constituencies, counties };
}

export function loadProvinces(csvText) {
    const provinces = new Map();

    parseCsv(csvText).forEach((r, i) => {
        const line = i + 1;
        const countyCode = toCode(r.county_code, 'county_code', line);
        if (provinces.has(countyCode)) throw new Error(`Duplicate county ${countyCode} in provinces CSV`);
        provinces.set(countyCode, {
            code: toCode(r.province_code, 'province_code', line),
            name: r.province_name.trim(),
        });
    });

    const complete = provinces.size === 47 && Array.from({ length: 47 }, (_, i) => i + 1).every((c) => provinces.has(c));
    if (!complete) throw new Error('Provinces CSV must cover exactly county codes 1-47');

    return provinces;
}
