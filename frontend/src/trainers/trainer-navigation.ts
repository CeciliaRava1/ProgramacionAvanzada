import type { Exercise } from '../plans/routine-exercises.ts';

export type TrainerScreen = 'home' | 'settings' | 'students' | 'requests' | 'student' | 'plan-form' | 'delete-plan' | 'program-form' | 'routine' | 'routine-form' | 'catalog' | 'exercise';
export interface TrainerRoute { screen: TrainerScreen; studentId?: number; routineId?: number; entryId?: number; exerciseId?: number }
export type NavigateTrainer = (route: TrainerRoute, exercise?: Exercise) => void;

const id = (value: string | undefined) => value && /^[1-9]\d*$/.test(value) && Number(value) <= 4294967295 ? Number(value) : undefined;

export function parseTrainerRoute(hash: string): TrainerRoute {
  const [screen, student, routine, entry, exercise, extra] = hash.replace(/^#/, '').split('/');
  const studentId = id(student), routineId = id(routine), entryId = id(entry), exerciseId = id(exercise);
  if (['home', 'settings', 'students', 'requests'].includes(screen) && student === undefined) return { screen: screen as TrainerScreen };
  if (['student', 'plan-form', 'delete-plan', 'program-form'].includes(screen) && studentId && routine === undefined) return { screen: screen as TrainerScreen, studentId };
  if (screen === 'routine-form' && studentId && entry === undefined && (routine === undefined || routineId)) return { screen, studentId, ...(routineId ? { routineId } : {}) };
  if (['routine', 'catalog'].includes(screen) && studentId && routineId && entry === undefined) return { screen: screen as TrainerScreen, studentId, routineId };
  if (screen === 'exercise' && studentId && routineId && extra === undefined) {
    if (entryId && exercise === undefined) return { screen, studentId, routineId, entryId };
    if (entry === '' && exerciseId) return { screen, studentId, routineId, exerciseId };
  }
  return { screen: 'students' };
}

export function trainerHref(route: TrainerRoute): string {
  let hash = '#' + route.screen;
  if (route.studentId !== undefined) hash += '/' + route.studentId;
  if (route.routineId !== undefined) hash += '/' + route.routineId;
  if (route.screen === 'exercise') hash += route.entryId !== undefined ? '/' + route.entryId : '//' + route.exerciseId;
  return hash;
}

export function isTrainerForm(route: TrainerRoute) {
  return ['plan-form', 'delete-plan', 'program-form', 'routine-form'].includes(route.screen);
}
