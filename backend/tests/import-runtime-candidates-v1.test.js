import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanName,
  contentHash,
  mapCandidate,
  nifToRow,
  normalizeScope,
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
