"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { ConversationView } from "@/features/conversations/components/ConversationView";
import { sendConversationMessage } from "@/features/conversations/lib/conversations-repo";
import { valeEstado, type ValeId } from "@only-g/shared-types/pase";
import { reclamarVale } from "../lib/pases-repo";

/**
 * Un VALE del pase (producción o video) y su hilo con el estudio.
 *
 * El vale se paga con el pase pero lo entrega una persona: hay que cuadrar
 * fechas, sala y equipo. Por eso reclamarlo no "canjea" nada automático — abre
 * la conversación y deja constancia de que está pedido, que es lo que el estudio
 * necesita para ponerlo en cola.
 *
 * Reclamar es idempotente en el servidor: si el hilo ya existía, se reusa.
 */
export function ValeDetail({ vale }: { vale: ValeId }) {
  const t = useTranslations();
  const { user, account } = useAuth();
  const [convId, setConvId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pase = account?.pase ?? null;
  const registro = vale === "video" ? pase?.video : pase?.produccion;
  const estado = valeEstado(registro);
  const alcance = pase?.produccion?.alcance;

  const nombreVale = t(
    vale === "video"
      ? "pases.incluye.video"
      : alcance === "grupo"
        ? "pases.incluye.produccionGrupo"
        : "pases.incluye.produccionArtista",
  );

  // El hilo ya existe si el vale está reclamado (o entregado): su id es
  // determinista, así que no hace falta ir a buscarlo.
  const hiloExistente =
    user && estado !== "pendiente" ? `vale_${user.uid}_${vale}` : null;
  const hilo = convId ?? hiloExistente;

  async function reclamar() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await reclamarVale(vale);
      // El primer mensaje lo escribe el cliente: es el único que sabe en qué
      // idioma habla el usuario (el servidor solo abre el hilo y avisa al equipo).
      await sendConversationMessage(id, {
        from: user.uid,
        tipo: "mensaje",
        texto: t("vales.mensajeInicial", { servicio: nombreVale }),
      });
      setConvId(id);
    } catch (e) {
      console.error("[vale] reclamar:", e);
      setError(t("vales.errorReclamar"));
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-28 pb-24 sm:px-12">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-10 w-64" />
        <Skeleton className="mt-6 h-24 w-full" />
      </main>
    );
  }

  // Sin ese vale en el pase no hay nada que reclamar (o nunca lo incluyó, o el
  // pase es de otro tier).
  if (!registro) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-narrow text-3xl font-bold uppercase">
          {t("vales.sinVale")}
        </h1>
        <Link
          href="/suscripciones"
          className="btn-outline mt-6 rounded-full px-6 py-3 text-sm tracking-[2px] uppercase"
        >
          {t("vales.verPases")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-28 pb-24 sm:px-12">
      <Link
        href="/solicitudes"
        className="text-silver-300 text-sm underline-offset-4 hover:text-white hover:underline"
      >
        ← {t("userMenu.myRequests")}
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
          {nombreVale}
        </h1>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
            estado === "entregado"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : estado === "reclamado"
                ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                : "text-silver-300 border-white/15 bg-white/5"
          }`}
        >
          {t(`vales.estado.${estado}`)}
        </span>
      </div>

      <p className="text-silver-300 mt-3 text-sm">{t("vales.intro")}</p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {estado === "pendiente" && !hilo && (
        <section className="border-amethyst-300/30 bg-amethyst-500/10 mt-6 rounded-xl border p-4">
          <h2 className="font-narrow text-xl font-bold text-white uppercase">
            {t("vales.reclamarTitulo")}
          </h2>
          <p className="text-silver-300 mt-2 text-sm">
            {t("vales.reclamarHint")}
          </p>
          <Button className="btn-amethyst mt-4" onClick={reclamar} loading={busy}>
            {t("vales.reclamar")}
          </Button>
        </section>
      )}

      {hilo && (
        <section className="mt-8">
          <h2 className="font-narrow mb-3 text-xl font-bold text-white uppercase">
            {t("solicitudDetail.conversation")}
          </h2>
          <div className="flex h-[28rem] flex-col">
            <ConversationView conversationId={hilo} />
          </div>
        </section>
      )}
    </main>
  );
}
