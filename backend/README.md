# Backend

NestJS con TypeORM y MySQL. Se ejecuta con Docker; las instrucciones de instalación y uso están en el [README de la raíz](../README.md), para Windows y Ubuntu.

## Comandos útiles

Desde la raíz del repositorio:

| Acción | Comando |
|---|---|
| Ejecutar los tests | `docker compose run --rm backend npm test` |
| Volver a crear tablas, catálogo y administrador | `docker compose run --rm migrar` |
| Abrir una terminal dentro del contenedor | `docker compose exec backend sh` |

Comprobación del backend: <http://127.0.0.1:3000/health>.

## Variables de entorno

Se leen del archivo `.env` de la raíz, que `compose.yaml` pasa al contenedor. Ver `.env.example` en la raíz.
