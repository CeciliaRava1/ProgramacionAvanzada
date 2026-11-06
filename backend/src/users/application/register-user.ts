import { normalizeTrainerAvailability, normalizeUserDetails, type UserDetails } from '../domain/user.js';
import { EmailAlreadyRegisteredError, UserRepository } from '../domain/user.repository.js';

export interface RegisterUserInput extends UserDetails {
  password: string;
  availability?: string | null;
}

export interface RegisteredUser extends UserDetails {
  id: number;
  role: 'student' | 'trainer';
}

/** Coordina el alta; recibe sus dependencias para poder probarse sin MySQL. */
export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hashPassword: (password: string) => Promise<string>,
  ) {}

  async execute(input: RegisterUserInput, role: RegisteredUser['role']): Promise<RegisteredUser> {
    const details = normalizeUserDetails(input);
    const trainerDetails = role === 'trainer' ? { availability: normalizeTrainerAvailability(input.availability) } : {};
    if (await this.users.findByEmail(details.email)) throw new EmailAlreadyRegisteredError();

    const passwordHash = await this.hashPassword(input.password);
    // El rol lo fija la operación del servidor, nunca el cuerpo enviado por el navegador.
    const saved = await this.users.save({ ...details, ...trainerDetails, passwordHash, role });
    return { id: saved.id, ...details, role };
  }
}
