export type StudentRoute = { screen: 'home' | 'trainers' | 'settings' } | { screen: 'routine'; routineId: number };

export function parseStudentRoute(hash: string): StudentRoute {
  const [screen, id, extra] = hash.replace(/^#/, '').split('/');
  if (['home', 'trainers', 'settings'].includes(screen) && id === undefined) return { screen: screen as 'home' | 'trainers' | 'settings' };
  if (screen === 'my-routine' && id && /^[1-9]\d*$/.test(id) && Number(id) <= 4_294_967_295 && extra === undefined) return { screen: 'routine', routineId: Number(id) };
  return { screen: 'home' };
}

export function studentHref(route: StudentRoute): string {
  return route.screen === 'routine' ? '#my-routine/' + route.routineId : '#' + route.screen;
}
