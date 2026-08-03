"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Colectivo } from "@only-g/shared-types/colectivo";
import {
  miembrosDestacados,
  puedeGestionar as puedeGestionarColectivo,
} from "@only-g/shared-types/colectivo";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";
import { Skeleton } from "@/components/ui/Skeleton";
import { getColectivoBySlug } from "../lib/colectivos-repo";
import { ColectivoProfile } from "./ColectivoProfile";

/**
 * Carga un colectivo y los perfiles de sus miembros DESTACADOS (solo esos: la
 * portada enseña cuatro caras, así que traer los cincuenta miembros sería pagar
 * cincuenta lecturas para pintar cuatro).
 *
 * Los perfiles se piden en paralelo y los que fallen se descartan: que un
 * miembro haya borrado su perfil no debe tumbar la página del colectivo.
 */
export function ColectivoLoader({ slug }: { slug: string }) {
  const t = useTranslations("colectivos");
  const { user } = useAuth();
  const [colectivo, setColectivo] = useState<Colectivo | null>(null);
  const [miembros, setMiembros] = useState<ArtistProfile[]>([]);
  const [estado, setEstado] = useState<"cargando" | "ok" | "noExiste">(
    "cargando",
  );

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const c = await getColectivoBySlug(slug);
        if (!vivo) return;
        if (!c) {
          setEstado("noExiste");
          return;
        }
        setColectivo(c);
        setEstado("ok");

        const perfiles = await Promise.all(
          miembrosDestacados(c).map((m) =>
            getProfileBySlug(m.slug).catch(() => null),
          ),
        );
        if (vivo) setMiembros(perfiles.filter((p): p is ArtistProfile => !!p));
      } catch {
        if (vivo) setEstado("noExiste");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [slug]);

  if (estado === "cargando") {
    return (
      <main className="bg-ink min-h-dvh">
        <Skeleton className="h-[52vh] w-full rounded-none" />
        <div className="mx-auto max-w-400 px-6 pt-12 sm:px-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-[18px]" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (estado === "noExiste" || !colectivo) {
    return (
      <main className="bg-ink flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-narrow text-4xl font-bold text-white uppercase sm:text-5xl">
          {t("notFound")}
        </h1>
        <p className="text-silver-400 mt-3 max-w-md text-sm">
          {t("notFoundHint")}
        </p>
        <Link
          href="/colectivos"
          className="border-silver-300/40 text-silver-100 hover:border-silver-100 mt-8 rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
        >
          {t("backToList")}
        </Link>
      </main>
    );
  }

  return (
    <ColectivoProfile
      colectivo={colectivo}
      miembros={miembros}
      puedeGestionar={puedeGestionarColectivo(colectivo, user?.uid)}
    />
  );
}
