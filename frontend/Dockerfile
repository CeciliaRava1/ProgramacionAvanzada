# Imagen de desarrollo del frontend. Node 24 coincide con "engines" de package.json.
FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
