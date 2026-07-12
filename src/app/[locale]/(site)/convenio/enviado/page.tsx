"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DatosPagoForm } from "@/features/socios/components/DatosPagoForm";

/**
 * Confirmación tras enviar una SOLICITUD DE CONVENIO (productor/beatmaker)
 * desde el registro. La solicitud queda `pendiente`; el admin la aprueba o
 * rechaza desde `/admin/convenios` y el usuario se entera por notificación y
 * por el chat de su solicitud (ver `/solicitudes`).
 *
 * Aquí ofrecemos, de forma OPCIONAL, dejar ya los datos de pago (a dónde le
 * paga Only G). El usuario sigue siendo rol 'cliente' con convenio pendiente,
 * pero la regla owner-write de `datosPago/{uid}` no gatea por rol, así que puede
 * guardarlos. Va embebido (no un enlace a /cuenta): allí la sección está gateada
 * por rol de socio, que este usuario todavía no tiene.
 */
function ConvenioEnviadoContent() {
  const t = useTranslations();
  const [showDatos, setShowDatos] = useState(false);
  const [datosSaved, setDatosSaved] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 pt-28 pb-24 text-center">
      <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
        {t("convenioEnviado.title")}
      </h1>
      <p className="text-silver-300 mt-3">{t("convenioEnviado.body")}</p>
      <Link
        href="/solicitudes"
        className="from-silver-100 to-amethyst-300 text-ink mt-8 inline-flex rounded-full bg-gradient-to-r px-7 py-3 text-sm font-semibold tracking-[2px] uppercase transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
      >
        {t("convenioEnviado.cta")}
      </Link>

      {/* Prompt OPCIONAL de datos de pago */}
      <section className="mt-12 w-full text-left">
        <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h2 className="font-narrow text-xl font-bold tracking-wide text-white uppercase">
              {t("datosPago.prompt.title")}
            </h2>
            <span className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200 rounded-full border px-2 py-0.5 text-[0.65rem] tracking-wide uppercase">
              {t("datosPago.prompt.optional")}
            </span>
          </div>
          <p className="text-silver-300 mt-2 text-sm">
            {t("datosPago.prompt.description")}
          </p>

          {!showDatos && !datosSaved && (
            <button
              type="button"
              onClick={() => setShowDatos(true)}
              className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-100 mt-4 inline-flex rounded-full border px-5 py-2.5 text-sm font-semibold tracking-wide uppercase transition hover:bg-amethyst-500/20 hover:text-white"
            >
              {t("datosPago.prompt.add")}
            </button>
          )}

          {showDatos && (
            <div className="mt-5">
              <DatosPagoForm onSaved={() => setDatosSaved(true)} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ConvenioEnviadoPage() {
  return (
    <RequireAuth>
      <ConvenioEnviadoContent />
    </RequireAuth>
  );
}
