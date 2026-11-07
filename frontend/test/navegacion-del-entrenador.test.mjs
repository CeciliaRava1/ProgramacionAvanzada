import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretarRutaDelEntrenador, hrefDelEntrenador, esFormularioDelEntrenador } from '../src/entrenadores/navegacion-del-entrenador.ts';

test('las vistas del entrenador conservan sus identificadores al volver o recargar', () => {
  for (const hash of ['#inicio', '#configuracion', '#alumnos', '#solicitudes', '#alumno/21', '#formulario-de-plan/21', '#eliminar-plan/21', '#rutina/21/51', '#formulario-de-rutina/21', '#formulario-de-rutina/21/51', '#catalogo/21/51', '#ejercicio/21/51/71', '#ejercicio/21/51//61']) {
    assert.equal(hrefDelEntrenador(interpretarRutaDelEntrenador(hash)), hash);
  }
  assert.equal(esFormularioDelEntrenador(interpretarRutaDelEntrenador('#ejercicio/21/51/71')), false);
  assert.equal(esFormularioDelEntrenador(interpretarRutaDelEntrenador('#catalogo/21/51')), false);
  assert.equal(esFormularioDelEntrenador(interpretarRutaDelEntrenador('#formulario-de-rutina/21/51')), true);
  assert.equal(esFormularioDelEntrenador(interpretarRutaDelEntrenador('#formulario-de-plan/21')), true);
  assert.equal(esFormularioDelEntrenador(interpretarRutaDelEntrenador('#rutina/21/51')), false);
  assert.equal(esFormularioDelEntrenador(interpretarRutaDelEntrenador('#configuracion')), false);
});

test('rutas incompletas, identificadores inválidos y segmentos extra vuelven a alumnos', () => {
  for (const hash of ['', '#no-existe', '#configuracion/', '#configuracion/1', '#alumnos/1', '#students', '#home', '#settings', '#requests', '#alumno', '#alumno/0', '#alumno/-1', '#alumno/1.5', '#alumno/01', '#alumno/4294967296', '#alumno/1/2', '#rutina/1', '#rutina/1/NaN', '#formulario-de-rutina/1/no', '#catalogo/1/2/3', '#ejercicio/1/2', '#ejercicio/1/2/0', '#ejercicio/1/2/3/4', '#ejercicio/1/2///4', '#formulario-de-programa/21', '#program-form/21']) {
    assert.deepEqual(interpretarRutaDelEntrenador(hash), { pantalla: 'alumnos' }, hash);
  }
});
