# GymHelper (IyCS-Proyecto3)

Sistema de gestión de gimnasio y seguimiento de entrenamientos, pensado para usarse desde el celular. Tiene tres tipos de cuenta:

| Rol | Qué hace |
|---|---|
| **Administrador** | Crea, consulta, modifica y da de baja alumnos y entrenadores. |
| **Entrenador** | Atiende solicitudes de alumnos, arma planes con rutinas y ejercicios del catálogo. |
| **Alumno** | Solicita un entrenador, ve su plan y sus rutinas. |

Todo el proyecto (MySQL, backend, frontend y correo de desarrollo) corre en Docker. **No hace falta instalar Node.js ni MySQL** en tu equipo. Los comandos de `docker compose` son los mismos en Windows y en Ubuntu: solo cambia cómo se copia el archivo `.env`.

## Índice

1. [Requisitos](#requisitos)
2. [Primera instalación](#primera-instalación)
3. [Probar la aplicación](#probar-la-aplicación)
4. [Reglas del dominio](#reglas-del-dominio)
5. [Uso diario](#uso-diario)
6. [Tests](#tests)
7. [Servicios, puertos y variables](#servicios-puertos-y-variables)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Actualizar un entorno ya instalado](#actualizar-un-entorno-ya-instalado)
10. [Problemas frecuentes](#problemas-frecuentes)
11. [Flujo de ramas](#flujo-de-ramas)

## Requisitos

| | Windows | Ubuntu |
|---|---|---|
| Docker | Docker Desktop (con WSL2), **iniciado** | Docker Engine y el plugin Compose v2 (`docker compose version` debe responder) |
| Terminal | PowerShell | bash |
| Permisos | — | Tu usuario debe estar en el grupo `docker`: `sudo usermod -aG docker $USER` y volver a iniciar sesión |
| Git | Git para Windows | `sudo apt install git` |
| Espacio | ~3 GB libres para las imágenes | ~3 GB libres para las imágenes |

Antes de empezar, comprobá que Docker responde:

```
docker version
docker compose version
```

Los puertos **3000, 3306, 5173 y 8025** de tu equipo tienen que estar libres (si usás otros proyectos con Docker, detenelos antes).

## Primera instalación

1. Clonar el repositorio y entrar en la carpeta:

   ```
   git clone https://github.com/joaquinperez04/IyCS-Proyecto3.git
   cd IyCS-Proyecto3
   ```

   Si estás revisando una rama de trabajo, cambiate a ella con `git switch <rama>` antes del paso 4.

2. Copiar el archivo de configuración:

   | Windows (PowerShell) | Ubuntu (bash) |
   |---|---|
   | `Copy-Item .env.example .env` | `cp .env.example .env` |

3. Abrir `.env` con un editor y completar **tres valores distintos**: `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` y `SECRETO_DE_SESION`. Para generar cada uno, en cualquiera de los dos sistemas (ejecutarlo tres veces):

   ```
   docker run --rm node:24-slim node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   En Ubuntu también sirve `openssl rand -hex 32`. No hay que tocar nada más del archivo para desarrollo. El archivo `.env` **no se sube a Git**.

4. Iniciar todo:

   ```
   docker compose up --build
   ```

   La primera vez descarga las imágenes e instala las dependencias: puede tardar varios minutos. Para dejarlo en segundo plano y esperar a que todo esté sano:

   ```
   docker compose up -d --build --wait
   ```

   Al iniciar, el servicio `migrar` crea las tablas, carga el **catálogo de 151 ejercicios en español** y crea el administrador inicial. No hay que ejecutar nada más.

5. Comprobar:

   | Qué | Dirección |
   |---|---|
   | Aplicación | <http://127.0.0.1:5173> |
   | Backend (debe responder `ok`) | <http://127.0.0.1:3000/health> |
   | Correos de desarrollo (Mailpit) | <http://127.0.0.1:8025> |

   Usá siempre `127.0.0.1` y no `localhost`: el backend solo acepta ese origen.

## Probar la aplicación

Cuenta de administrador de prueba (solo desarrollo local): **admin@example.test / Admin1234**. En la pantalla de inicio se escribe correo y contraseña; el sistema entra con el tipo de cuenta que corresponde.

Recorrido sugerido para ver todo el flujo:

1. Entrar como **administrador**. En *Entrenadores* y *Alumnos*, usar **Crear entrenador** y **Crear alumno**. Probar también **Editar** y **Dar de baja**. Cada acción confirma con una alerta.
2. Cerrar sesión y entrar como el **alumno** creado. En *Entrenadores*, enviar una solicitud al entrenador.
3. Cerrar sesión y entrar como el **entrenador**. En las solicitudes, **Aceptar** o **Rechazar**.
4. Como entrenador, abrir al alumno, **crear un plan**, agregarle una **rutina** y sumarle ejercicios del **catálogo** (hay buscador y filtros por parte del cuerpo y equipamiento).
5. Volver a entrar como alumno y ver el plan y la rutina.
6. **Recuperar la contraseña:** en el inicio de sesión, "¿Olvidaste tu contraseña?", escribir el correo y abrir <http://127.0.0.1:8025>. El correo trae un enlace que sirve **una sola vez** y vence en **1 hora**. No se envía nada fuera de tu equipo.

## Reglas del dominio

Aclaraciones para no confundir un comportamiento esperado con un error:

- **Las cuentas las crea el administrador.** No hay registro público: ni alumnos ni entrenadores se registran solos.
- **Un correo, una cuenta.** Un mismo correo no puede ser alumno y entrenador a la vez; crear o editar con un correo repetido responde que ya existe.
- **Contraseña:** al menos 8 caracteres y sin espacios. El botón del "ojito" la muestra u oculta.
- **Un alumno tiene un solo entrenador.** El alumno envía una solicitud; el entrenador la **acepta o rechaza**. El alumno puede cancelar su solicitud pendiente y finalizar su vinculación. Cuando el entrenador acepta, el alumno queda vinculado y se cancelan sus otras solicitudes pendientes.
- **El entrenador solo ve a sus alumnos vinculados**, y solo ellos ven los planes que él les arma.
- **Horario del entrenador:** se elige entre mañana, tarde y noche (puede ser más de uno) y es opcional.
- **Baja lógica:** dar de baja no borra datos. La cuenta no puede iniciar sesión, se cierran sus sesiones, se finalizan sus vinculaciones y se cancelan sus solicitudes pendientes. Los datos y entrenamientos se conservan, y las cuentas dadas de baja se ven en el listado del administrador como "Dada de baja".
- **Estructura de entrenamiento:** un alumno tiene un **plan**; el plan tiene **rutinas** (los días de entrenamiento); cada rutina tiene **ejercicios** tomados del catálogo, con series, repeticiones y, opcionalmente, peso, descanso y RIR. No existe el nivel "programa".
- **El catálogo es de solo lectura** y viene de `backend/datos/ejercicios.json`. Para agregar ejercicios, se edita ese archivo y se ejecuta `docker compose run --rm migrar` (es idempotente: actualiza por `identificador`, sin duplicar).
- **Inicio de sesión:** 5 intentos por minuto; después responde que hay demasiados intentos y hay que esperar un minuto. Es una protección, no un error.
- **Recuperar contraseña:** la pantalla siempre responde lo mismo, exista o no el correo, para no revelar qué cuentas existen. Si el correo pertenece a una cuenta dada de baja, no se envía nada. Un pedido nuevo invalida los enlaces anteriores y al cambiar la contraseña se cierran las sesiones de esa cuenta.

## Uso diario

Desde la raíz del repositorio, en ambos sistemas:

| Acción | Comando |
|---|---|
| Iniciar todo | `docker compose up --build` |
| Iniciar en segundo plano | `docker compose up -d --build --wait` |
| Ver los registros | `docker compose logs -f backend` |
| Ver el estado de los servicios | `docker compose ps` |
| Detener (conserva los datos) | `docker compose stop` |
| Detener y quitar contenedores (conserva los datos) | `docker compose down` |
| **Borrar también la base de datos** (deja solo el admin y el catálogo) | `docker compose down -v` |
| Volver a crear tablas, catálogo y administrador | `docker compose run --rm migrar` |
| Abrir una consola de MySQL | `docker compose exec mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE"'` |

Editar el código en `backend/src` o `frontend/src` recarga solo el servicio correspondiente. Si cambia un archivo de configuración (`package.json`, `tsconfig.json`, `vite.config.ts`) o se agrega una dependencia con `npm`, ejecutar `docker compose up --build`.

## Tests

Con Docker iniciado (los del backend usan la base MySQL del compose):

```
docker compose run --rm backend npm test
docker compose run --rm frontend npm test
docker compose run --rm frontend npm run build
```

El último comando comprueba los tipos y compila el frontend.

## Servicios, puertos y variables

| Servicio | Función | Puerto |
|---|---|---|
| `mysql` | MySQL 8.4. Datos en el volumen `mysql_data`. | 3306 |
| `mailpit` | Bandeja de correo de desarrollo: recibe los correos del backend por SMTP interno (1025) y los muestra en la web. | 8025 |
| `migrar` | Crea las tablas, siembra el catálogo (`backend/datos/ejercicios.json`) y el administrador inicial. Se ejecuta al iniciar y termina. | — |
| `backend` | NestJS, con recarga automática. | 3000 |
| `frontend` | React con Vite, con recarga automática. | 5173 |

Los puertos se publican solo en `127.0.0.1`: no quedan expuestos a la red.

Variables del archivo `.env`:

| Variable | Para qué sirve | Valor |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | Contraseña administrativa de MySQL | **Completar** |
| `MYSQL_DATABASE`, `MYSQL_USER` | Base y usuario de la aplicación | `gymhelper`, `gymhelper_app` |
| `MYSQL_PASSWORD` | Contraseña del usuario de la aplicación (distinta de la anterior) | **Completar** |
| `SECRETO_DE_SESION` | Firma las sesiones (32 caracteres o más; conservarlo entre reinicios) | **Completar** |
| `ADMIN_INICIAL_CORREO`, `ADMIN_INICIAL_CONTRASENA` | Administrador de prueba; si ya existe uno, no se modifica | `admin@example.test`, `Admin1234` |
| `ORIGEN_DEL_FRONTEND` | Origen autorizado por el backend; también es la base de los enlaces de recuperación | `http://127.0.0.1:5173` |
| `CORREO_REMITENTE` | Remitente de los correos (opcional) | ya tiene un valor por defecto |

## Estructura del proyecto

```
compose.yaml              Servicios de Docker
.env.example              Plantilla de configuración
backend/                  NestJS + TypeORM + MySQL
  datos/ejercicios.json   Catálogo de ejercicios en español (seed)
  src/usuarios/           Cuentas, sesiones, solicitudes, recuperación de contraseña
  src/planes/             Planes, rutinas y ejercicios
  src/infraestructura/    Conexión, migraciones y semillas
  test/                   Tests de integración
frontend/                 React + Vite + Tailwind
  src/autenticacion/      Inicio de sesión y recuperación
  src/administracion/     Gestión de cuentas del administrador
  src/entrenadores/       Panel del entrenador y solicitudes
  src/planes/             Planes, rutinas y catálogo
  src/interfaz/           Componentes comunes
```

Todo el código y la base de datos están en español.

## Actualizar un entorno ya instalado

Cuando una rama cambia el esquema de la base (por ejemplo, al pasar todo a español, quitar los programas o reescribir migraciones), hay que recrearla. **Esto borra los datos de desarrollo locales**:

```
git pull
docker compose down -v
docker compose up --build
```

Si tu `.env` es anterior a estos cambios y aparecen errores por variables, volvé a copiarlo desde `.env.example` y completá los tres valores: los nombres cambiaron a español (`SECRETO_DE_SESION`, `ADMIN_INICIAL_CORREO`, etc.).

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `failed to connect to the docker API` o `cannot connect to the Docker daemon` | Windows: iniciar Docker Desktop. Ubuntu: `sudo systemctl start docker`. |
| `permission denied ... /var/run/docker.sock` (Ubuntu) | Falta el grupo `docker`. Ver Requisitos. |
| `Falta MYSQL_PASSWORD en el archivo .env` (o `SECRETO_DE_SESION`, `MYSQL_ROOT_PASSWORD`) | No se creó o no se completó `.env`. |
| `port is already allocated` | Hay otro programa o proyecto de Docker usando 3000, 3306, 5173 u 8025. Detenerlo, o ejecutar `docker compose down` si es de este proyecto. |
| La pantalla muestra "No se pudo consultar tu sesión" | El backend no inició. Ver `docker compose logs backend` y `docker compose ps`. |
| El inicio de sesión o las pantallas fallan desde `localhost` | Usar `http://127.0.0.1:5173`: el backend solo acepta ese origen. |
| "Demasiados intentos" al iniciar sesión | Límite de 5 intentos por minuto. Esperar un minuto. |
| "Tu sesión venció" tras actualizar | Cerrar sesión y volver a entrar; cambió el nombre de la cookie de sesión. |
| `Table ... doesn't exist` o errores de columnas después de un `git pull` | Cambió el esquema: `docker compose down -v` y `docker compose up --build`. |
| El enlace de recuperación dice que no es válido | Ya se usó, venció (1 hora) o se pidió uno más nuevo. Pedir otro. |
| No llega el correo de recuperación | En desarrollo no sale de tu equipo: está en <http://127.0.0.1:8025>. Si el correo es de una cuenta dada de baja, no se envía. |
| "Ya existe una cuenta con ese correo" | Cada correo pertenece a una sola cuenta, activa o dada de baja. Usar otro correo. |
| El catálogo de ejercicios aparece vacío | Falló la siembra al iniciar. Ver `docker compose logs migrar` y ejecutar `docker compose run --rm migrar`. |
| El servicio `migrar` termina con error | Casi siempre es la base: `docker compose logs migrar mysql`. Si la base es vieja, `docker compose down -v`. |
| Los cambios en el código no recargan (Windows) | El compose ya usa polling. Si se editó un archivo de configuración, ejecutar `docker compose up --build`. |
| `bad interpreter` o errores raros por finales de línea CRLF | El repositorio fuerza LF con `.gitattributes`. Si clonaste antes de que existiera, volvé a clonar. |
| Ubuntu con Docker instalado por `snap` | Puede fallar al montar carpetas. Instalar Docker Engine desde el repositorio oficial de Docker. |

## Flujo de ramas

Se usa Gitflow: la rama `develop` es la base y cada tarea sale de ahí en una rama `feature/<tema>`. Los cambios vuelven a `develop` por revisión del equipo; no se trabaja directamente en `develop` ni en `main`. Los mensajes de commit van en español, en imperativo y con un cambio por commit.
