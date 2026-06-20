"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { hasAnyRole, type Role } from "@/domain/user";

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

/** Posición fija, a la izquierda del botón hamburguesa del SiteMenu. */
const WRAP = "fixed top-4 right-[4.5rem] z-[105] sm:top-5 sm:right-24";

const ITEM =
  "block rounded-lg px-3 py-2 text-sm text-silver-100 transition hover:bg-white/5 hover:text-white";

export function UserMenu() {
  const { user, account, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Cerrar el dropdown al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
        aria-label={user ? "Menú de cuenta" : "Acceder"}
        aria-expanded={open}
        className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-black/40 text-sm font-bold text-silver-100 backdrop-blur-sm transition hover:border-amethyst-300 hover:text-white"
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

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-ink-soft shadow-2xl">
          {user ? (
            <>
              <div className="flex items-center gap-3 border-b border-white/10 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amethyst-500/30 text-sm font-bold text-white">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(name, email)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {name ?? "Usuario"}
                  </p>
                  <p className="truncate text-xs text-silver-300">{email}</p>
                </div>
              </div>

              {roles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                  {roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full border border-amethyst-300/40 bg-amethyst-500/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-amethyst-200"
                    >
                      {ROLE_LABEL[r] ?? r}
                    </span>
                  ))}
                </div>
              )}

              <div className="p-2">
                <Link
                  href="/solicitudes"
                  onClick={() => setOpen(false)}
                  className={ITEM}
                >
                  Mis solicitudes
                </Link>
                {hasAnyRole(account, ["artista"]) ? (
                  <Link
                    href="/artista/perfil"
                    onClick={() => setOpen(false)}
                    className={ITEM}
                  >
                    Mi perfil de artista
                  </Link>
                ) : (
                  <Link
                    href="/artista/nuevo"
                    onClick={() => setOpen(false)}
                    className={ITEM}
                  >
                    Conviértete en artista
                  </Link>
                )}
                {hasAnyRole(account, ["admin"]) && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className={ITEM}
                  >
                    Panel admin
                  </Link>
                )}
                {hasAnyRole(account, ["productor"]) && (
                  <Link
                    href="/consola"
                    onClick={() => setOpen(false)}
                    className={ITEM}
                  >
                    Consola
                  </Link>
                )}
                {hasAnyRole(account, ["productor", "admin"]) && (
                  <Link
                    href="/disponibilidad"
                    onClick={() => setOpen(false)}
                    className={ITEM}
                  >
                    Disponibilidad
                  </Link>
                )}
                <Link href="/cuenta" onClick={() => setOpen(false)} className={ITEM}>
                  Configuración
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                >
                  Cerrar sesión
                </button>
              </div>
            </>
          ) : (
            <div className="p-2">
              <Link href="/login" onClick={() => setOpen(false)} className={ITEM}>
                Iniciar sesión
              </Link>
              <Link
                href="/login?mode=register"
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-lg bg-gradient-to-r from-silver-100 to-amethyst-300 px-3 py-2 text-center text-sm font-semibold text-ink transition hover:shadow-[0_0_18px_rgba(139,92,246,0.5)]"
              >
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
