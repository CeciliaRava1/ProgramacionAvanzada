import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameTeachersToTrainers1792800000008 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    for (const [previous, current] of [['teacher_requests', 'trainer_requests'], ['teacher_assignments', 'trainer_assignments']]) {
      const oldExists = await runner.hasTable(previous), newExists = await runner.hasTable(current);
      if (oldExists === newExists) throw new Error('Revisá las tablas de solicitudes y vínculos antes de continuar la migración.');
      if (oldExists) await runner.query(`RENAME TABLE ${previous} TO ${current}`);
      const columns: { name: string }[] = await runner.query('SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [current]);
      const oldColumn = columns.some(column => column.name === 'teacher_id'), newColumn = columns.some(column => column.name === 'trainer_id');
      if (oldColumn === newColumn) throw new Error('Las columnas del vínculo no son válidas.');
      if (oldColumn) await runner.query(`ALTER TABLE ${current} RENAME COLUMN teacher_id TO trainer_id`);
    }

    const checks: { name: string }[] = await runner.query("SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_TYPE = 'CHECK'");
    const transition = 'CHK_users_role_transition';
    // MySQL confirma cada DDL por separado; el estado intermedio permite retomar sin dejar roles sin restricción.
    if (!checks.some(check => check.name === transition)) await runner.query(`ALTER TABLE users ADD CONSTRAINT ${transition} CHECK (role IN ('student', 'teacher', 'trainer', 'admin'))`);
    if (checks.some(check => check.name === 'CHK_users_role')) await runner.query('ALTER TABLE users DROP CHECK CHK_users_role');
    await runner.query("UPDATE users SET role = 'trainer' WHERE role = 'teacher'");
    await runner.query("ALTER TABLE users ADD CONSTRAINT CHK_users_role CHECK (role IN ('student', 'trainer', 'admin'))");
    await runner.query(`ALTER TABLE users DROP CHECK ${transition}`);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar las cuentas y los vínculos; no se convierten ni borran automáticamente.');
  }
}
