import { DataSource, EntitySchema, QueryFailedError } from 'typeorm';
import type { TrainerAssignment, TrainerRequest } from '../domain/trainer-request.js';
import { TrainerRequestConflictError, TrainerRequestNotFoundError } from '../domain/trainer-request.js';
import {
  TrainerRequestRepository, type AssignedStudent, type ReceivedTrainerRequest, type SavedTrainerRequest, type TrainerRequestTransaction,
} from '../domain/trainer-request.repository.js';
import { UserSchema } from './typeorm-user.repository.js';

export const TrainerRequestSchema = new EntitySchema<TrainerRequest>({
  name: 'TrainerRequest', tableName: 'trainer_requests',
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    studentId: { name: 'student_id', type: 'int', unsigned: true },
    trainerId: { name: 'trainer_id', type: 'int', unsigned: true },
    status: { type: 'varchar', length: 10 },
  },
});

export const TrainerAssignmentSchema = new EntitySchema<TrainerAssignment>({
  name: 'TrainerAssignment', tableName: 'trainer_assignments',
  columns: {
    studentId: { name: 'student_id', type: 'int', unsigned: true, primary: true },
    trainerId: { name: 'trainer_id', type: 'int', unsigned: true },
  },
});

export class TypeOrmTrainerRequestRepository extends TrainerRequestRepository {
  constructor(private readonly dataSource: DataSource) { super(); }

  findById(id: number): Promise<SavedTrainerRequest | null> {
    return this.dataSource.getRepository(TrainerRequestSchema).findOneBy({ id }) as Promise<SavedTrainerRequest | null>;
  }

  findPendingByTrainer(trainerId: number): Promise<ReceivedTrainerRequest[]> {
    return this.dataSource.query(`
      SELECT r.id, r.student_id AS studentId, r.trainer_id AS trainerId, r.status,
             u.first_name AS firstName, u.last_name AS lastName
      FROM trainer_requests r JOIN users u ON u.id = r.student_id
      WHERE r.trainer_id = ? AND r.status = 'pending'
      ORDER BY u.last_name, u.first_name, r.id
    `, [trainerId]);
  }

  findAssignedByTrainer(trainerId: number): Promise<AssignedStudent[]> {
    return this.dataSource.query(`
      SELECT u.id, u.first_name AS firstName, u.last_name AS lastName
      FROM trainer_assignments a JOIN users u ON u.id = a.student_id
      WHERE a.trainer_id = ? AND u.role = 'student'
      ORDER BY u.last_name, u.first_name, u.id
    `, [trainerId]);
  }

  findAssignment(studentId: number): Promise<TrainerAssignment | null> {
    return this.dataSource.getRepository(TrainerAssignmentSchema).findOneBy({ studentId });
  }

  async withStudent<T>(studentId: number, action: (transaction: TrainerRequestTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Todas las operaciones del mismo alumno esperan este bloqueo antes de leer su estado.
        const student = await manager.getRepository(UserSchema).findOne({
          where: { id: studentId, role: 'student' }, lock: { mode: 'pessimistic_write' },
        });
        if (!student) throw new TrainerRequestNotFoundError('El alumno no existe.');
        const requests = manager.getRepository(TrainerRequestSchema);
        const assignments = manager.getRepository(TrainerAssignmentSchema);
        return action({
          findPending: () => requests.findOneBy({ studentId, status: 'pending' }) as Promise<SavedTrainerRequest | null>,
          findAssignment: () => assignments.findOneBy({ studentId }),
          findRequest: (id) => requests.findOneBy({ id, studentId }) as Promise<SavedTrainerRequest | null>,
          saveRequest: (request) => requests.save(request) as Promise<SavedTrainerRequest>,
          saveAssignment: async (assignment) => { await assignments.insert(assignment); },
        });
      });
    } catch (error: unknown) {
      if (error instanceof QueryFailedError && error.driverError.code === 'ER_DUP_ENTRY') {
        throw new TrainerRequestConflictError('El alumno ya tiene una solicitud pendiente o un entrenador asignado.');
      }
      throw error;
    }
  }
}
