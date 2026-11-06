export interface Exercise {
  id: number;
  source: string;
  sourceId: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  instructions: string;
}

export type PublicExercise = Omit<Exercise, 'source' | 'sourceId'>;
export interface ExerciseSearch { q: string; bodyPart: string; equipment: string; offset: number; }
export interface ExercisePage { items: PublicExercise[]; total: number; bodyParts: string[]; equipment: string[]; }
export class ExerciseNotFoundError extends Error {
  constructor() { super('El ejercicio ya no está disponible.'); }
}

export function publicExercise({ id, name, bodyPart, equipment, target, instructions }: Exercise): PublicExercise {
  return { id, name, bodyPart, equipment, target, instructions };
}
