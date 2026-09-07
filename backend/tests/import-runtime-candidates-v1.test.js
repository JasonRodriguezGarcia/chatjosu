import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanName,
  contentHash,
  mapCandidate,
  nifToRow,
  normalizeScope,
  planIds,
  validateCanonicalTags,
} from '../scripts/import-runtime-candidates-v1.js';

test('normalizeScope interpreta los valores de scope', () => {
  assert.equal(normalizeScope('L'), 'Local');
  assert.equal(normalizeScope('N'), 'Nacional');
  assert.equal(normalizeScope('Comarcal'), 'Desconocido');
  assert.equal(normalizeScope('C.A. Navarra'), 'Autonómico');
  assert.equal(normalizeScope('T.H. Navarra'), 'Provincial');
  assert.equal(normalizeScope(null), 'Desconocido');
});

test('cleanName y nifToRow normalizan identificadores', () => {
  assert.equal(cleanName('  " ASOCIACIÓN PRUEBA "  '), 'ASOCIACIÓN PRUEBA');

  assert.equal(nifToRow('12345A'), 12345);

  assert.equal(nifToRow(''), 0);
});

test('mapCandidate mapea candidato Euskadi a fila estable', () => {
  const candidate = {
    name: '  " ASOCIACIÓN PRUEBA "  ',
    scope: 'L',
    province_key: '  Bizkaia  ',
    address: 'calle A',
    postal_code: '48001',
    phone: '944 000 000',
    email: 'prueba@example.com',
    website: 'https://prueba.example',
    description: 'Asociación de prueba',
    latitude: '43.26',
    longitude: '-2.93',
    tax_id: '12345A',
    source: {
      record_id: 'E-1',
      coordinate_method: 'GPS',
      record_url: 'https://euskadi.example/1',
      detail_url: 'https://euskadi.example/1?detail=1',
    },
    relevance: {
      status: 'keep',
    },
    resource_role: 'ONG',
    tags: [
      {
        key: '  SOLEDAD_NO_DESEADA  ',
        category: 'SALUD_MENTAL',
      },
      {
        key: ' ',
        category: 'DESCARTADA',
      },
    ],
  };

  const first = mapCandidate(candidate, 'euskadi');
  const second = mapCandidate(candidate, 'euskadi');

  assert.equal(first.name, 'ASOCIACIÓN PRUEBA');

  assert.equal(first.scope, 'Local');

  assert.equal(first.province_key, 'Bizkaia');

  assert.equal(first.source_sheet, '12345A');

  assert.equal(first.source_row, 12345);

  assert.equal(first.source_id, '12345A');

  assert.equal(first.location_precision, 'GPS');

  assert.equal(first.record_url, 'https://euskadi.example/1');

  assert.equal(first.detail_url, 'https://euskadi.example/1?detail=1');

  assert.equal(first.relevance_status, 'keep');

  assert.deepEqual(first.tags, [
    {
      key: 'SOLEDAD_NO_DESEADA',
      category: 'SALUD_MENTAL',
    },
  ]);

  assert.equal(first.content_hash, second.content_hash);

  assert.equal(
    first.content_hash,
    contentHash({
      name: 'ASOCIACIÓN PRUEBA',
      provinceKey: 'Bizkaia',
      address: 'calle A',
      website: 'https://prueba.example',
    })
  );
});

test('mapCandidate usa num_registro de Navarra cuando no hay NIF', () => {
  const candidate = {
    name: 'ASOCIACIÓN NAVARRA',
    scope: 'T.H.',
    province_key: 'NAVARRA',
    tax_id: '',
    source: {
      num_registro: 'N-77',
    },
    tags: [],
  };

  const row = mapCandidate(candidate, 'navarra');

  assert.equal(row.source_sheet, 'N-77');

  assert.equal(row.source_row, 0);

  assert.equal(row.source_id, 'N-77');

  assert.equal(row.location_precision, null);

  assert.equal(row.record_url, null);

  assert.equal(row.detail_url, null);
});

test('validateCanonicalTags acepta tags conocidos', () => {
  const candidates = [
    {
      source_record_id: 'C-1',
      source_id: null,
      tags: [
        { key: 'ONG', category: 'TIPO' },
        { key: 'SANIDAD', category: 'SERVICIO' },
      ],
    },
  ];
  const tagMap = new Map([['ONG', '1'], ['SANIDAD', '2']]);

  assert.doesNotThrow(() => validateCanonicalTags(candidates, tagMap));
});

