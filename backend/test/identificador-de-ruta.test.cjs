const assert = require('node:assert/strict');
const { test } = require('node:test');

test('convierte identificadores de ruta válidos sin cambiar sus límites', async () => {
  const { leerIdentificadorDeRuta } = await import('../dist/comun/identificador-de-ruta.js');

  for (const [crudo, esperado] of [['1', 1], ['0002', 2], ['4294967295', 4294967295]]) {
    assert.equal(leerIdentificadorDeRuta(crudo), esperado);
  }
});

test('rechaza identificadores malformados o fuera de rango con el mismo error HTTP', async () => {
  const { leerIdentificadorDeRuta } = await import('../dist/comun/identificador-de-ruta.js');
  const invalidos = ['', '0', '-1', '+1', '1.5', '1e2', ' 1', '1 ', 'abc', '4294967296', '9007199254740992'];

  for (const crudo of invalidos) {
    assert.throws(() => leerIdentificadorDeRuta(crudo), (error) =>
      error.getStatus() === 400 && error.message === 'El identificador debe ser válido.',
    );
  }
});
