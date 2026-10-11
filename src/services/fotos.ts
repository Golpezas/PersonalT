/**
 * Fotos de progreso en almacenamiento permanente.
 *
 * El image picker devuelve archivos en la caché de la app, que Android puede
 * vaciar en cualquier momento (poco espacio, "Borrar caché"). Cada foto elegida
 * se copia a `documentos/fotos/` y en SQLite se guarda esa uri.
 */

import { Directory, File, Paths } from 'expo-file-system';
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
