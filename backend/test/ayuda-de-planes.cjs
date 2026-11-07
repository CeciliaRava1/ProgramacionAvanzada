// Ayuda compartida por las pruebas de integración del módulo de planes (no es una prueba: no termina en .test.cjs).
const { randomUUID } = require('node:crypto');

const CLAVE = 'Clave123';

/** Levanta la aplicación, crea cuentas de cada rol, inicia sesión con ellas y limpia todo al terminar la prueba. */
async function prepararEntorno(t) {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { EsquemaDeVinculacion } = await import('../dist/usuarios/infraestructura/repositorio-de-solicitudes-typeorm.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const iniciar = async () => {
    const instancia = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await instancia.listen(0, '127.0.0.1');
    return instancia;
  };
  const entorno = { app: await iniciar(), cuentas: [], limpiezas: [], iniciar };
  entorno.db = entorno.app.get(DataSource);
  entorno.usuarios = entorno.db.getRepository(EsquemaDeUsuario);
  entorno.vinculaciones = entorno.db.getRepository(EsquemaDeVinculacion);
  const hash = await hashearContrasena(CLAVE);

  t.after(async () => {
    try {
      for (const limpiar of entorno.limpiezas) await limpiar();
      const ids = entorno.cuentas.map((cuenta) => cuenta.id);
      if (ids.length) {
        const marcas = ids.map(() => '?').join(',');
        await entorno.db.query(`DELETE e FROM ejercicios_de_rutina e JOIN rutinas r ON r.id = e.rutina_id JOIN planes_de_entrenamiento p ON p.id = r.plan_id WHERE p.alumno_id IN (${marcas})`, ids);
        await entorno.db.query(`DELETE r FROM rutinas r JOIN planes_de_entrenamiento p ON p.id = r.plan_id WHERE p.alumno_id IN (${marcas})`, ids);
        await entorno.db.query(`DELETE FROM planes_de_entrenamiento WHERE alumno_id IN (${marcas})`, ids);
        await entorno.db.query(`DELETE FROM vinculaciones WHERE alumno_id IN (${marcas})`, ids);
      }
      for (const cuenta of entorno.cuentas) {
        await entorno.db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(cuenta.id)]);
        await entorno.usuarios.delete({ id: cuenta.id });
      }
    } finally { await entorno.app.close(); }
  });

  entorno.crearCuenta = async (rol) => {
    const cuenta = await entorno.usuarios.save({ nombre: 'Prueba', apellido: 'Planes', correo: `planes-${randomUUID()}@example.test`, rol, hashDeContrasena: hash });
    entorno.cuentas.push(cuenta);
    return cuenta;
  };
  entorno.llamar = (ruta, metodo = 'GET', cookie, cuerpo, origen = 'http://127.0.0.1:5173') =>
    fetch(`http://127.0.0.1:${entorno.app.getHttpServer().address().port}/usuarios/${ruta}`, {
      method: metodo,
      headers: { Origin: origen, ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
  entorno.iniciarSesion = async (cuenta) => {
    const respuesta = await entorno.llamar('sesion', 'POST', null, { correo: cuenta.correo, contrasena: CLAVE });
    if (respuesta.status !== 200) throw new Error(`No se pudo iniciar sesión (${respuesta.status}).`);
    await respuesta.arrayBuffer();
    return respuesta.headers.getSetCookie().find((cabecera) => /Path=\/;/i.test(cabecera)).split(';')[0];
  };
  return entorno;
}

/** Crea un ejercicio de catálogo propio de la prueba y lo elimina al terminar. */
async function crearEjercicioDePrueba(entorno, datos = {}) {
  const { EsquemaDeEjercicio } = await import('../dist/planes/infraestructura/repositorio-de-ejercicios-typeorm.js');
  const repositorio = entorno.db.getRepository(EsquemaDeEjercicio);
  const ejercicio = await repositorio.save({
    identificador: `prueba-${randomUUID()}`, nombre: 'Sentadilla de prueba', parteDelCuerpo: 'Piernas', equipamiento: 'Barra',
    musculoObjetivo: 'Cuádriceps', instrucciones: 'Instrucciones de prueba.', ...datos,
  });
  entorno.limpiezas.push(async () => { await entorno.db.query('DELETE FROM ejercicios_de_rutina WHERE ejercicio_id = ?', [ejercicio.id]); await repositorio.delete({ id: ejercicio.id }); });
  return ejercicio;
}

module.exports = { CLAVE, prepararEntorno, crearEjercicioDePrueba };
