import { useCallback, useEffect, useRef, useState } from 'react';
import { darDeBajaCuenta, listarCuentas, type CuentaGestionada, type TipoDeCuenta } from './cuentas.ts';
import { FormularioDeEdicionDeCuenta } from './FormularioDeEdicionDeCuenta.tsx';
import { FormularioDeRegistro } from '../registro/FormularioDeRegistro.tsx';
import { formatearTurnos } from '../entrenadores/turnos.ts';
import { AvisoFlotante } from '../interfaz/AvisoFlotante.tsx';
import { Dialogo } from '../interfaz/Dialogo.tsx';
import { Icono } from '../interfaz/Icono.tsx';

type Modo = { pantalla: 'lista' } | { pantalla: 'crear' } | { pantalla: 'editar'; cuenta: CuentaGestionada };

const textos = {
  entrenadores: { plural: 'Entrenadores', crear: 'Crear entrenador', vacio: 'Todavía no hay entrenadores registrados.' },
  alumnos: { plural: 'Alumnos', crear: 'Crear alumno', vacio: 'Todavía no hay alumnos registrados.' },
} as const;

/** Listado, alta, edición y baja lógica de las cuentas de un tipo; solo para el administrador. */
export function PanelDeCuentas({ tipo }: { tipo: TipoDeCuenta }) {
  const texto = textos[tipo];
  const esEntrenador = tipo === 'entrenadores';
  const [modo, setModo] = useState<Modo>({ pantalla: 'lista' });
  const [cuentas, setCuentas] = useState<CuentaGestionada[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [mensaje, setMensaje] = useState('');
  const [intento, setIntento] = useState(0);
  const [objetivo, setObjetivo] = useState<CuentaGestionada | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorDeAccion, setErrorDeAccion] = useState('');
  const [aviso, setAviso] = useState('');
  const cerrarAviso = useCallback(() => setAviso(''), []);
  const operacion = useRef<AbortController | null>(null);
  useEffect(() => () => operacion.current?.abort(), []);

  useEffect(() => {
    const controlador = new AbortController();
    setEstado('cargando');
    setMensaje('');
    listarCuentas(tipo, controlador.signal).then(
      (resultado) => {
        if (!controlador.signal.aborted) {
          setCuentas(resultado);
          setEstado('listo');
        }
      },
      (error: unknown) => {
        if (!controlador.signal.aborted) {
          setMensaje(error instanceof Error ? error.message : 'No se pudo consultar el listado.');
          setEstado('error');
        }
      },
    );

    return () => controlador.abort();
  }, [tipo, intento]);

  function volverALaLista() {
    setModo({ pantalla: 'lista' });
    setIntento((valor) => valor + 1);
  }

  function cerrarDialogo() {
    if (!ocupado) {
      setObjetivo(null);
      setErrorDeAccion('');
    }
  }

  async function confirmarBaja() {
    if (!objetivo || operacion.current) {
      return;
    }

    const controlador = new AbortController();
    operacion.current = controlador;
    setOcupado(true);
    setErrorDeAccion('');

    try {
      await darDeBajaCuenta(tipo, objetivo.id, controlador.signal);

      if (!controlador.signal.aborted) {
        setAviso(`La cuenta de ${objetivo.nombre} ${objetivo.apellido} fue dada de baja.`);
        setObjetivo(null);
        setIntento((valor) => valor + 1);
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setErrorDeAccion(error instanceof Error ? error.message : 'No se pudo dar de baja la cuenta.');
        setIntento((valor) => valor + 1);
      }
    } finally {
      operacion.current = null;

      if (!controlador.signal.aborted) {
        setOcupado(false);
      }
    }
  }

  if (modo.pantalla === 'crear') {
    return <>
      <button type="button" className="back" onClick={volverALaLista}><Icono nombre="atras" />{texto.plural}</button>
      <FormularioDeRegistro
        tipoDeCuenta={esEntrenador ? 'entrenador' : 'alumno'}
        alCrear={() => {
          setAviso(esEntrenador ? 'Se creó la cuenta del entrenador.' : 'Se creó la cuenta del alumno.');
          volverALaLista();
        }}
      />
    </>;
  }

  if (modo.pantalla === 'editar') {
    return <FormularioDeEdicionDeCuenta
      tipo={tipo}
      cuenta={modo.cuenta}
      alCancelar={() => setModo({ pantalla: 'lista' })}
      alGuardar={(guardada) => {
        setAviso(`Se guardaron los cambios de ${guardada.nombre} ${guardada.apellido}.`);
        volverALaLista();
      }}
    />;
  }

  return <section aria-labelledby="page-title">
    <header className="page-head">
      <h1 id="page-title" tabIndex={-1}>{texto.plural}</h1>
      <button type="button" className="primary" onClick={() => { setAviso(''); setModo({ pantalla: 'crear' }); }}>
        <Icono nombre="mas" />{texto.crear}
      </button>
    </header>
    <AvisoFlotante mensaje={aviso} alCerrar={cerrarAviso} />
    {estado === 'cargando' && <p className="notice muted" role="status">Consultando {texto.plural.toLowerCase()}…</p>}
    {estado === 'error' &&
      <div className="notice">
        <p className="text-danger" role="alert">{mensaje}</p>
        <button type="button" className="secondary" onClick={() => setIntento((valor) => valor + 1)}>Reintentar</button>
      </div>}
    {estado === 'listo' && cuentas.length === 0 && <p className="notice muted" role="status">{texto.vacio}</p>}
    {cuentas.length > 0 && estado !== 'error' &&
      <ul className="list" aria-label={`Listado de ${texto.plural.toLowerCase()}`}>
        {cuentas.map((cuenta) => <li key={cuenta.id} className={'fila-de-persona fila-de-cuenta' + (cuenta.activa ? '' : ' inactiva')}>
          <div className="row-copy">
            <span className="row-title">{cuenta.nombre} {cuenta.apellido}</span>
            <span className="row-meta">{cuenta.correo}</span>
            {esEntrenador && cuenta.horario && cuenta.horario.length > 0 &&
              <span className="row-meta">Horario: {formatearTurnos(cuenta.horario)}</span>}
            <span className={'row-meta estado-de-cuenta' + (cuenta.activa ? '' : ' inactiva')}>{cuenta.activa ? 'Activo' : 'Dada de baja'}</span>
          </div>
          <div className="acciones-de-cuenta">
            <button
              type="button"
              className="text-button"
              disabled={!cuenta.activa}
              aria-label={`Editar a ${cuenta.nombre} ${cuenta.apellido}`}
              onClick={() => { setAviso(''); setModo({ pantalla: 'editar', cuenta }); }}
            ><Icono nombre="editar" />Editar</button>
            <button
              type="button"
              className="text-button peligro"
              disabled={!cuenta.activa}
              aria-label={`Dar de baja a ${cuenta.nombre} ${cuenta.apellido}`}
              onClick={() => { setAviso(''); setErrorDeAccion(''); setObjetivo(cuenta); }}
            >Dar de baja</button>
          </div>
        </li>)}
      </ul>}
    <Dialogo abierto={objetivo !== null} titulo="Dar de baja la cuenta" ocupado={ocupado} alCerrar={cerrarDialogo}>
      {objetivo && <>
        <p>
          La cuenta de <strong>{objetivo.nombre} {objetivo.apellido}</strong> no va a poder iniciar sesión.{' '}
          {esEntrenador
            ? 'Se finalizan sus vinculaciones con alumnos y se cancelan sus solicitudes pendientes.'
            : 'Se finaliza su vinculación con su entrenador y se cancelan sus solicitudes pendientes.'}{' '}
          Los datos y los entrenamientos se conservan.
        </p>
        {errorDeAccion && <p className="notice text-danger" role="alert">{errorDeAccion}</p>}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={cerrarDialogo} disabled={ocupado}>Cancelar</button>
          <button type="button" className="danger-button" onClick={confirmarBaja} disabled={ocupado}>
            {ocupado ? 'Dando de baja…' : 'Dar de baja'}
          </button>
        </div>
      </>}
    </Dialogo>
  </section>;
}
