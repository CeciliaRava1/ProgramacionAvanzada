import { ETIQUETAS_DE_ROL, ROLES, type RolDeUsuario } from './sesion.ts';

/** Elige con qué cuenta se entra: un mismo correo puede tener una cuenta por rol. */
export function SelectorDeRol({ prefijoDeId, valor, alCambiar, leyenda = 'Ingresar como' }: {
  prefijoDeId: string;
  valor: RolDeUsuario;
  alCambiar: (rol: RolDeUsuario) => void;
  leyenda?: string;
}) {
  return <fieldset className="grupo-de-casillas">
    <legend>{leyenda}</legend>
    <div className="opciones-de-casillas">
      {ROLES.map((rol) => <label key={rol} className="opcion-de-casilla" htmlFor={`${prefijoDeId}-${rol}`}>
        <input
          id={`${prefijoDeId}-${rol}`}
          type="radio"
          name={`${prefijoDeId}-rol`}
          value={rol}
          checked={valor === rol}
          onChange={() => alCambiar(rol)}
        />
        {ETIQUETAS_DE_ROL[rol]}
      </label>)}
    </div>
  </fieldset>;
}
