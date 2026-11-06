import { TrainerRequestRepository, type AssignedStudent } from '../domain/trainer-request.repository.js';

/** Expone solo la identidad pública de los alumnos vinculados al entrenador. */
export class ListAssignedStudents {
  constructor(private readonly requests: TrainerRequestRepository) {}

  async execute(trainerId: number): Promise<AssignedStudent[]> {
    const students = await this.requests.findAssignedByTrainer(trainerId);
    return students.map(({ id, firstName, lastName }) => ({ id, firstName, lastName }));
  }
}
