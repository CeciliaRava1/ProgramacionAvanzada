import { obtenerErroresDeDatosDeCuenta, type DatosDeCuentaEntrada } from '../registro/registro-de-usuario.ts';
import { esListaDeTurnosValida, ordenarTurnos, type Turno } from '../entrenadores/turnos.ts';

export type TipoDeCuenta = 'alumnos' | 'entrenadores';

/** Cuenta tal como la lista el administrador; solo los entrenadores tienen horario. */
export interface CuentaGestionada {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  activa: boolean;
  horario?: Turno[];
}

export type ErroresDeCampoDeCuenta = Partial<Record<'nombre' | 'apellido' | 'correo' | 'horario', string>>;

export class ErrorDeCuenta extends Error {
  readonly estado: number;
  readonly erroresDeCampo: ErroresDeCampoDeCuenta;

  constructor(mensaje: string, estado = 0, erroresDeCampo: ErroresDeCampoDeCuenta = {}) {
    super(mensaje);
    this.estado = estado;
    this.erroresDeCampo = erroresDeCampo;
  }
}

function esIdentificador(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 && valor <= 4_294_967_295;
}

function respuestaInvalida(): never {
  throw new ErrorDeCuenta('No se pudo confirmar el resultado: la respuesta del servidor no es válida.');
}

/** Acepta solo los campos esperados para cada tipo de cuenta; nunca contraseñas ni datos internos. */
export function esCuentaGestionada(valor: unknown, tipo: TipoDeCuenta): valor is CuentaGestionada {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false;
  const cuenta = valor as Record<string, unknown>;
  const claves = ['id', 'nombre', 'apellido', 'correo', 'activa', ...(tipo === 'entrenadores' ? ['horario'] : [])];
  return Object.keys(cuenta).length === claves.length && claves.every((clave) => Object.hasOwn(cuenta, clave)) &&
    esIdentificador(cuenta.id) &&
    typeof cuenta.nombre === 'string' && [...cuenta.nombre.trim()].length > 0 && [...cuenta.nombre].length <= 100 &&
    typeof cuenta.apellido === 'string' && [...cuenta.apellido.trim()].length > 0 && [...cuenta.apellido].length <= 100 &&
    typeof cuenta.correo === 'string' && cuenta.correo.length > 0 && [...cuenta.correo].length <= 254 &&
    typeof cuenta.activa === 'boolean' &&
    (tipo === 'alumnos' || esListaDeTurnosValida(cuenta.horario));
}

/** Centraliza cookies y mensajes de error; nunca muestra textos internos del servidor. */
async function pedir(
  tipo: TipoDeCuenta, ruta: string, metodo: string, senal: AbortSignal, estadoEsperado: number, cuerpo?: unknown,
): Promise<unknown> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`http://127.0.0.1:3000/usuarios/administrador/${tipo}${ruta}`, {
      method: metodo, credentials: 'include',
      ...(cuerpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }),
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new ErrorDeCuenta(metodo === 'GET' ? 'No se pudo consultar el listado. Revisá la conexión e intentá nuevamente.' :
      'No se pudo confirmar la operación. Actualizá el listado antes de reintentar.');
  }
  if (!respuesta.ok) {
    const erroresDeCampo: ErroresDeCampoDeCuenta = {};
    if (respuesta.status === 400) {
      const error: unknown = await respuesta.json().catch(() => null);
      if (typeof error === 'object' && error !== null && 'erroresDeCampo' in error &&
          typeof error.erroresDeCampo === 'object' && error.erroresDeCampo !== null) {
        for (const campo of ['nombre', 'apellido', 'correo', 'horario'] as const) {
          const mensaje = (error.erroresDeCampo as Record<string, unknown>)[campo];
          if (typeof mensaje === 'string') erroresDeCampo[campo] = mensaje;
        }
      }
    }
    throw new ErrorDeCuenta(
      respuesta.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
        respuesta.status === 403 ? 'No tenés permiso para gestionar cuentas.' :
          respuesta.status === 404 ? 'La cuenta ya no está disponible. Actualizá el listado.' :
            respuesta.status === 409 ? 'Ya existe una cuenta con ese correo o la cuenta fue dada de baja. Actualizá el listado.' :
              respuesta.status === 400 ? 'Revisá los datos ingresados.' : 'No se pudo completar la operación. Intentá nuevamente.',
      respuesta.status,
      erroresDeCampo,
    );
  }
  if (respuesta.status !== estadoEsperado) respuestaInvalida();
  return estadoEsperado === 204 ? undefined : respuesta.json().catch(() => respuestaInvalida());
}

export async function listarCuentas(tipo: TipoDeCuenta, senal: AbortSignal): Promise<CuentaGestionada[]> {
  const cuerpo = await pedir(tipo, '', 'GET', senal, 200);
  if (!Array.isArray(cuerpo) || cuerpo.some((elemento: unknown) => !esCuentaGestionada(elemento, tipo))) return respuestaInvalida();
  return cuerpo as CuentaGestionada[];
}

export async function modificarCuenta(
  tipo: TipoDeCuenta, id: number, entrada: DatosDeCuentaEntrada, senal: AbortSignal,
): Promise<CuentaGestionada> {
  if (!esIdentificador(id)) throw new ErrorDeCuenta('Seleccioná una cuenta válida.');
  const erroresDeCampo = obtenerErroresDeDatosDeCuenta(tipo === 'entrenadores' ? entrada : { ...entrada, horario: undefined });
  if (Object.keys(erroresDeCampo).length > 0) throw new ErrorDeCuenta('Revisá los datos ingresados.', 0, erroresDeCampo);
  const cuerpo = await pedir(tipo, `/${id}`, 'PUT', senal, 200, {
    nombre: entrada.nombre,
    apellido: entrada.apellido,
    correo: entrada.correo,
    ...(tipo === 'entrenadores' && entrada.horario !== undefined ? { horario: ordenarTurnos(entrada.horario) } : {}),
  });
  if (!esCuentaGestionada(cuerpo, tipo) || cuerpo.id !== id) return respuestaInvalida();
  return cuerpo;
}

export async function darDeBajaCuenta(tipo: TipoDeCuenta, id: number, senal: AbortSignal): Promise<void> {
  if (!esIdentificador(id)) throw new ErrorDeCuenta('Seleccioná una cuenta válida.');
  await pedir(tipo, `/${id}`, 'DELETE', senal, 204);
}
