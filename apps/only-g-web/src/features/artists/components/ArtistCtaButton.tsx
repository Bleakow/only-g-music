"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { GlassButton } from "@/components/ui/GlassButton";
import { ArrowLeftIcon } from "@/components/icons";

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
    <GlassButton
      href={hasProfile ? "/artista/perfil" : "/artista/nuevo"}
      className="mt-5"
    >
      {hasProfile ? t("editProfile") : t("createProfile")}
      {/* Flecha animada (espejo de la del botón Atrás): se desliza a la derecha. */}
      <ArrowLeftIcon className="size-4 rotate-180 transition-transform duration-300 group-hover:translate-x-1" />
    </GlassButton>
  );
}
