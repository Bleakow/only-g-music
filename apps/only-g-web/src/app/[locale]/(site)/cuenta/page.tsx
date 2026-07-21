"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { resendEmailVerification } from "@/features/auth/lib/auth-actions";
import { EditProfileModal } from "@/features/auth/components/EditProfileModal";
import { DatosPagoForm } from "@/features/socios/components/DatosPagoForm";
import { GlassButton } from "@/components/ui/GlassButton";
import { EditIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { GNotesPremiumCard } from "@/features/gnotes/components/GNotesPremiumCard";
import { hasAnyRole } from "@only-g/shared-types/user";

function initials(name: string | null, email: string | null): string {
  const base = name?.trim() || email || "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default function CuentaPage() {
  const { user, account, loading, logout } = useAuth();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const [verifySent, setVerifySent] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Protección: sin sesión → a login.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-28 pb-24 sm:px-12">
        <Skeleton className="h-12 w-64" />
        <section className="mt-10 flex items-center gap-5">
          <Skeleton className="size-20 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-2 h-4 w-52" />
          </div>
        </section>
        <Skeleton className="mt-6 h-10 w-32 rounded-full" />
        <section className="mt-12">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </section>
      </main>
    );
  }

  const name = account?.displayName ?? user.displayName ?? t("userMenu.user");
  const email = account?.email ?? user.email;
  const photo = account?.photoURL ?? user.photoURL;
  const roles = account?.roles ?? [];
  const since = account?.createdAt
    ? new Date(account.createdAt).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
      })
    : null;

  async function onLogout() {
    await logout();
    router.push("/");
  }

  async function onResendVerification() {
    try {
      await resendEmailVerification();
      setVerifySent(true);
    } catch {
      // El banner es solo informativo; no bloqueamos por un fallo de envío.
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-28 pb-24 sm:px-12">
      <h1 className="font-narrow text-5xl font-bold uppercase sm:text-6xl">
        {t("account.title")}
      </h1>

      {/* Perfil */}
      <section className="mt-10 flex items-center gap-5">
        <div className="bg-amethyst-500/30 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 text-xl font-bold text-white">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(name, email)
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold text-white">{name}</p>
          <p className="text-silver-300 truncate">{email}</p>
          {roles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <span
                  key={r}
                  className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200 rounded-full border px-2.5 py-0.5 text-xs tracking-wide uppercase"
                >
                  {t(`roles.${r}`)}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {since && (
        <p className="text-silver-400 mt-6 text-sm">
          {t("account.memberSince", { since })}
        </p>
      )}

      <div className="mt-6">
        <GlassButton onClick={() => setEditOpen(true)}>
          <EditIcon className="size-4" />
          {t("account.edit")}
        </GlassButton>
      </div>

      {/* Verificación de email */}
      {!user.emailVerified && (
        <div className="mt-6 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {verifySent ? (
            t("account.verifySent")
          ) : (
            <>
              {t("account.emailUnverified")}{" "}
              <button
                type="button"
                onClick={onResendVerification}
                className="font-semibold underline underline-offset-4 hover:text-white"
              >
                {t("account.resendVerification")}
              </button>
            </>
          )}
        </div>
      )}

      {/* Datos de pago — solo socios (beatmaker/productor). A dónde le paga Only G. */}
      {hasAnyRole(account, ["beatmaker", "productor"]) && (
        <section id="datos-pago" className="mt-12 scroll-mt-28">
          <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase">
            {t("datosPago.title")}
          </h2>
          <p className="text-silver-400 mt-2">{t("datosPago.description")}</p>
          <div className="mt-5">
            <DatosPagoForm />
          </div>
        </section>
      )}

      {/* G Notes premium — IA sin límite (todo usuario autenticado). */}
      <GNotesPremiumCard />

      {/* Configuración */}
      <section className="mt-12">
        <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase">
          {t("userMenu.settings")}
        </h2>
        {/* Idioma: en móvil el cambio de idioma vive aquí (se quitó del menú). */}
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/3 px-4 py-3">
          <span className="text-silver-200 text-sm">
            {t("account.language")}
          </span>
          <LanguageSwitcher />
        </div>
      </section>

      <button
        type="button"
        onClick={onLogout}
        className="mt-12 rounded-full border border-red-500/40 bg-red-500/10 px-6 py-3 text-sm font-semibold tracking-[2px] text-red-200 uppercase transition hover:border-red-400 hover:bg-red-500/20 hover:text-white"
      >
        {t("userMenu.logout")}
      </button>

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </main>
  );
}
