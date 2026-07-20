"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import Image from "next/image";
import { ArrowLeftIcon } from "@/components/icons";
import { SiteMenu } from "./SiteMenu";

export function SiteHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  // En la lista de artistas y en los perfiles el logo de Inicio sobra (el perfil
  // tiene su propia navegación: Atrás + Ajustes).
  const hideLogo =
    pathname === "/artistas" || pathname.startsWith("/artistas/");
  // En el flujo de compra / cotización, en vez del logo de Inicio va un botón
  // "Atrás" que devuelve a donde el usuario venía (misma posición del logo).
  const showBack = pathname === "/comprar" || pathname === "/cotizar";

  return (
    <>
      {showBack ? (
        <header className="fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center px-6 py-5 sm:px-12">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label={t("nav.back")}
              className="text-silver-100 border-amethyst-300/25 hover:border-amethyst-300/55 inline-flex size-12 items-center justify-center rounded-2xl border bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md transition hover:-translate-y-0.5 hover:text-white active:scale-95 sm:size-14"
            >
              <ArrowLeftIcon className="size-6" />
            </button>
          </div>
        </header>
      ) : (
        !hideLogo && (
          <header className="fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-black/70 to-transparent">
            <div className="flex items-center px-6 py-5 sm:px-12">
              <Link
                href="/"
                aria-label={t("nav.home")}
                className="group inline-block"
              >
                <Image
                  src="/logo/logo-white.png"
                  alt="Only G"
                  width={384}
                  height={256}
                  className="h-12 w-auto transition duration-300 group-hover:scale-105 group-hover:drop-shadow-[0_0_16px_rgba(196,165,255,0.55)] group-active:scale-95 sm:h-16"
                />
              </Link>
            </div>
          </header>
        )
      )}

      <SiteMenu />
    </>
  );
}
