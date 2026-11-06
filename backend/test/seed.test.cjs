const assert = require('node:assert/strict');
const { test } = require('node:test');

function memoryUsers(initial = []) {
  const rows = initial.map(row => ({ ...row }));

  return {
    rows,
    repository: {
      async findOneBy(criteria) {
        return rows.find(row => Object.entries(criteria).every(([key, value]) => row[key] === value)) ?? null;
      },
      async save(user) {
        const saved = { ...user, id: rows.length + 1 };
        rows.push(saved);
        return saved;
      },
    },
  };
}

test('crea el administrador con correo normalizado y el hash habitual de la aplicación', async () => {
  const { seedInitialAdmin } = await import('../dist/infrastructure/database/seed.js');
  const { verifyPassword } = await import('../dist/users/infrastructure/hash-password.js');
  const users = memoryUsers();
  const password = 'Clave123';

  assert.equal(await seedInitialAdmin(users.repository, {
    email: ' ADMIN@example.test ',
    password,
  }), true);

  assert.equal(users.rows.length, 1);
  const account = users.rows[0];
  assert.equal(account.email, 'admin@example.test');
  assert.equal(account.role, 'admin');
  assert.equal(account.firstName, 'Administrador');
  assert.equal(account.lastName, 'Local');
  assert.equal(account.availability, null);
  assert.equal('password' in account, false);
  assert.match(account.passwordHash, /^scrypt\$/);
  assert.notEqual(account.passwordHash, password);
  assert.equal(await verifyPassword(password, account.passwordHash), true);
});

test('repetir el seed no duplica cuentas ni modifica el correo o la contraseña existentes', async () => {
  const { seedInitialAdmin } = await import('../dist/infrastructure/database/seed.js');
  const users = memoryUsers();

  assert.equal(await seedInitialAdmin(users.repository, {
    email: 'admin@example.test',
    password: 'Clave123',
  }), true);

  const before = structuredClone(users.rows);
  assert.equal(await seedInitialAdmin(users.repository, {
    email: 'otro-admin@example.test',
    password: 'OtraClave123',
  }), false);
  assert.equal(await seedInitialAdmin(users.repository, {}), false);
  assert.deepEqual(users.rows, before);
});

test('conserva un administrador previo aunque no estén configuradas las credenciales iniciales', async () => {
  const { seedInitialAdmin } = await import('../dist/infrastructure/database/seed.js');
  const account = {
    id: 7,
    firstName: 'Cuenta',
    lastName: 'Existente',
    email: 'existente@example.test',
    role: 'admin',
    passwordHash: 'hash-existente',
  };
  const users = memoryUsers([account]);

  assert.equal(await seedInitialAdmin(users.repository, {}), false);
  assert.deepEqual(users.rows, [account]);
});

test('un correo ocupado por un alumno o entrenador no cambia su rol ni sus credenciales', async () => {
  const { seedInitialAdmin } = await import('../dist/infrastructure/database/seed.js');

  for (const role of ['student', 'trainer']) {
    const account = {
      id: 1,
      firstName: 'Cuenta',
      lastName: 'Existente',
      email: 'ocupado@example.test',
      role,
      passwordHash: 'hash-existente',
    };
    const users = memoryUsers([account]);

    await assert.rejects(seedInitialAdmin(users.repository, {
      email: ' OCUPADO@example.test ',
      password: 'Clave123',
    }), /ya pertenece a otra cuenta/);
    assert.deepEqual(users.rows, [account]);
  }
});

test('rechaza credenciales incompletas o inválidas sin guardar cuentas', async () => {
  const { seedInitialAdmin } = await import('../dist/infrastructure/database/seed.js');
  const invalid = [
    {},
    { email: '', password: 'Clave123' },
    { email: 42, password: 'Clave123' },
    { email: 'incorrecto', password: 'Clave123' },
    { email: 'a\u0000@example.test', password: 'Clave123' },
    { email: 'a'.repeat(255) + '@example.test', password: 'Clave123' },
    ...[undefined, '', 42, 'a'.repeat(7), 'a'.repeat(129), ' Clave123', 'Clave123 ',
      'Clave 123', 'Clave\t123', 'Clave\n123', 'Clave\u00a0123']
      .map(password => ({ email: 'admin@example.test', password })),
  ];

  for (const credentials of invalid) {
    const users = memoryUsers();
    await assert.rejects(seedInitialAdmin(users.repository, credentials));
    assert.deepEqual(users.rows, []);
  }
});
