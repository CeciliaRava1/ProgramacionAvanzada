export type RutaDelAlumno = { pantalla: 'inicio' | 'entrenadores' | 'configuracion' } | { pantalla: 'rutina'; rutinaId: number };

export function interpretarRutaDelAlumno(hash: string): RutaDelAlumno {
  const [pantalla, id, sobrante] = hash.replace(/^#/, '').split('/');
  if (['inicio', 'entrenadores', 'configuracion'].includes(pantalla) && id === undefined) return { pantalla: pantalla as 'inicio' | 'entrenadores' | 'configuracion' };
  if (pantalla === 'mi-rutina' && id && /^[1-9]\d*$/.test(id) && Number(id) <= 4_294_967_295 && sobrante === undefined) return { pantalla: 'rutina', rutinaId: Number(id) };
  return { pantalla: 'inicio' };
}

export function hrefDelAlumno(ruta: RutaDelAlumno): string {
  return ruta.pantalla === 'rutina' ? '#mi-rutina/' + ruta.rutinaId : '#' + ruta.pantalla;
}
