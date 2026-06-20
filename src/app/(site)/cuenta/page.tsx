"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { resendEmailVerification } from "@/features/auth/lib/auth-actions";
import type { Role } from "@/domain/user";

const ROLE_LABEL: Record<Role, string> = {
  cliente: "Cliente",
  productor: "Productor",
  admin: "Admin",
  artista: "Artista",
};

function initials(name: string | null, email: string | null): string {
  const base = name?.trim() || email || "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default function CuentaPage() {
  const { user, account, loading, logout } = useAuth();
  const router = useRouter();
  const [verifySent, setVerifySent] = useState(false);

  // Protección: sin sesión → a login.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-silver-300">Cargando…</p>
      </main>
    );
  }

  const name = account?.displayName ?? user.displayName ?? "Usuario";
  const email = account?.email ?? user.email;
  const photo = account?.photoURL ?? user.photoURL;
  const roles = account?.roles ?? [];
  const since = account?.createdAt
    ? new Date(account.createdAt).toLocaleDateString("es-CO", {
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
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pb-24 pt-28 sm:px-12">
      <h1 className="font-narrow text-5xl font-bold uppercase sm:text-6xl">
        Mi cuenta
      </h1>

      {/* Perfil */}
      <section className="mt-10 flex items-center gap-5">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-amethyst-500/30 text-xl font-bold text-white">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(name, email)
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold text-white">{name}</p>
          <p className="truncate text-silver-300">{email}</p>
          {roles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <span
                  key={r}
                  className="rounded-full border border-amethyst-300/40 bg-amethyst-500/10 px-2.5 py-0.5 text-xs uppercase tracking-wide text-amethyst-200"
                >
                  {ROLE_LABEL[r] ?? r}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {since && (
        <p className="mt-6 text-sm text-silver-400">Miembro desde {since}.</p>
      )}

      {/* Verificación de email */}
      {!user.emailVerified && (
        <div className="mt-6 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {verifySent ? (
            "Te reenviamos el correo de verificación. Revisa tu bandeja (y el spam)."
          ) : (
            <>
              Tu correo aún no está verificado.{" "}
              <button
                type="button"
                onClick={onResendVerification}
                className="font-semibold underline underline-offset-4 hover:text-white"
              >
                Reenviar verificación
              </button>
            </>
          )}
        </div>
      )}

      {/* Configuración (placeholder de futuras opciones) */}
      <section className="mt-12">
        <h2 className="font-narrow text-2xl font-bold uppercase tracking-wide text-white">
          Configuración
        </h2>
        <p className="mt-2 text-silver-400">
          Pronto podrás editar tu perfil, foto y preferencias aquí.
        </p>
      </section>

      <button
        type="button"
        onClick={onLogout}
        className="mt-12 rounded-full border border-red-500/40 bg-red-500/10 px-6 py-3 text-sm font-semibold uppercase tracking-[2px] text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-white"
      >
        Cerrar sesión
      </button>
    </main>
  );
}
