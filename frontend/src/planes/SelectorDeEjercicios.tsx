import { useEffect, useState } from 'react';
import { buscarEjercicios, type Ejercicio, type PaginaDeEjercicios, type FiltrosDeEjercicios } from './ejercicios-de-rutina.ts';
import { Icono } from '../interfaz/Icono.tsx';

export function SelectorDeEjercicios({ activo, deshabilitado, alElegir }: {
  activo: boolean;
  deshabilitado: boolean;
  alElegir: (ejercicio: Ejercicio) => void;
}) {
  const [filtros, setFiltros] = useState<FiltrosDeEjercicios>({ q: '', parteDelCuerpo: '', equipamiento: '', desde: 0 });
  const [pagina, setPagina] = useState<PaginaDeEjercicios | null>(null);
  const [cargando, setCargando] = useState(true),
    [error, setError] = useState(''),
    [intento, setIntento] = useState(0);
  useEffect(() => {
    if (!activo) {
      return;
    }

    const controlador = new AbortController();
    setCargando(true);
    setError('');
    // La espera agrupa las pulsaciones antes de consultar el catálogo.
    const temporizador = setTimeout(() => {
      buscarEjercicios(filtros, controlador.signal).then(
        valor => {
          if (!controlador.signal.aborted) {
            setPagina(valor);
          }
        },
        falla => {
          if (!controlador.signal.aborted) {
            setError(falla instanceof Error ? falla.message : 'No se pudo consultar el catálogo.');
          }
        },
      ).finally(() => {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      });
    }, 300);

    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [filtros, intento, activo]);
  const noDisponible = deshabilitado || cargando || Boolean(error);

  return <section aria-label="Catálogo de ejercicios" aria-busy={cargando}>
    <label htmlFor="busqueda-de-ejercicios">Buscar ejercicio</label>
    <div className="campo-de-busqueda">
      <Icono nombre="buscar" />
      <input
        id="busqueda-de-ejercicios"
        type="search"
        maxLength={100}
        value={filtros.q}
        disabled={deshabilitado}
        onChange={evento => setFiltros(valor => ({ ...valor, q: evento.target.value, desde: 0 }))}
        className="field"
        placeholder="Nombre, músculo o equipamiento"
      />
    </div>
    <details className="filtros">
      <summary><Icono nombre="abajo" />Filtros{(filtros.parteDelCuerpo || filtros.equipamiento) && <span className="badge">Activos</span>}</summary>
      <div className="grilla-de-filtros">
        {(['parteDelCuerpo', 'equipamiento'] as const).map(campo => <div key={campo}>
          <label htmlFor={'catalogo-' + campo}>{campo === 'parteDelCuerpo' ? 'Grupo corporal' : 'Equipamiento'}</label>
          <select
            id={'catalogo-' + campo}
            value={filtros[campo]}
            disabled={deshabilitado}
            onChange={evento => setFiltros(valor => ({ ...valor, [campo]: evento.target.value, desde: 0 }))}
            className="field"
          >
            <option value="">Todos</option>
            {(campo === 'parteDelCuerpo' ? pagina?.partesDelCuerpo : pagina?.equipamientos)?.map(valor => <option key={valor} value={valor}>{valor}</option>)}
          </select>
        </div>)}
      </div>
    </details>
    {cargando && <p role="status" className="notice muted">Buscando ejercicios…</p>}
    {error &&
      <div className="notice">
        <p role="alert" className="text-danger">{error}</p>
        <button
          type="button"
          disabled={deshabilitado || cargando}
          className="secondary"
          onClick={() => setIntento(valor => valor + 1)}
        >Reintentar</button>
      </div>}
    {!cargando && !error && pagina &&
      <p role="status" className="cantidad-de-resultados">
        {pagina.total === 0 ? 'No se encontraron ejercicios.' : pagina.total + ' ejercicios · ' + (filtros.desde + 1) + '–' + (filtros.desde + pagina.elementos.length)}
      </p>}
    {pagina &&
      <ul className="list">
        {pagina.elementos.map(ejercicio => <li key={ejercicio.id}>
          <button type="button" className="fila-de-catalogo" disabled={noDisponible} onClick={() => alElegir(ejercicio)}>
            <span className="row-copy">
              <span className="row-title">{ejercicio.nombre}</span>
              <span className="row-meta">{ejercicio.musculoObjetivo} · {ejercicio.equipamiento}</span>
            </span>
            <span className="agregar-del-catalogo"><Icono nombre="mas" /></span>
          </button>
        </li>)}
      </ul>}
    {pagina && pagina.total > 20 &&
      <nav aria-label="Páginas de ejercicios" className="paginacion">
        <button
          type="button"
          className="secondary"
          disabled={noDisponible || filtros.desde === 0}
          onClick={() => setFiltros(valor => ({ ...valor, desde: Math.max(0, valor.desde - 20) }))}
        >Anterior</button>
        <button
          type="button"
          className="secondary"
          disabled={noDisponible || filtros.desde + pagina.elementos.length >= pagina.total}
          onClick={() => setFiltros(valor => ({ ...valor, desde: valor.desde + 20 }))}
        >Siguiente</button>
      </nav>}
  </section>;
}
