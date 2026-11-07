const assert = require('node:assert/strict');
const { test } = require('node:test');

function usuariosEnMemoria(iniciales = []) {
  const filas = iniciales.map(fila => ({ ...fila }));

  return {
    filas,
    repositorio: {
      async findOneBy(criterios) {
        return filas.find(fila => Object.entries(criterios).every(([clave, valor]) => fila[clave] === valor)) ?? null;
      },
      async save(usuario) {
        const guardado = { ...usuario, id: filas.length + 1 };
        filas.push(guardado);
        return guardado;
      },
    },
  };
}

test('crea el administrador con correo normalizado y el hash habitual de la aplicación', async () => {
  const { sembrarAdministradorInicial } = await import('../dist/infraestructura/base-de-datos/semilla.js');
  const { verificarContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const usuarios = usuariosEnMemoria();
  const contrasena = 'Clave123';

  assert.equal(await sembrarAdministradorInicial(usuarios.repositorio, {
    correo: ' ADMIN@example.test ',
    contrasena,
  }), true);

  assert.equal(usuarios.filas.length, 1);
  const cuenta = usuarios.filas[0];
  assert.equal(cuenta.correo, 'admin@example.test');
  assert.equal(cuenta.rol, 'administrador');
  assert.equal(cuenta.nombre, 'Administrador');
  assert.equal(cuenta.apellido, 'Local');
  assert.equal(cuenta.horario, null);
  assert.equal('contrasena' in cuenta, false);
  assert.match(cuenta.hashDeContrasena, /^scrypt\$/);
  assert.notEqual(cuenta.hashDeContrasena, contrasena);
  assert.equal(await verificarContrasena(contrasena, cuenta.hashDeContrasena), true);
});

test('repetir la semilla no duplica cuentas ni modifica el correo o la contraseña existentes', async () => {
  const { sembrarAdministradorInicial } = await import('../dist/infraestructura/base-de-datos/semilla.js');
  const usuarios = usuariosEnMemoria();

  assert.equal(await sembrarAdministradorInicial(usuarios.repositorio, {
    correo: 'admin@example.test',
    contrasena: 'Clave123',
  }), true);

  const antes = structuredClone(usuarios.filas);
  assert.equal(await sembrarAdministradorInicial(usuarios.repositorio, {
    correo: 'otro-admin@example.test',
    contrasena: 'OtraClave123',
  }), false);
  assert.equal(await sembrarAdministradorInicial(usuarios.repositorio, {}), false);
  assert.deepEqual(usuarios.filas, antes);
});

test('conserva un administrador previo aunque no estén configuradas las credenciales iniciales', async () => {
  const { sembrarAdministradorInicial } = await import('../dist/infraestructura/base-de-datos/semilla.js');
  const cuenta = {
    id: 7,
    nombre: 'Cuenta',
    apellido: 'Existente',
    correo: 'existente@example.test',
    rol: 'administrador',
    hashDeContrasena: 'hash-existente',
  };
  const usuarios = usuariosEnMemoria([cuenta]);

  assert.equal(await sembrarAdministradorInicial(usuarios.repositorio, {}), false);
  assert.deepEqual(usuarios.filas, [cuenta]);
});

test('un correo ocupado por un alumno o entrenador no cambia su rol ni sus credenciales', async () => {
  const { sembrarAdministradorInicial } = await import('../dist/infraestructura/base-de-datos/semilla.js');

  for (const rol of ['alumno', 'entrenador']) {
    const cuenta = {
      id: 1,
      nombre: 'Cuenta',
      apellido: 'Existente',
      correo: 'ocupado@example.test',
      rol,
      hashDeContrasena: 'hash-existente',
    };
    const usuarios = usuariosEnMemoria([cuenta]);

    await assert.rejects(sembrarAdministradorInicial(usuarios.repositorio, {
      correo: ' OCUPADO@example.test ',
      contrasena: 'Clave123',
    }), /ya pertenece a otra cuenta/);
    assert.deepEqual(usuarios.filas, [cuenta]);
  }
});

test('rechaza credenciales incompletas o inválidas sin guardar cuentas', async () => {
  const { sembrarAdministradorInicial } = await import('../dist/infraestructura/base-de-datos/semilla.js');
  const invalidas = [
    {},
    { correo: '', contrasena: 'Clave123' },
    { correo: 42, contrasena: 'Clave123' },
    { correo: 'incorrecto', contrasena: 'Clave123' },
    { correo: 'a\u0000@example.test', contrasena: 'Clave123' },
    { correo: 'a'.repeat(255) + '@example.test', contrasena: 'Clave123' },
    ...[undefined, '', 42, 'a'.repeat(7), 'a'.repeat(129), ' Clave123', 'Clave123 ',
      'Clave 123', 'Clave\t123', 'Clave\n123', 'Clave 123']
      .map(contrasena => ({ correo: 'admin@example.test', contrasena })),
  ];

  for (const credenciales of invalidas) {
    const usuarios = usuariosEnMemoria();
    await assert.rejects(sembrarAdministradorInicial(usuarios.repositorio, credenciales));
    assert.deepEqual(usuarios.filas, []);
  }
});
