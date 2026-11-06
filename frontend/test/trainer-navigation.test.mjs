import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTrainerRoute, trainerHref, isTrainerForm } from '../src/trainers/trainer-navigation.ts';

test('las vistas del entrenador conservan sus identificadores al volver o recargar', () => {
  for (const hash of ['#home', '#settings', '#students', '#requests', '#student/21', '#plan-form/21', '#delete-plan/21', '#program-form/21', '#routine/21/51', '#routine-form/21', '#routine-form/21/51', '#catalog/21/51', '#exercise/21/51/71', '#exercise/21/51//61']) {
    assert.equal(trainerHref(parseTrainerRoute(hash)), hash);
  }
  assert.equal(isTrainerForm(parseTrainerRoute('#exercise/21/51/71')), false);
  assert.equal(isTrainerForm(parseTrainerRoute('#catalog/21/51')), false);
  assert.equal(isTrainerForm(parseTrainerRoute('#routine-form/21/51')), true);
  assert.equal(isTrainerForm(parseTrainerRoute('#routine/21/51')), false);
  assert.equal(isTrainerForm(parseTrainerRoute('#settings')), false);
});

test('rutas incompletas, identificadores inválidos y segmentos extra vuelven a alumnos', () => {
  for (const hash of ['', '#no-existe', '#settings/', '#settings/1', '#students/1', '#student', '#student/0', '#student/-1', '#student/1.5', '#student/01', '#student/4294967296', '#student/1/2', '#routine/1', '#routine/1/NaN', '#routine-form/1/no', '#catalog/1/2/3', '#exercise/1/2', '#exercise/1/2/0', '#exercise/1/2/3/4', '#exercise/1/2///4']) {
    assert.deepEqual(parseTrainerRoute(hash), { screen: 'students' }, hash);
  }
});
