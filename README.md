# GymHelper (IyCS-Proyecto3)

Todo el proyecto (MySQL, backend y frontend) corre en Docker. No hace falta instalar Node.js ni MySQL en tu equipo. Los comandos de `docker compose` son los mismos en Windows y en Ubuntu: solo cambia cómo se copia el archivo `.env` y cómo se genera un valor aleatorio.

## Requisitos

| | Windows | Ubuntu |
|---|---|---|
| Docker | Docker Desktop (con WSL2), **iniciado** | Docker Engine y el plugin Compose v2 (`docker compose version`) |
| Terminal | PowerShell | bash |
| Permisos | — | Tu usuario debe estar en el grupo `docker` (`sudo usermod -aG docker $USER`, y volver a iniciar sesión) |
| Git | Git para Windows | `sudo apt install git` |

## Primera instalación

1. Clonar el repositorio y entrar en la carpeta.
2. Copiar el archivo de configuración:

   | Windows (PowerShell) | Ubuntu (bash) |
   |---|---|
   | `Copy-Item .env.example .env` | `cp .env.example .env` |

3. Abrir `.env` y completar `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` y `SECRETO_DE_SESION` con **tres valores distintos**. Para generar cada valor, en cualquiera de los dos sistemas:

   ```
   docker run --rm node:24-slim node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   En Ubuntu también sirve `openssl rand -hex 32`.

## Uso diario

Desde la raíz del repositorio, en ambos sistemas:

| Acción | Comando |
|---|---|
| Iniciar todo (la primera vez descarga e instala, puede tardar unos minutos) | `docker compose up --build` |
| Iniciar en segundo plano | `docker compose up -d --build --wait` |
| Ver los registros | `docker compose logs -f backend` |
| Detener (conserva los datos) | `docker compose stop` |
| Detener y quitar contenedores (conserva los datos) | `docker compose down` |
| **Borrar también la base de datos** | `docker compose down -v` |

Cuando termine de iniciar:

- Aplicación: <http://127.0.0.1:5173>
- Backend: <http://127.0.0.1:3000/health>
- Acceso de prueba: **admin@example.test / Admin1234** (solo desarrollo local). Si ya existe un administrador, se conservan sus credenciales.

Usá siempre `127.0.0.1` y no `localhost`: el backend solo acepta ese origen.

## Tests

Con Docker iniciado:

```
docker compose run --rm backend npm test
docker compose run --rm frontend npm test
```

Los tests del backend usan la base MySQL del compose.

## Qué hace cada servicio

| Servicio | Función |
|---|---|
| `mysql` | Base de datos MySQL 8.4. Datos en el volumen `mysql_data`. |
| `migrar` | Crea las tablas, importa el catálogo y crea el administrador inicial. Se ejecuta al iniciar y termina. |
| `backend` | NestJS en el puerto 3000, con recarga automática al editar `backend/src`. |
| `frontend` | React con Vite en el puerto 5173, con recarga automática al editar `frontend/src`. |

Los puertos se publican solo en `127.0.0.1`, así que no quedan expuestos a la red.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `failed to connect to the docker API` o `cannot connect to the Docker daemon` | Windows: iniciar Docker Desktop. Ubuntu: `sudo systemctl start docker`. |
| `permission denied ... /var/run/docker.sock` (Ubuntu) | Falta el grupo `docker`. Ver Requisitos. |
| `Falta MYSQL_PASSWORD en el archivo .env` | No se creó o no se completó `.env`. |
| `port is already allocated` | Hay otro programa usando 3000, 3306 o 5173. Cerrarlo o detener el contenedor anterior con `docker compose down`. |
| Los cambios en el código no recargan (Windows) | El compose ya usa polling para esto. Si se editó un archivo de configuración (`package.json`, `tsconfig.json`, `vite.config.ts`), ejecutar `docker compose up --build`. |
| Se agregó una dependencia con `npm` | Ejecutar `docker compose up --build` para reinstalarla en la imagen. |
| `bad interpreter` o errores raros en archivos con finales de línea CRLF | El repositorio fuerza LF con `.gitattributes`. Si clonaste antes de que existiera, volvé a clonar. |

## Flujo de ramas

Se usa Gitflow: la rama `develop` es la base y cada tarea sale de ahí en una rama `feature/<tema>`. Los cambios vuelven a `develop` por revisión del equipo.
