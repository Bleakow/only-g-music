"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { GlassButton } from "@/components/ui/GlassButton";
import { ArrowLeftIcon } from "@/components/icons";

/**
 * CTA de la vitrina de artistas. Si el usuario YA tiene perfil/alta de artista
 * (`account.artistSlug`), el botón lleva a su plantilla (`/artista/perfil`); si
 * no, invita a crear uno (`/artista/nuevo`). Va en cliente porque depende de la
 * sesión (el resto de la página es servidor).
 *
 * El texto de "crear" tiene versión corta para móvil —ahí comparte fila con la
 * lupa del buscador y el gancho largo no cabe—, resuelta con dos `span` y no con
 * dos botones: un solo control, un solo destino, un solo foco.
 */
export function ArtistCtaButton({ className }: { className?: string }) {
  const t = useTranslations("artistsPage");
  const { account } = useAuth();
  const hasProfile = !!account?.artistSlug;

  return (
    <GlassButton
      href={hasProfile ? "/artista/perfil" : "/artista/nuevo"}
      className={className}
    >
      {hasProfile ? (
        t("editProfile")
      ) : (
        <>
          <span className="sm:hidden">{t("createProfileShort")}</span>
          <span className="hidden sm:inline">{t("createProfile")}</span>
        </>
      )}
      {/* Flecha animada (espejo de la del botón Atrás): se desliza a la derecha. */}
      <ArrowLeftIcon className="size-4 rotate-180 transition-transform duration-300 group-hover:translate-x-1" />
    </GlassButton>
  );
}
