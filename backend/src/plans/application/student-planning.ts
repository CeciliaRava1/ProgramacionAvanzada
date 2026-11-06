import { TrainingPlanRepository, type SavedTrainingPlan } from '../domain/training-plan.repository.js';
import { TrainingProgramRepository, type SavedTrainingProgram } from '../domain/training-program.repository.js';
import { TrainingRoutineRepository, type SavedTrainingRoutine } from '../domain/training-routine.repository.js';
import { TrainingRoutineNotFoundError } from '../domain/training-routine.js';
import { RoutineExerciseRepository } from '../domain/routine-exercise.repository.js';

export interface StudentPlanningView {
  plan: SavedTrainingPlan | null;
  program: SavedTrainingProgram | null;
  routines: SavedTrainingRoutine[];
}

/** La consulta propia depende de la identidad del alumno, no de un vínculo con un entrenador. */
export class StudentPlanning {
  constructor(
    private readonly plans: TrainingPlanRepository,
    private readonly programs: TrainingProgramRepository,
    private readonly routines: TrainingRoutineRepository,
    private readonly entries: RoutineExerciseRepository,
  ) {}

  async get(studentId: number): Promise<StudentPlanningView> {
    const plan = (await this.plans.findByStudent(studentId))[0];
    if (!plan) return { plan: null, program: null, routines: [] };
    const { id, name, objective } = plan;
    const publicPlan = { id, studentId, name, objective };
    const program = (await this.programs.findByPlan(id))[0];
    if (!program) return { plan: publicPlan, program: null, routines: [] };
    const { id: programId, planId, name: programName, startDate, endDate } = program;
    return {
      plan: publicPlan,
      program: { id: programId, planId, name: programName, startDate, endDate },
      routines: (await this.routines.findByProgram(programId)).map(({ id, programId, name, description }) => ({ id, programId, name, description })),
    };
  }

  async getRoutine(studentId: number, routineId: number) {
    const planning = await this.get(studentId);
    const routine = planning.routines.find(item => item.id === routineId);
    if (!routine) throw new TrainingRoutineNotFoundError();
    const exercises = (await this.entries.list(routineId)).map(({ id, routineId, exerciseId, setCount, recommendedRepetitions, recommendedWeightKg, restSeconds, recommendedRir, exercise }) => ({
      id, routineId, exerciseId, setCount, recommendedRepetitions, recommendedWeightKg, restSeconds, recommendedRir,
      exercise: { id: exercise.id, name: exercise.name, bodyPart: exercise.bodyPart, equipment: exercise.equipment, target: exercise.target, instructions: exercise.instructions },
    }));
    return { routine, exercises };
  }
}