test('validateCanonicalTags rechaza tags desconocidos', () => {
  const candidates = [
    {
      source_record_id: 'C-1',
      source_id: null,
      tags: [
        { key: 'ONG_INCONOCIDO', category: 'TIPO' },
      ],
    },
  ];
  const tagMap = new Map([['ONG', '1'], ['SANIDAD', '2']]);

  let threw = false;
  let error;
  try {
    validateCanonicalTags(candidates, tagMap);
  } catch (e) {
    threw = true;
    error = e;
  }

  assert.ok(threw, 'debe lanzar error para tag desconocido');
  assert.ok(
    error.message.includes('ONG_INCONOCIDO'),
    'el mensaje debe incluir el tag desconocido'
  );
  assert.ok(
    error.message.includes('C-1'),
    'el mensaje debe incluir la identidad del candidato'
  );
});

test('validateCanonicalTags maneja multiple tags desconocidos', () => {
  const candidates = [
    {
      source_record_id: 'C-1',
      source_id: null,
      tags: [
        { key: 'TAG_A_INCONOCIDO', category: 'A' },
        { key: 'TAG_B_INCONOCIDO', category: 'B' },
      ],
    },
    {
      source_record_id: 'C-2',
      source_id: null,
      tags: [
        { key: 'TAG_C_INCONOCIDO', category: 'C' },
      ],
    },
  ];
  const tagMap = new Map([]);

  let threw = false;
  let error;
  try {
    validateCanonicalTags(candidates, tagMap);
  } catch (e) {
    threw = true;
    error = e;
  }

  assert.ok(threw, 'debe lanzar error');
  // Verificar ordenamiento determinista
  assert.ok(
    error.message.includes('TAG_A_INCONOCIDO'),
    'debe incluir TAG_A_INCONOCIDO'
  );
  assert.ok(
    error.message.includes('TAG_B_INCONOCIDO'),
    'debe incluir TAG_B_INCONOCIDO'
  );
  assert.ok(
    error.message.includes('TAG_C_INCONOCIDO'),
    'debe incluir TAG_C_INCONOCIDO'
  );

  const a =
    error.message.indexOf('TAG_A_INCONOCIDO');
  const b =
    error.message.indexOf('TAG_B_INCONOCIDO');
  const c =
    error.message.indexOf('TAG_C_INCONOCIDO');

  assert.ok(
    a < b && b < c,
    'los tags desconocidos deben reportarse en orden determinista'
  );
});

test('validateCanonicalTags usa source_id cuando source_record_id no existe', () => {
  const candidates = [
    {
      source_record_id: null,
      source_id: 'S-1',
      tags: [
        { key: 'TAG_DESCONOCIDO', category: 'X' },
      ],
    },
  ];
  const tagMap = new Map([]);

  let threw = false;
  let error;
  try {
    validateCanonicalTags(candidates, tagMap);
  } catch (e) {
    threw = true;
    error = e;
  }

  assert.ok(threw, 'debe lanzar error');
  assert.ok(
    error.message.includes('S-1'),
    'el mensaje debe incluir la source_id'
  );
});

test('validateCanonicalTags rechaza candidatos con tags conocidos y desconocidos', () => {
  const candidates = [
    {
      source_record_id: 'C-1',
      source_id: null,
      tags: [
        { key: 'ONG', category: 'TIPO' },
        { key: 'TAG_INCONOCIDO', category: 'X' },
        { key: 'SANIDAD', category: 'SERVICIO' },
      ],
    },
  ];
  const tagMap = new Map([['ONG', '1'], ['SANIDAD', '2']]);

  let threw = false;
  let error;

  try {
    validateCanonicalTags(candidates, tagMap);
  } catch (e) {
    threw = true;
    error = e;
  }

  assert.ok(threw, 'debe lanzar error por tag desconocido');
  assert.ok(
    error.message.includes('TAG_INCONOCIDO'),
    'el mensaje debe incluir el tag desconocido'
  );
});

test('planIds(10, 5) -> [11,12,13,14,15]', () => {
  const ids = planIds(10, 5);
  assert.deepEqual(ids, [11, 12, 13, 14, 15]);
});

test('planIds(0, 3) -> [1,2,3]', () => {
  const ids = planIds(0, 3);
  assert.deepEqual(ids, [1, 2, 3]);
});

test('planIds(1427, 0) -> []', () => {
  const ids = planIds(1427, 0);
  assert.deepEqual(ids, []);
});
