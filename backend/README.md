# Levantar el backend

Requiere Node.js 24 LTS y Docker Desktop con el motor de Linux iniciado.

## Preparar el entorno

Solo en la primera instalación, en PowerShell desde la raíz del repositorio:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
```

Si los archivos `.env` ya existen, conservarlos.

Completar `MYSQL_ROOT_PASSWORD` en `.env` y `MYSQL_PASSWORD` y `SESSION_SECRET` en `backend/.env` con tres valores distintos. Para generar cada valor, ejecutar por separado en esa misma terminal:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Configurar también `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` en `backend/.env` con el acceso elegido para el administrador. La contraseña debe tener entre 8 y 128 caracteres, sin espacios.

Conservar los demás valores de los ejemplos y no subir los archivos `.env` a Git.

## Arrancar MySQL

En PowerShell desde la raíz del repositorio:

```powershell
docker compose up -d --wait
```

## Arrancar el backend

En otra terminal PowerShell, desde la raíz del repositorio:

```powershell
cd .\backend
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run db:import-exercises
npm.cmd run db:seed
npm.cmd run start:dev
```

`npm.cmd ci` hace falta en la primera instalación y cuando cambien las dependencias. Las migraciones y la importación preparan la base; pueden repetirse sin duplicar los datos.

`db:seed` crea el primer administrador con las credenciales de `backend/.env`. Si ya existe uno, conserva su cuenta y contraseña; repetir el comando no duplica cuentas. Si el correo pertenece a otra cuenta, se debe elegir otro. Al abrir el frontend, usar esas credenciales para iniciar sesión.

Abrir `http://127.0.0.1:3000/health`: debe responder `{"status":"ok"}`. Detener el backend con Ctrl+C en su terminal.
