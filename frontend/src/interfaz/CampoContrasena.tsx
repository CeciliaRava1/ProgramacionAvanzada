import { useState } from 'react';
import { Icono } from './Icono.tsx';

/** Campo de contraseña con botón para mostrarla u ocultarla; se deshabilita junto con su fieldset. */
export function CampoContrasena({ id, nombre, valor, alCambiar, autocompletado, invalido, descritoPor }: {
  id: string;
  nombre: string;
  valor: string;
  alCambiar: (valor: string) => void;
  autocompletado: 'current-password' | 'new-password';
  invalido?: boolean;
  descritoPor?: string;
}) {
  const [visible, setVisible] = useState(false);

  return <div className="campo-contrasena">
    <input
      className="field"
      id={id}
      name={nombre}
      type={visible ? 'text' : 'password'}
      autoComplete={autocompletado}
      required
      value={valor}
      onChange={(evento) => alCambiar(evento.target.value)}
      aria-invalid={invalido}
      aria-describedby={descritoPor}
    />
    <button
      type="button"
      className="boton-ver-contrasena"
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={visible}
      aria-controls={id}
      onClick={() => setVisible((actual) => !actual)}
    >
      <Icono nombre={visible ? 'ojo-tachado' : 'ojo'} />
    </button>
  </div>;
}
