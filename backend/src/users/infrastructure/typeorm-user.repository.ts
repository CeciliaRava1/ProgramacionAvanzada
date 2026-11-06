import { DataSource, EntitySchema, QueryFailedError } from 'typeorm';
import type { User } from '../domain/user.js';
import { EmailAlreadyRegisteredError, UserRepository, type SavedUser } from '../domain/user.repository.js';

// El mapeo queda en infraestructura para que User no importe decoradores del ORM.
export const UserSchema = new EntitySchema<User>({
  name: 'User',
  tableName: 'users',
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    firstName: { name: 'first_name', type: 'varchar', length: 100 },
    lastName: { name: 'last_name', type: 'varchar', length: 100 },
    email: { type: 'varchar', length: 254, collation: 'utf8mb4_0900_as_ci' },
    passwordHash: { name: 'password_hash', type: 'varchar', length: 255 },
    role: { type: 'varchar', length: 16 },
    availability: { type: 'varchar', length: 255, nullable: true },
  },
  uniques: [{ name: 'UQ_users_email', columns: ['email'] }],
  checks: [{ name: 'CHK_users_role', expression: "role IN ('student', 'trainer', 'admin')" }],
});

export class TypeOrmUserRepository extends UserRepository {
  constructor(private readonly dataSource: DataSource) { super(); }

  findByEmail(email: string): Promise<User | null> {
    return this.dataSource.getRepository(UserSchema).findOneBy({ email });
  }

  findById(id: number): Promise<User | null> {
    return this.dataSource.getRepository(UserSchema).findOneBy({ id });
  }

  findTrainers(): Promise<SavedUser[]> {
    return this.dataSource.getRepository(UserSchema).find({
      where: { role: 'trainer' },
      order: { lastName: 'ASC', firstName: 'ASC', id: 'ASC' },
    }) as Promise<SavedUser[]>;
  }

  async save(user: User): Promise<SavedUser> {
    try {
      return await this.dataSource.getRepository(UserSchema).save(user) as SavedUser;
    } catch (error: unknown) {
      // UNIQUE resuelve también dos altas simultáneas con el mismo correo.
      if (error instanceof QueryFailedError &&
          error.driverError.code === 'ER_DUP_ENTRY' &&
          String(error.driverError.sqlMessage).includes('UQ_users_email')) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }
}
