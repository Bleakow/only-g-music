"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button, glassSurfaceMenu } from "@only-g/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  authErrorMessage,
  loginWithEmail,
  loginWithGoogle,
} from "@/features/auth/auth-actions";

// Only G Music: la cuenta se crea allí (misma cuenta, mismo proyecto Firebase).
const ONLY_G_URL =
  process.env.NEXT_PUBLIC_ONLY_G_URL ??
  "https://only-g-music--only-g-music-745ca.us-east4.hosted.app";

const FIELD =
  "w-full rounded-lg border border-silver-200/10 bg-white/[0.03] px-3 py-2 text-sm text-silver-100 outline-none transition placeholder:text-silver-500 focus-visible:ring-2 focus-visible:ring-amethyst-300/70";

/**
 * Puerta de sesión de G Notes. Sin sesión no se entra — y, sobre todo, sin sesión
 * los endpoints de IA responden 401: es lo que impide que un desconocido queme la
 * cuota de Gemini. La cuenta es la misma de Only G Music (mismo `uid`), pero el
 * login es aparte porque la sesión no cruza de dominio.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span
          className="size-6 animate-spin rounded-full border-2 border-amethyst-500/30 border-t-amethyst-300"
          aria-label="Cargando"
        />
      </div>
    );
  }

  if (user) return <>{children}</>;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    void run(() => loginWithEmail(email.trim(), password));
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className={`${glassSurfaceMenu} w-full max-w-sm rounded-2xl p-6`}>
        <h1 className="bg-linear-to-r from-amethyst-300 to-amethyst-500 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
          G&nbsp;Notes
        </h1>
        <p className="mt-1 text-sm text-silver-300">
          Entra con tu cuenta de Only G Music para escribir.
        </p>

        <div className="mt-5">
          <Button
            size="md"
            variant="secondary"
            className="w-full"
            loading={busy}
            onClick={() => void run(loginWithGoogle)}
          >
            Continuar con Google
          </Button>
        </div>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-silver-200/10" />
          <span className="text-[0.7rem] uppercase tracking-wide text-silver-500">
            o
          </span>
          <span className="h-px flex-1 bg-silver-200/10" />
        </div>

        <form onSubmit={onSubmit} className="space-y-2">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            aria-label="Correo"
            className={FIELD}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            aria-label="Contraseña"
            className={FIELD}
          />
          <Button
            type="submit"
            size="md"
            variant="primary"
            className="w-full"
            loading={busy}
            disabled={!email.trim() || !password}
          >
            Entrar
          </Button>
        </form>

        {error && (
          <p className="mt-3 text-center text-xs text-danger" role="alert">
            {error}
          </p>
        )}

        <p className="mt-5 text-center text-xs text-silver-500">
          ¿No tienes cuenta?{" "}
          <a
            href={ONLY_G_URL}
            className="text-amethyst-300 transition hover:text-amethyst-200"
          >
            Créala en Only G Music
          </a>
        </p>
      </div>
    </div>
  );
}
