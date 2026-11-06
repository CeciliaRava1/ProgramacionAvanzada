import { isTrainingPlan, type TrainingPlan } from './training-plans.ts';
import { isTrainingProgram, type TrainingProgram } from './training-programs.ts';
import { isTrainingRoutine, type TrainingRoutine } from './training-routines.ts';
import { isRoutineExercise, type RoutineExercise } from './routine-exercises.ts';
import { isRecordWithKeys } from '../validation.ts';

export interface StudentPlanningView {
  plan: TrainingPlan | null;
  program: TrainingProgram | null;
  routines: TrainingRoutine[];
}

export interface StudentRoutineView {
  routine: TrainingRoutine;
  exercises: RoutineExercise[];
}

export class StudentPlanningError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

const isId = (value: number) => Number.isSafeInteger(value) && value > 0 && value <= 4_294_967_295;

function invalid(): never {
  throw new StudentPlanningError('No se pudo consultar tu planificación: la respuesta del servidor no es válida.');
}

function isStudentPlanningView(value: unknown, studentId: number): value is StudentPlanningView {
  if (!isRecordWithKeys(value, ['plan', 'program', 'routines']) || !Array.isArray(value.routines)) {
    return false;
  }

  const { plan, program, routines } = value;

  if (plan === null) {
    return program === null && routines.length === 0;
  }

  if (!isTrainingPlan(plan, studentId)) {
    return false;
  }

  if (program === null) {
    return routines.length === 0;
  }

  // Además de los tipos, la respuesta debe conservar la pertenencia entre sus elementos.
  return isTrainingProgram(program, plan.id) &&
    routines.every(routine => isTrainingRoutine(routine, program.id));
}

function isStudentRoutineView(
  value: unknown,
  routineId: number,
  programId: number,
): value is StudentRoutineView {
  return isRecordWithKeys(value, ['routine', 'exercises']) &&
    isTrainingRoutine(value.routine, programId) &&
    value.routine.id === routineId &&
    Array.isArray(value.exercises) &&
    value.exercises.every(entry => isRoutineExercise(entry, routineId));
}

async function request(path: string, signal: AbortSignal): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch('http://127.0.0.1:3000/users/me/planning' + path, {
      method: 'GET',
      credentials: 'include',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new StudentPlanningError('No se pudo consultar tu planificación. Revisá la conexión.');
  }

  if (!response.ok) {
    let message = 'No se pudo consultar tu planificación. Intentá nuevamente.';

    switch (response.status) {
      case 400:
        message = 'Seleccioná una rutina válida.';
        break;
      case 401:
        message = 'Tu sesión venció. Volvé a iniciar sesión.';
        break;
      case 403:
        message = 'No tenés permiso para consultar esta planificación.';
        break;
      case 404:
        message = 'La rutina ya no está disponible.';
        break;
      case 503:
        message = 'No se pudo recuperar tu sesión. Intentá nuevamente.';
        break;
    }

    throw new StudentPlanningError(message, response.status);
  }

  if (response.status !== 200) {
    invalid();
  }

  return response.json().catch(() => invalid());
}

export async function getStudentPlanning(studentId: number, signal: AbortSignal): Promise<StudentPlanningView> {
  if (!isId(studentId)) {
    throw new StudentPlanningError('Tu sesión no es válida. Volvé a iniciar sesión.');
  }

  const value = await request('', signal);

  if (!isStudentPlanningView(value, studentId)) {
    invalid();
  }

  return value;
}

export async function getStudentRoutine(
  routineId: number,
  programId: number,
  signal: AbortSignal,
): Promise<StudentRoutineView> {
  if (!isId(routineId) || !isId(programId)) {
    throw new StudentPlanningError('Seleccioná una rutina válida.', 400);
  }

  const value = await request('/routines/' + routineId, signal);

  if (!isStudentRoutineView(value, routineId, programId)) {
    invalid();
  }

  return value;
}
