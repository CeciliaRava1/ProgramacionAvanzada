import type { User } from './user.js';

export type SavedUser = User & { id: number };

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Ya existe una cuenta con ese correo electrónico.');
  }
}

/** Operaciones de cuentas que necesita la aplicación, sin conocer TypeORM. */
export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findById(id: number): Promise<User | null>;
  abstract findTrainers(): Promise<SavedUser[]>;
  abstract save(user: User): Promise<SavedUser>;
}
