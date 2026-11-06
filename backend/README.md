# Backend

## Primera instalación

En PowerShell, desde la raíz del repositorio:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Completar `MYSQL_ROOT_PASSWORD` en `.env` y `MYSQL_PASSWORD` y `SESSION_SECRET` en `backend/.env` con valores distintos. Para generar cada valor, usar en esa misma terminal:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Arranque

En PowerShell, desde la raíz del repositorio:

```powershell
docker compose up -d --wait
cd .\backend
npm.cmd ci
npm.cmd run db:setup
npm.cmd run start:dev
```

`db:setup` prepara tablas, catálogo y administrador. `npm.cmd ci` y `db:setup` solo hacen falta al preparar la instalación.

Acceso de prueba: **admin@example.test / Admin1234**, solo para desarrollo local. Si ya existe un administrador, conserva sus credenciales.

Comprobación: `http://127.0.0.1:3000/health`. Detener con Ctrl+C.
