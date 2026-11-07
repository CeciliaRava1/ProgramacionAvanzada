# Imagen de desarrollo del backend. Node 24 coincide con "engines" de package.json.
FROM node:24-slim

WORKDIR /app

# Las dependencias se instalan en la imagen: no dependen del sistema operativo del equipo.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "start:dev"]
