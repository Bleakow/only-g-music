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

/** Sube un archivo bajo `uploads/{uid}/` y devuelve su URL + nombre original. */
export async function uploadUserFile(
  uid: string,
  file: File,
): Promise<UploadedFile> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `uploads/${uid}/${Date.now()}-${safeName}`;
  const r = storageRef(storage, path);
  await uploadBytes(r, file);
  return { url: await getDownloadURL(r), name: file.name };
}
