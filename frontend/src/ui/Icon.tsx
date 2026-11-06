const paths = {
  back: 'm15 18-6-6 6-6M9 12h12',
  chevron: 'm9 6 6 6-6 6',
  down: 'm6 9 6 6 6-6',
  home: 'm3 10 9-7 9 7v10h-6v-7H9v7H3Z',
  users: 'M15 21v-3a6 6 0 0 0-12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5.65',
  exit: 'M9 21H4V3h5M10 12h11m-4-4 4 4-4 4',
  plus: 'M12 5v14M5 12h14',
  search: 'm21 21-5-5',
  edit: 'm16 3 5 5-12 12-6 1 1-6ZM14 5l5 5',
  settings: 'm9 4.5 .5-2h5l.5 2 2 1 2-.5 2.5 4-1.5 1.5v3l1.5 1.5-2.5 4-2-.5-2 1-.5 2h-5l-.5-2-2-1-2 .5-2.5-4L4 13.5v-3L2.5 9l2.5-4 2 .5Z',
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} />{name === 'users' && <circle cx="9" cy="8" r="3" />}{name === 'search' && <circle cx="10.5" cy="10.5" r="6.5" />}{name === 'settings' && <circle cx="12" cy="12" r="3" />}</svg>;
}
