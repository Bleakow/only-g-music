"use client";

import { useEffect } from "react";
import { logError } from "../lib/error-log";

/**
 * Captura errores que ocurren FUERA de React (errores globales del navegador y
 * promesas rechazadas sin manejar) y los manda al logger. Los errores de render
 * de React los cubre el `error.tsx` de la ruta. No pinta nada.
 */
export function GlobalErrorListener() {
  useEffect(() => {
    const onError = (e: ErrorEvent) =>
      logError(e.error ?? e.message, "window.onerror");
    const onRejection = (e: PromiseRejectionEvent) =>
      logError(e.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
