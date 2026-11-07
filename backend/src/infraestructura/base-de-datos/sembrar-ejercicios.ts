import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { BaseDeDatosModule } from './base-de-datos.module.js';
import { EsquemaDeEjercicio } from '../../planes/infraestructura/repositorio-de-ejercicios-typeorm.js';
import type { Ejercicio } from '../../planes/dominio/ejercicio.js';

const CAMPOS = ['identificador', 'nombre', 'parteDelCuerpo', 'equipamiento', 'musculoObjetivo', 'instrucciones'] as const;
const LIMITES: Record<(typeof CAMPOS)[number], number> = {
  identificador: 150, nombre: 300, parteDelCuerpo: 100, equipamiento: 100, musculoObjetivo: 100, instrucciones: 65535,
};

/** Valida todo el archivo antes de abrir una transacción; el identificador conserva la identidad al volver a sembrar. */
export function validarCatalogoDeEjercicios(valor: unknown): Omit<Ejercicio, 'id'>[] {
  if (!Array.isArray(valor) || valor.length === 0) throw new Error('El catálogo debe contener ejercicios.');
  const identificadores = new Set<string>();
  for (const fila of valor) {
    if (!fila || typeof fila !== 'object' || Array.isArray(fila) || Object.keys(fila).length !== CAMPOS.length ||
      CAMPOS.some((campo) => typeof fila[campo] !== 'string' || !fila[campo].trim())) throw new Error('El catálogo contiene datos no válidos.');
    for (const campo of CAMPOS) {
      const tamano = campo === 'instrucciones' ? Buffer.byteLength(fila[campo], 'utf8') : [...fila[campo]].length;
      if (tamano > LIMITES[campo]) throw new Error('El catálogo supera los límites de almacenamiento.');
    }
    if (identificadores.has(fila.identificador)) throw new Error('El catálogo contiene identificadores repetidos.');
    identificadores.add(fila.identificador);
  }
  return valor;
}

async function sembrar() {
  const ejercicios = validarCatalogoDeEjercicios(JSON.parse(await readFile(new URL('../../../datos/ejercicios.json', import.meta.url), 'utf8')));
  const aplicacion = await NestFactory.createApplicationContext(BaseDeDatosModule, { logger: ['error'], abortOnError: false });
  try {
    await aplicacion.get(DataSource).transaction(async (gestor) => {
      for (let desde = 0; desde < ejercicios.length; desde += 100) {
        await gestor.getRepository(EsquemaDeEjercicio).upsert(ejercicios.slice(desde, desde + 100), ['identificador']);
      }
    });
    console.log(`Ejercicios sembrados o actualizados: ${ejercicios.length}.`);
  } finally { await aplicacion.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  sembrar().catch(() => { console.error('No se pudo sembrar el catálogo. Revisá MySQL, las migraciones y el archivo datos/ejercicios.json.'); process.exitCode = 1; });
}
