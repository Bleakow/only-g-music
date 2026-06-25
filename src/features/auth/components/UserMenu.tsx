"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "./AuthProvider";
import { hasAnyRole } from "@/domain/user";
import { glassSurfaceMenu, GlassSheen } from "@/components/ui/glass";

function initials(name: string | null, email: string | null): string {
  const base = name?.trim() || email || "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function PersonIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

/** Posición fija, a la izquierda del botón hamburguesa del SiteMenu (que está en
 *  right 1.5rem móvil / 3rem sm). Dejamos aire extra: con el panel saliendo 1rem
 *  hacia afuera, su canto derecho queda ~14px a la izquierda de la hamburguesa. */
const WRAP = "fixed top-4 right-[5.5rem] z-[105] sm:top-5 sm:right-28";

// Opción del menú: borde sutil (le da definición y ayuda a leer el texto sobre
// fondos con foto). Hover = borde amatista + barrido + leve deslizamiento.
const ITEM =
  "flex items-center rounded-lg border border-white/15 px-3 py-2.5 text-sm text-silver-100 transition-all duration-200 hover:border-amethyst-300/60 hover:bg-gradient-to-r hover:from-amethyst-500/25 hover:to-transparent hover:pl-4 hover:text-white";

export function UserMenu() {
  const { user, account, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = useTranslations();

  // Cerrar el dropdown al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (loading) return null;

  const name = account?.displayName ?? user?.displayName ?? null;
  const email = account?.email ?? user?.email ?? null;
  const photo = account?.photoURL ?? user?.photoURL ?? null;
  const roles = account?.roles ?? [];

  async function onLogout() {
    await logout();
    setOpen(false);
    router.push("/");
  }

  return (
    <div ref={ref} className={WRAP}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={user ? t("userMenu.account") : t("userMenu.access")}
        aria-expanded={open}
        className="text-silver-100 hover:border-amethyst-300 absolute top-0 right-0 z-20 flex size-10 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-black/40 text-sm font-bold backdrop-blur-sm transition hover:text-white"
      >
        {user && photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : user ? (
          initials(name, email)
        ) : (
          <PersonIcon className="size-5" />
        )}
      </button>

      {/* El menú se REVELA con un círculo (clip-path) que crece desde el avatar:
          el panel está a tamaño completo (el desenfoque del fondo se ve correcto
          desde el inicio, no solo al final) y el avatar queda ESTÁTICO encima —
          el menú aparece a su alrededor. Centro del círculo = centro del avatar
          (2.25rem desde el canto sup-der del panel, que va 1rem más afuera). */}
      <div
        inert={!open}
        aria-hidden={!open}
        style={{
          clipPath: open
            ? "circle(170% at right 2.25rem top 2.25rem)"
            : "circle(0% at right 2.25rem top 2.25rem)",
          transition: "clip-path 450ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className={`absolute top-[-1rem] right-[-1rem] w-64 ${
          open ? "" : "pointer-events-none"
        }`}
      >
        <div className={`${glassSurfaceMenu} overflow-hidden rounded-2xl`}>
          <GlassSheen />
          {/* Gloss superior extra (más brillo de cristal). */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/15 to-transparent" />
          {/* Sombra de texto heredada: las letras despegan del fondo. */}
          <div className="relative [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
            {user ? (
              <>
                {/* Nombre/correo a la IZQUIERDA; el círculo (avatar) va a la
                    derecha, fuera del recorte, alineado con el trigger. */}
                <div className="border-b border-white/10 p-4 pr-16 text-right">
                  <p className="truncate text-sm font-semibold text-white">
                    {name ?? t("userMenu.user")}
                  </p>
                  <p className="text-silver-300 truncate text-xs">{email}</p>
                </div>

                {roles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                    {roles.map((r) => (
                      <span
                        key={r}
                        className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200 rounded-full border px-2 py-0.5 text-[0.65rem] tracking-wide uppercase"
                      >
                        {t(`roles.${r}`)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-1.5 p-2.5">
                  {/* Admin: Panel admin de primero; sin "Mis solicitudes" ni
                      "Conviértete en artista" (flujos de cliente/artista). */}
                  {hasAnyRole(account, ["admin"]) && (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className={ITEM}
                    >
                      {t("userMenu.adminPanel")}
                    </Link>
                  )}
                  {!hasAnyRole(account, ["admin"]) && (
                    <Link
                      href="/solicitudes"
                      onClick={() => setOpen(false)}
                      className={ITEM}
                    >
                      {t("userMenu.myRequests")}
                    </Link>
                  )}
                  {hasAnyRole(account, ["artista"]) ? (
                    <Link
                      href={
                        account?.artistSlug
                          ? `/artistas/${account.artistSlug}`
                          : "/artista/perfil"
                      }
                      onClick={() => setOpen(false)}
                      className={ITEM}
                    >
                      {t("userMenu.myArtistProfile")}
                    </Link>
                  ) : (
                    !hasAnyRole(account, ["admin"]) && (
                      <Link
                        href="/artista/nuevo"
                        onClick={() => setOpen(false)}
                        className={ITEM}
                      >
                        {t("userMenu.becomeArtist")}
                      </Link>
                    )
                  )}
                  {hasAnyRole(account, ["productor"]) && (
                    <Link
                      href="/consola"
                      onClick={() => setOpen(false)}
                      className={ITEM}
                    >
                      {t("userMenu.console")}
                    </Link>
                  )}
                  {hasAnyRole(account, ["productor", "admin"]) && (
                    <Link
                      href="/disponibilidad"
                      onClick={() => setOpen(false)}
                      className={ITEM}
                    >
                      {t("userMenu.availability")}
                    </Link>
                  )}
                  <Link
                    href="/cuenta"
                    onClick={() => setOpen(false)}
                    className={ITEM}
                  >
                    {t("userMenu.settings")}
                  </Link>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex w-full items-center rounded-lg border border-red-500/25 px-3 py-2.5 text-left text-sm text-red-300 transition-all duration-200 hover:border-red-400/60 hover:bg-gradient-to-r hover:from-red-500/25 hover:to-transparent hover:pl-4 hover:text-red-200"
                  >
                    {t("userMenu.logout")}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5 p-2.5 pt-14">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className={ITEM}
                >
                  {t("auth.login")}
                </Link>
                <Link
                  href="/login?mode=register"
                  onClick={() => setOpen(false)}
                  className="from-silver-100 to-amethyst-300 text-ink block rounded-xl bg-gradient-to-r px-3 py-2.5 text-center text-sm font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(139,92,246,0.6)]"
                >
                  {t("auth.createAccount")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
