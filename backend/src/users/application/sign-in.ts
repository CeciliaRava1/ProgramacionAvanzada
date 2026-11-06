import { UserRepository } from '../domain/user.repository.js';
import type { UserRole } from '../domain/user.js';

export interface SessionUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export class InvalidCredentialsError extends Error {
  constructor() { super('Correo o contraseña incorrectos'); }
}

/** Verifica credenciales sin conocer cookies, Express ni TypeORM. */
export class SignIn {
  constructor(
    private readonly users: UserRepository,
    private readonly verifyPassword: (password: string, hash?: string) => Promise<boolean>,
  ) {}

  async execute(email: string, password: string): Promise<SessionUser> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const matches = await this.verifyPassword(password, user?.passwordHash);
    if (!user?.id || !matches) throw new InvalidCredentialsError();
    return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role };
  }
}
