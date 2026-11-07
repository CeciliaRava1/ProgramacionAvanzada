const trazos = {
  atras: 'm15 18-6-6 6-6M9 12h12',
  flecha: 'm9 6 6 6-6 6',
  abajo: 'm6 9 6 6 6-6',
  inicio: 'm3 10 9-7 9 7v10h-6v-7H9v7H3Z',
  usuarios: 'M15 21v-3a6 6 0 0 0-12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5.65',
  salir: 'M9 21H4V3h5M10 12h11m-4-4 4 4-4 4',
  mas: 'M12 5v14M5 12h14',
  buscar: 'm21 21-5-5',
  editar: 'm16 3 5 5-12 12-6 1 1-6ZM14 5l5 5',
  configuracion: 'm9 4.5 .5-2h5l.5 2 2 1 2-.5 2.5 4-1.5 1.5v3l1.5 1.5-2.5 4-2-.5-2 1-.5 2h-5l-.5-2-2-1-2 .5-2.5-4L4 13.5v-3L2.5 9l2.5-4 2 .5Z',
  ojo: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z',
  'ojo-tachado': 'm3 3 18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A16.5 16.5 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
};

export function Icono({ nombre }: { nombre: keyof typeof trazos }) {
  return <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={trazos[nombre]} />{nombre === 'usuarios' && <circle cx="9" cy="8" r="3" />}{nombre === 'buscar' && <circle cx="10.5" cy="10.5" r="6.5" />}{(nombre === 'configuracion' || nombre === 'ojo') && <circle cx="12" cy="12" r="3" />}</svg>;
}
