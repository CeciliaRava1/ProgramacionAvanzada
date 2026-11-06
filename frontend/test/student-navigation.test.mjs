import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStudentRoute, studentHref } from '../src/plans/student-navigation.ts';

test('el recorrido del alumno conserva la rutina propia al volver o recargar', () => {
  for (const hash of ['#home', '#trainers', '#settings', '#my-routine/5', '#my-routine/4294967295']) assert.equal(studentHref(parseStudentRoute(hash)), hash);
});

test('las rutas ajenas al recorrido del alumno o con identificadores inválidos regresan a Inicio', () => {
  for (const hash of ['', '#unknown', '#home/1', '#trainers/', '#settings/1', '#my-routine', '#my-routine/', '#my-routine/0', '#my-routine/-1', '#my-routine/01', '#my-routine/1.5', '#my-routine/NaN', '#my-routine/4294967296', '#my-routine/5/6', '#student/21', '#routine/21/51', '#exercise/21/51/71']) assert.deepEqual(parseStudentRoute(hash), { screen: 'home' }, hash);
});
