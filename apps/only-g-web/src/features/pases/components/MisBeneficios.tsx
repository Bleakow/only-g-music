"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";
import { premiumEstado, type Premium } from "@only-g/shared-types/artist-profile";
import { gnotesEstado } from "@only-g/shared-types/gnotes-membership";
import { paseEstado, valesDe } from "@only-g/shared-types/pase";
import { useRestanteLabel } from "../lib/use-restante";

/** Una línea de "esto tienes y esto te queda". */
function Vigencia({
  titulo,
  restante,
  activo,
}: {
  titulo: string;
  restante: string;
  activo: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="min-w-0 truncate text-sm font-semibold text-white">
        {titulo}
      </span>
      <span
        className={`shrink-0 text-sm ${
          activo ? "text-emerald-300" : "text-silver-400"
        }`}
      >
        {restante}
      </span>
    </li>
  );
}

/**
 * "Lo que tienes activo" en Mis cosas: cuánto te queda de cada cosa que pagaste
 * (pase, perfil publicado, G Notes) y los VALES del pase — la producción o el
 * video que entrega el estudio a mano.
 *
 * Existe porque el tiempo comprado era invisible: el usuario veía una fecha de
 * caducidad en Suscripciones, si acaso, y los vales no tenían dónde pedirse.
 * Aquí se dice en cristiano —"1 mes 12 días"— y se reclama de un clic.
 *
 * No pinta nada si la cuenta no tiene ningún beneficio: una sección vacía
 * recordando lo que NO tienes es ruido, no información.
 */
export function MisBeneficios() {
  const t = useTranslations();
  const { account } = useAuth();
  const restanteLabel = useRestanteLabel();
  const [premium, setPremium] = useState<Premium | null>(null);

  const slug = account?.artistSlug;
  useEffect(() => {
    if (!slug) {
      setPremium(null);
      return;
    }
    let active = true;
    getProfileBySlug(slug)
      .then((p) => {
        if (active) setPremium(p?.premium ?? null);
      })
      .catch((e) => console.error("[mis-beneficios] perfil:", e));
    return () => {
      active = false;
    };
  }, [slug]);

  const now = Date.now();
  const pase = account?.pase ?? null;
  const paseVigente = paseEstado(pase, now) === "activo";
  const gnotes = account?.gnotesPremium ?? null;
  const gnotesVigente = gnotesEstado(gnotes, now) === "activo";
  const perfilVigente = premiumEstado(premium, now) === "activo";
  const vales = valesDe(pase);

  const hayAlgo = !!pase || !!gnotes || !!premium || vales.length > 0;
  if (!hayAlgo) return null;

  return (
    <section className="mt-10">
      <h2 className="font-narrow text-2xl font-bold text-white uppercase">
        {t("misBeneficios.title")}
      </h2>

      <ul className="mt-4 flex flex-col gap-3">
        {pase?.tipo && (
          <Vigencia
            titulo={t("misBeneficios.pase", {
              pase: t(`pases.${pase.tipo}.nombre`),
            })}
            restante={restanteLabel(pase.expiresAt)}
            activo={paseVigente}
          />
        )}
        {premium && (
          <Vigencia
            titulo={t("misBeneficios.perfil")}
            restante={restanteLabel(premium.expiresAt)}
            activo={perfilVigente}
          />
        )}
        {gnotes && (
          <Vigencia
            titulo={t("misBeneficios.gnotes")}
            restante={restanteLabel(gnotes.expiresAt)}
            activo={gnotesVigente}
          />
        )}
      </ul>

      {/* VALES: lo que entrega una persona. No caducan con el pase — un
          beneficio ya pagado no se pierde porque venza el mes. */}
      {vales.length > 0 && (
        <div className="mt-5">
          <h3 className="text-silver-300 text-xs font-semibold tracking-[2px] uppercase">
            {t("misBeneficios.valesTitulo")}
          </h3>
          <ul className="mt-3 flex flex-col gap-3">
            {vales.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {t(
                      v.id === "video"
                        ? "pases.incluye.video"
                        : v.alcance === "grupo"
                          ? "pases.incluye.produccionGrupo"
                          : "pases.incluye.produccionArtista",
                    )}
                  </p>
                  <p
                    className={`text-sm ${
                      v.estado === "entregado"
                        ? "text-emerald-300"
                        : v.estado === "reclamado"
                          ? "text-amber-300"
                          : "text-silver-400"
                    }`}
                  >
                    {t(`vales.estado.${v.estado}`)}
                  </p>
                </div>
                {v.estado !== "entregado" && (
                  <Link
                    href={`/solicitudes/vale/${v.id}`}
                    className="btn-outline shrink-0 rounded-full px-4 py-2 text-xs tracking-[1px] uppercase"
                  >
                    {t(
                      v.estado === "reclamado"
                        ? "misBeneficios.verHilo"
                        : "misBeneficios.reclamar",
                    )}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
