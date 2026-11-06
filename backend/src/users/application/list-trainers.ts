import { UserRepository } from '../domain/user.repository.js';

export interface TrainerSummary {
  id: number;
  firstName: string;
  lastName: string;
  availability: string | null;
}

/** Construye la respuesta del listado sin exponer correo, contraseña ni hash. */
export class ListTrainers {
  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<TrainerSummary[]> {
    const trainers = await this.users.findTrainers();
    return trainers.map(({ id, firstName, lastName, availability }) => ({
      id, firstName, lastName, availability: availability ?? null,
    }));
  }
}
