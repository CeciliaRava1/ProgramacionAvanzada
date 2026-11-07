import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ETIQUETAS_DE_TURNO, TURNOS, esListaDeTurnosValida, formatearTurnos, ordenarTurnos } from '../src/entrenadores/turnos.ts';

test('los turnos son mañana, tarde y noche en ese orden', () => {
  assert.deepEqual([...TURNOS], ['manana', 'tarde', 'noche']);
  assert.deepEqual(ETIQUETAS_DE_TURNO, { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' });
});

test('acepta listas de turnos conocidos sin repetir y rechaza el resto', () => {
  for (const valor of [[], ['manana'], ['noche', 'manana'], ['manana', 'tarde', 'noche']]) {
    assert.equal(esListaDeTurnosValida(valor), true);
  }
  for (const valor of [null, undefined, 'manana', {}, ['madrugada'], [1], ['manana', 'manana'], [null]]) {
    assert.equal(esListaDeTurnosValida(valor), false);
  }
});

test('ordena y muestra el horario con las etiquetas en español', () => {
  assert.deepEqual(ordenarTurnos(['noche', 'manana']), ['manana', 'noche']);
  assert.equal(formatearTurnos(['noche', 'tarde']), 'Tarde, Noche');
  assert.equal(formatearTurnos(['manana', 'tarde', 'noche']), 'Mañana, Tarde, Noche');
  assert.equal(formatearTurnos([]), '');
});
