# Levantar el frontend

Requiere Node.js 24 LTS. Primero iniciar MySQL y el backend siguiendo [sus instrucciones](../backend/README.md).

En otra terminal PowerShell, desde la raíz del repositorio:

```powershell
cd .\frontend
npm.cmd ci
npm.cmd run dev
```

`npm.cmd ci` hace falta en la primera instalación y cuando cambien las dependencias.

Abrir `http://127.0.0.1:5173`; usar esa dirección para que coincida con el origen permitido por el backend. Detener el frontend con Ctrl+C en su terminal.
