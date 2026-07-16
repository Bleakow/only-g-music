/**
 * Repositorio (data-access) de subidas a Cloud Storage. Único punto de acceso a
 * Storage — la UI no llama a Firebase directo. El prefijo `uploads/{uid}/` está
 * FORZADO aquí (coincide con storage.rules); el caller no puede salirse de él.
 */
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { storage } from "@/lib/firebase";

export interface UploadedFile {
  url: string;
  name: string;
}

/**
 * Sube un Blob bajo `uploads/{uid}/` con el `name` que se le indique y devuelve
 * su URL + nombre. Punto único de subida: tanto `File` (que ES un Blob) como un
 * fragmento recortado (Blob sin nombre, p.ej. el recorte de una canción) pasan
 * por aquí. El `contentType` se toma del propio Blob cuando lo trae.
 */
export async function uploadUserBlob(
  uid: string,
  blob: Blob,
  name: string,
): Promise<UploadedFile> {
  const safeName = name.replace(/[^\w.\-]+/g, "_");
  const path = `uploads/${uid}/${Date.now()}-${safeName}`;
  const r = storageRef(storage, path);
  await uploadBytes(
    r,
    blob,
    blob.type ? { contentType: blob.type } : undefined,
  );
  return { url: await getDownloadURL(r), name };
}

/** Sube un archivo bajo `uploads/{uid}/` y devuelve su URL + nombre original. */
export function uploadUserFile(uid: string, file: File): Promise<UploadedFile> {
  return uploadUserBlob(uid, file, file.name);
}

// Sube el MÁSTER de un beat a una ruta PRIVADA (beats/masters/{uid}/...). Devuelve
// la RUTA (no una URL): el archivo NO debe ser públicamente descargable; se entrega
// por URL firmada desde el servidor tras la compra.
export async function uploadBeatMaster(
  uid: string,
  file: File,
): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `beats/masters/${uid}/${Date.now()}-${safe}`;
  const r = storageRef(storage, path);
  await uploadBytes(
    r,
    file,
    file.type ? { contentType: file.type } : undefined,
  );
  return path; // NO getDownloadURL
}
