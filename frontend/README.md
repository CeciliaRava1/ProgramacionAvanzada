# Frontend

React con Vite. Se ejecuta con Docker; las instrucciones de instalación y uso están en el [README de la raíz](../README.md), para Windows y Ubuntu.

Con todo iniciado, abrir <http://127.0.0.1:5173>.

## Comandos útiles

Desde la raíz del repositorio:

| Acción | Comando |
|---|---|
| Ejecutar los tests | `docker compose run --rm frontend npm test` |
| Comprobar tipos y compilar | `docker compose run --rm frontend npm run build` |
| Abrir una terminal dentro del contenedor | `docker compose exec frontend sh` |
