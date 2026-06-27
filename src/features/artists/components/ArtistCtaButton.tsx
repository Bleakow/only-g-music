"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";

/**
 * CTA de la vitrina de artistas. Si el usuario YA tiene perfil/alta de artista
 * (`account.artistSlug`), el botón pasa a "Edita tu perfil" y lo lleva directo a
 * su plantilla (`/artista/perfil`). Si no, invita a crear uno (`/artista/nuevo`).
 * Va en cliente porque depende de la sesión (el resto de la página es servidor).
 */
export function ArtistCtaButton() {
  const t = useTranslations("artistsPage");
  const { account } = useAuth();
  const hasProfile = !!account?.artistSlug;

  return (
    <Link
      href={hasProfile ? "/artista/perfil" : "/artista/nuevo"}
      className="border-amethyst-400/60 text-amethyst-200 hover:border-amethyst-300 hover:bg-amethyst-500/10 mt-5 inline-flex rounded-full border px-5 py-2.5 text-sm font-semibold tracking-[2px] uppercase transition hover:text-white"
    >
      {hasProfile ? t("editProfile") : t("createProfile")}
    </Link>
  );
}
