const assert = require('node:assert/strict');
const { test } = require('node:test');

test('convierte identificadores de ruta válidos sin cambiar sus límites', async () => {
  const { parseRouteId } = await import('../dist/plans/presentation/parse-route-id.js');

  for (const [raw, expected] of [['1', 1], ['0002', 2], ['4294967295', 4294967295]]) {
    assert.equal(parseRouteId(raw), expected);
  }
});

test('rechaza identificadores malformados o fuera de rango con el mismo error HTTP', async () => {
  const { parseRouteId } = await import('../dist/plans/presentation/parse-route-id.js');
  const invalidIds = ['', '0', '-1', '+1', '1.5', '1e2', ' 1', '1 ', 'abc', '4294967296', '9007199254740992'];

  for (const raw of invalidIds) {
    assert.throws(() => parseRouteId(raw), error =>
      error.getStatus() === 400 && error.message === 'El identificador debe ser válido.',
    );
  }
});
