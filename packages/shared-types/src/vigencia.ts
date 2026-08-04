/**
 * VIGENCIAS acumulables (pases, membresías, premium del perfil).
 *
 * La regla del negocio es una sola: comprar cuando todavía te queda tiempo SUMA,
 * no reemplaza. Si compras el Golden con doce días de Lite por delante, esos doce
 * días siguen siendo tuyos. Lo contrario —calcular desde hoy— castiga justo a
 * quien renueva antes de que se le acabe, que es el comportamiento que queremos
 * premiar.
 *
 * Módulo PURO: sin UI ni Firebase, para poder testearlo y compartirlo entre el
 * servidor (que concede) y el cliente (que lo muestra).
 */

/**
 * Nueva fecha de caducidad al conceder `meses` de vigencia.
 *
 * Si lo que había sigue vigente, se parte de AHÍ (acumula); si ya caducó —o no
 * había nada—, se parte de ahora. Nunca resta: un pase caducado no descuenta.
 */
export function extenderVigencia(
  expiresAtActual: number | null | undefined,
  meses: number,
  now: number,
): number {
  const base =
    typeof expiresAtActual === "number" && expiresAtActual > now
      ? expiresAtActual
      : now;
  const fecha = new Date(base);
  fecha.setMonth(fecha.getMonth() + meses);
  return fecha.getTime();
}

/** Lo que queda de una vigencia, ya partido para mostrarlo. */
export interface Restante {
  /** Meses completos que faltan. */
  meses: number;
  /** Días sueltos además de esos meses. */
  dias: number;
  /** Total en días, por si se quiere pintar solo eso. */
  totalDias: number;
  /** ¿Sigue vigente? */
  activo: boolean;
}

/** Milisegundos de un día. */
const DIA = 86_400_000;

/**
 * Cuánto queda, en meses y días, para pintar "1 mes 12 días".
 *
 * Los meses se cuentan de CALENDARIO (avanzando mes a mes desde hoy) y no
 * dividiendo entre 30: si no, a alguien que compró el 31 de enero le saldrían
 * números que no cuadran con la fecha que ve en su recibo.
 */
export function restanteDe(
  expiresAt: number | null | undefined,
  now: number,
): Restante {
  if (typeof expiresAt !== "number" || expiresAt <= now) {
    return { meses: 0, dias: 0, totalDias: 0, activo: false };
  }
  const totalDias = Math.ceil((expiresAt - now) / DIA);

  let meses = 0;
  const cursor = new Date(now);
  for (;;) {
    const siguiente = new Date(cursor);
    siguiente.setMonth(siguiente.getMonth() + 1);
    if (siguiente.getTime() > expiresAt) break;
    cursor.setTime(siguiente.getTime());
    meses++;
  }
  const dias = Math.ceil((expiresAt - cursor.getTime()) / DIA);
  return { meses, dias, totalDias, activo: true };
}
