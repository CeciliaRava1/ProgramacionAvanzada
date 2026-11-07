import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretarRutaDelAlumno, hrefDelAlumno } from '../src/planes/navegacion-del-alumno.ts';

test('el recorrido del alumno conserva la rutina propia al volver o recargar', () => {
  for (const hash of ['#inicio', '#entrenadores', '#configuracion', '#mi-rutina/5', '#mi-rutina/4294967295']) assert.equal(hrefDelAlumno(interpretarRutaDelAlumno(hash)), hash);
});

test('las rutas ajenas al recorrido del alumno o con identificadores inválidos regresan a Inicio', () => {
  for (const hash of ['', '#desconocida', '#inicio/1', '#entrenadores/', '#configuracion/1', '#mi-rutina', '#mi-rutina/', '#mi-rutina/0', '#mi-rutina/-1', '#mi-rutina/01', '#mi-rutina/1.5', '#mi-rutina/NaN', '#mi-rutina/4294967296', '#mi-rutina/5/6', '#alumno/21', '#rutina/21/51', '#ejercicio/21/51/71', '#home', '#trainers']) assert.deepEqual(interpretarRutaDelAlumno(hash), { pantalla: 'inicio' }, hash);
});
