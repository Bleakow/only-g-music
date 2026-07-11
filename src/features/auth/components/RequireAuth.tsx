"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "./AuthProvider";

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.2" />
    </svg>
  );
}

/**
 * Guard de ruta para páginas protegidas. Si no hay sesión, en vez de dejar
 * pasar, muestra una pantalla-puerta con la opción de iniciar sesión (volviendo
 * luego a esta misma ruta vía `?next=`) o regresar atrás.
 */
export function RequireAuth({
  children,
  title,
  message,
}: {
  children: ReactNode;
  title?: string;
  message?: string;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const heading = title ?? t("auth.loginRequired");
  const desc = message ?? t("auth.loginRequiredDesc");

  // Sin texto "Cargando": el vinilo (overlay inicial / loading.tsx) ya cubre la
  // carga. Un lienzo oscuro mientras resuelve la sesión evita el flash de texto
  // al desvanecerse el loader.
  if (loading) {
    return <div className="bg-ink min-h-dvh" aria-hidden="true" />;
  }

  if (!user) {
    function goBack() {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push("/");
      }
    }

    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(130% 120% at 30% 20%, rgba(124,58,237,0.16), transparent 60%), radial-gradient(120% 100% at 80% 90%, rgba(196,165,255,0.07), transparent 55%)",
          }}
        />

        <div className="relative max-w-md">
          <div className="border-amethyst-300/30 bg-amethyst-500/10 text-amethyst-200 mx-auto flex size-16 items-center justify-center rounded-full border">
            <LockIcon className="size-8" />
          </div>

          <h1 className="font-narrow mt-6 text-4xl font-bold uppercase sm:text-5xl">
            {heading}
          </h1>
          <p className="text-silver-300 mt-3">{desc}</p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="from-silver-100 to-amethyst-300 text-ink rounded-full bg-gradient-to-r px-8 py-3 text-sm font-semibold tracking-[2px] uppercase transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
            >
              {t("auth.login")}
            </Link>
            <button
              type="button"
              onClick={goBack}
              className="border-silver-300/40 text-silver-100 hover:border-silver-100 rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
            >
              {t("auth.goBack")}
            </button>
          </div>

          <p className="text-silver-400 mt-6 text-sm">
            {t("auth.noAccount")}{" "}
            <Link
              href={`/login?mode=register&next=${encodeURIComponent(pathname)}`}
              className="text-amethyst-300 hover:text-amethyst-200 font-semibold underline-offset-4 hover:underline"
            >
              {t("auth.createAccount")}
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
