/**
 * Fotos de progreso en almacenamiento permanente.
 *
 * El image picker devuelve archivos en la caché de la app, que Android puede
 * vaciar en cualquier momento (poco espacio, "Borrar caché"). Cada foto elegida
 * se copia a `documentos/fotos/` y en SQLite se guarda esa uri.
 */

import { Directory, EncodingType, File, Paths } from 'expo-file-system';
import { generateId } from '@/utils/helpers';

function dirFotos(): Directory {
  const dir = new Directory(Paths.document, 'fotos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function esUriEnCache(uri: string): boolean {
  return !!uri && uri.startsWith(Paths.cache.uri);
}

/** Copia la foto a la carpeta permanente y devuelve la nueva uri. */
export function guardarFotoPermanente(uri: string): string {
  const origen = new File(uri);
  const destino = new File(dirFotos(), `${generateId()}${origen.extension || '.jpg'}`);
  origen.copySync(destino);
  return destino.uri;
}

/** Nombre de archivo y contenido en base64, o null si la foto ya no existe. */
export function leerFotoBase64(uri: string): { nombre: string; base64: string } | null {
  if (!uri) return null;
  try {
    const file = new File(uri);
    if (!file.exists) return null;
    return { nombre: file.name, base64: file.base64Sync() };
  } catch {
    return null;
  }
}

/** Escribe una foto de un respaldo en la carpeta permanente y devuelve su uri. */
export function escribirFotoBase64(nombre: string, base64: string): string {
  // Solo el nombre: un respaldo editado no puede escribir fuera de la carpeta.
  const limpio = nombre.replace(/[^\w.-]/g, '_').replace(/^\.+/, '_');
  const file = new File(dirFotos(), limpio);
  file.create({ overwrite: true });
  file.write(base64, { encoding: EncodingType.Base64 });
  return file.uri;
}

/** Borra la carpeta de fotos completa (al limpiar todos los datos). */
export function borrarTodasLasFotos(): void {
  const dir = new Directory(Paths.document, 'fotos');
  if (dir.exists) dir.delete();
}

/**
 * Para fotos guardadas antes de este cambio: si la uri apunta a la caché y el
 * archivo sigue ahí, la copia y devuelve la uri nueva; si no, devuelve la original.
 */
export function rescatarFoto(uri: string): string {
  if (!esUriEnCache(uri)) return uri;
  try {
    if (!new File(uri).exists) return uri;
    return guardarFotoPermanente(uri);
  } catch {
    return uri;
  }
}
