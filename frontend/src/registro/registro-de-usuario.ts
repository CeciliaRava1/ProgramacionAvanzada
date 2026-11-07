import { esListaDeTurnosValida, ordenarTurnos, type Turno } from '../entrenadores/turnos.ts';

export type TipoDeCuentaARegistrar = 'alumno' | 'entrenador';

/** Datos de una cuenta que el administrador puede crear o modificar (sin contraseña). */
export interface DatosDeCuentaEntrada {
  nombre: string;
  apellido: string;
  correo: string;
  horario?: Turno[];
}

export interface EntradaDeRegistro extends DatosDeCuentaEntrada {
  contrasena: string;
}

export type ErroresDeDatosDeCuenta = Partial<Record<keyof DatosDeCuentaEntrada, string>>;
export type ErroresDeRegistro = Partial<Record<keyof EntradaDeRegistro, string>>;

export class ErrorDeRegistro extends Error {
  readonly erroresDeCampo: ErroresDeRegistro;

  constructor(mensaje: string, erroresDeCampo: ErroresDeRegistro = {}) {
    super(mensaje);
    this.erroresDeCampo = erroresDeCampo;
  }
}

/** Valida nombre, apellido, correo y horario; sirve para crear y para modificar. */
export function obtenerErroresDeDatosDeCuenta(entrada: DatosDeCuentaEntrada): ErroresDeDatosDeCuenta {
  const errores: ErroresDeDatosDeCuenta = {};
  for (const campo of ['nombre', 'apellido'] as const) {
    const longitud = [...entrada[campo].trim()].length;
    if (longitud < 1 || longitud > 100) errores[campo] = 'Ingresá entre 1 y 100 caracteres.';
  }
  const correo = entrada.correo.trim();
  if ([...correo].length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(correo) ||
      /[\u0000-\u001f\u007f]/u.test(correo)) {
    errores.correo = 'Ingresá un correo electrónico válido de hasta 254 caracteres.';
  }
  if (entrada.horario !== undefined && !esListaDeTurnosValida(entrada.horario)) {
    errores.horario = 'Elegí turnos válidos: mañana, tarde o noche.';
  }
  return errores;
}

/** Da ayuda inmediata en el formulario; el backend vuelve a validar la entrada. */
export function obtenerErroresDeRegistro(entrada: EntradaDeRegistro): ErroresDeRegistro {
  const errores: ErroresDeRegistro = obtenerErroresDeDatosDeCuenta(entrada);
  const longitudDeContrasena = [...entrada.contrasena].length;
  if (longitudDeContrasena > 128) {
    errores.contrasena = 'La contraseña es demasiado larga.';
  } else if (longitudDeContrasena < 8 || /\s/u.test(entrada.contrasena)) {
    errores.contrasena = 'Usá al menos 8 caracteres, sin espacios.';
  }
  return errores;
}

/** Envía los datos permitidos para cada alta (solo el administrador puede crear cuentas) y valida la respuesta. */
export async function registrarUsuario(
  entrada: EntradaDeRegistro, senal: AbortSignal, tipoDeCuenta: TipoDeCuentaARegistrar = 'alumno',
): Promise<void> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`http://127.0.0.1:3000/usuarios/${tipoDeCuenta === 'entrenador' ? 'entrenadores' : 'alumnos'}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: entrada.nombre,
        apellido: entrada.apellido,
        correo: entrada.correo,
        contrasena: entrada.contrasena,
        ...(tipoDeCuenta === 'entrenador' && entrada.horario !== undefined ? { horario: ordenarTurnos(entrada.horario) } : {}),
      }),
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new ErrorDeRegistro('No se pudo confirmar el registro. Revisá la conexión antes de volver a intentarlo.');
  }

  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const erroresDeCampo: ErroresDeRegistro = {};
    // Solo se muestran mensajes conocidos: una respuesta inesperada no expone detalles internos.
    if (respuesta.status === 409) {
      erroresDeCampo.correo = 'Ya existe una cuenta con ese correo electrónico.';
    } else if (respuesta.status === 400 && typeof cuerpo === 'object' && cuerpo !== null &&
               'erroresDeCampo' in cuerpo && typeof cuerpo.erroresDeCampo === 'object' && cuerpo.erroresDeCampo !== null) {
      for (const campo of ['nombre', 'apellido', 'correo', 'contrasena', 'horario'] as const) {
        const error = (cuerpo.erroresDeCampo as Record<string, unknown>)[campo];
        if (typeof error === 'string') erroresDeCampo[campo] = error;
      }
    }
    throw new ErrorDeRegistro(
      respuesta.status === 409 ? 'Ya existe una cuenta con ese correo electrónico.' :
        respuesta.status === 400 ? 'Revisá los datos ingresados.' :
          respuesta.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
            respuesta.status === 403 ? 'No tenés permiso para crear cuentas.' : 'No se pudo registrar la cuenta. Intentá nuevamente.',
      erroresDeCampo,
    );
  }

  if (respuesta.status !== 201 || typeof cuerpo !== 'object' || cuerpo === null ||
      !('id' in cuerpo) || !Number.isSafeInteger(cuerpo.id) || Number(cuerpo.id) < 1 ||
      !('nombre' in cuerpo) || typeof cuerpo.nombre !== 'string' ||
      !('apellido' in cuerpo) || typeof cuerpo.apellido !== 'string' ||
      !('correo' in cuerpo) || typeof cuerpo.correo !== 'string' ||
      !('rol' in cuerpo) || cuerpo.rol !== tipoDeCuenta || 'contrasena' in cuerpo || 'hashDeContrasena' in cuerpo) {
    throw new ErrorDeRegistro('No se pudo confirmar el registro: la respuesta del servidor no es válida.');
  }
}
