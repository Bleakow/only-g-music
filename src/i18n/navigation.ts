import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Primitivos de navegación CONSCIENTES del idioma. Úsalos en lugar de los de
 * `next/link` / `next/navigation`: el `Link` añade el prefijo de locale solo y
 * `usePathname` lo devuelve SIN prefijo (para detectar el tab activo, etc.).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
