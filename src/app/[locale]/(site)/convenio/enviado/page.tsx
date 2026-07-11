"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/features/auth/components/RequireAuth";

/**
 * Confirmación tras enviar una SOLICITUD DE CONVENIO (productor/beatmaker)
 * desde el registro. La solicitud queda `pendiente`; el admin la aprueba o
 * rechaza desde `/admin/convenios` y el usuario se entera por notificación y
 * por el chat de su solicitud (ver `/solicitudes`).
 */
function ConvenioEnviadoContent() {
  const t = useTranslations();

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
