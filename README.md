# IyCS-Proyecto3

## Requisitos

- Node.js 24 LTS y npm.
- Docker Desktop con el motor de Linux iniciado.

## Arranque local

1. Preparar las credenciales e iniciar MySQL siguiendo el [README del backend](backend/README.md#preparar-el-entorno).
2. Iniciar el [backend](backend/README.md#arrancar-el-backend).
3. En otra terminal, iniciar el [frontend](frontend/README.md).

Abrir `http://127.0.0.1:5173`.

Para detener la aplicación, presionar Ctrl+C en las terminales del frontend y del backend. Para detener MySQL, ejecutar en PowerShell desde la raíz del repositorio:

```powershell
docker compose stop
```
